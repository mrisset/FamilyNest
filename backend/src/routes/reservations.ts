import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { reservations, houseMembers } from '../db/schema.js';
import { eq, and, lt, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

export async function reservationsRoutes(app: FastifyInstance) {
  // GET /houses/:id/reservations
  app.get('/houses/:id/reservations', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member) return reply.code(403).send({ error: 'Accès refusé' });

    await db.update(reservations).set({
      status: 'rejected',
      updatedAt: new Date(),
    }).where(and(
      eq(reservations.houseId, id),
      eq(reservations.status, 'pending'),
      lt(reservations.endDate, sql`CURRENT_DATE`),
    ));

    const res = await db.query.reservations.findMany({
      where: eq(reservations.houseId, id),
      with: { requestedByUser: true, reviewedByUser: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return res;
  });

  // POST /houses/:id/reservations — demande
  app.post('/houses/:id/reservations', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      guestCount: z.number().int().min(1).optional(),
      notes: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member) return reply.code(403).send({ error: 'Accès refusé' });

    const [res] = await db.insert(reservations).values({
      houseId: id, requestedBy: req.user.id, ...body.data,
    }).returning();

    return reply.code(201).send(res);
  });

  // PUT /reservations/:id — demandeur modifie sa réservation
  app.put('/reservations/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      guestCount: z.number().int().min(1).optional(),
      notes: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const [res] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
    if (!res) return reply.code(404).send({ error: 'Réservation introuvable' });
    if (res.requestedBy !== req.user.id) return reply.code(403).send({ error: 'Seul le demandeur peut modifier' });
    if (res.status !== 'pending' && res.status !== 'approved') {
      return reply.code(400).send({ error: 'Seules les réservations en attente ou approuvées peuvent être modifiées' });
    }

    const [updated] = await db.update(reservations).set({
      ...body.data,
      status: 'pending',
      reviewedBy: null,
      updatedAt: new Date(),
    }).where(eq(reservations.id, id)).returning();

    return updated;
  });

  // PATCH /reservations/:id — admin accepte/refuse
  app.patch('/reservations/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      status: z.enum(['approved', 'rejected', 'cancelled']),
      rejectionReason: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Statut invalide' });

    const [res] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1);
    if (!res) return reply.code(404).send({ error: 'Réservation introuvable' });

    // Vérifier que c'est un admin ou le demandeur (pour annulation)
    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, res.houseId), eq(houseMembers.userId, req.user.id)),
    });
    if (!member) return reply.code(403).send({ error: 'Accès refusé' });

    const isAdmin = member.role === 'admin' || member.role === 'owner';
    const isOwner = res.requestedBy === req.user.id;

    if (body.data.status === 'cancelled' && !isOwner && !isAdmin) {
      return reply.code(403).send({ error: 'Seul le demandeur ou un admin peut annuler' });
    }
    if (['approved', 'rejected'].includes(body.data.status) && !isAdmin) {
      return reply.code(403).send({ error: 'Admin requis pour approuver ou refuser' });
    }

    const [updated] = await db.update(reservations).set({
      status: body.data.status,
      reviewedBy: isAdmin ? req.user.id : undefined,
      rejectionReason: body.data.status === 'rejected' ? (body.data.rejectionReason ?? null) : null,
      updatedAt: new Date(),
    }).where(eq(reservations.id, id)).returning();

    return updated;
  });
}
