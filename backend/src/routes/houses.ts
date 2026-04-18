import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { houses, houseMembers, invitations, channels } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { sendInvitationEmail } from '../utils/mailer.js';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const channelFlagEnum = z.enum(['discussion', 'problem', 'maintenance', 'announcement', 'other']);

export async function housesRoutes(app: FastifyInstance) {

  // ─── Houses ────────────────────────────────────────────────────────────────

  app.get('/houses', { preHandler: authenticate }, async (req) => {
    const memberships = await db.query.houseMembers.findMany({
      where: eq(houseMembers.userId, req.user.id),
      with: { house: true },
    });
    return memberships.map(m => ({ ...m.house, role: m.role }));
  });

  app.post('/houses', { preHandler: authenticate }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      address: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const [house] = await db.insert(houses).values(body.data).returning();
    await db.insert(houseMembers).values({ houseId: house.id, userId: req.user.id, role: 'owner' });
    await db.insert(channels).values({
      houseId: house.id, name: 'Général', flag: 'discussion', createdBy: req.user.id,
    });
    return reply.code(201).send(house);
  });

  app.get('/houses/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member) return reply.code(403).send({ error: 'Accès refusé' });

    const house = await db.query.houses.findFirst({
      where: eq(houses.id, id),
      with: { members: { with: { user: true } }, channels: true },
    });
    if (!house) return reply.code(404).send({ error: 'Maison introuvable' });
    return { ...house, myRole: member.role };
  });

  app.patch('/houses/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      richDescription: z.string().optional(),
      address: z.string().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) return reply.code(403).send({ error: 'Admin requis' });

    const [updated] = await db.update(houses).set(body.data).where(eq(houses.id, id)).returning();
    return updated;
  });

  app.delete('/houses/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member) return reply.code(403).send({ error: 'Accès refusé' });

    const allMembers = await db.query.houseMembers.findMany({ where: eq(houseMembers.houseId, id) });
    if (member.role === 'owner' && allMembers.length > 1) {
      return reply.code(400).send({ error: 'Cédez votre titre de propriétaire avant de partir' });
    }

    await db.delete(houseMembers).where(
      and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id))
    );
    const remaining = await db.query.houseMembers.findMany({ where: eq(houseMembers.houseId, id) });
    if (remaining.length === 0) {
      await db.delete(houses).where(eq(houses.id, id));
    }
    return { ok: true };
  });

  // ─── Members ───────────────────────────────────────────────────────────────

  app.delete('/houses/:id/members/:userId', { preHandler: authenticate }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const requester = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!requester || (requester.role !== 'admin' && requester.role !== 'owner')) return reply.code(403).send({ error: 'Admin requis' });
    if (userId === req.user.id) return reply.code(400).send({ error: 'Utilisez "Quitter" pour partir' });

    const target = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, userId)),
    });
    if (target?.role === 'owner') return reply.code(403).send({ error: 'Impossible d\'expulser le propriétaire' });
    if (requester.role === 'admin' && target?.role === 'admin') return reply.code(403).send({ error: 'Seul le propriétaire peut expulser un administrateur' });

    await db.delete(houseMembers).where(
      and(eq(houseMembers.houseId, id), eq(houseMembers.userId, userId))
    );
    return { ok: true };
  });

  app.patch('/houses/:id/members/:userId', { preHandler: authenticate }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    const body = z.object({ role: z.enum(['admin', 'member']) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Rôle invalide' });

    const requester = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!requester || requester.role !== 'owner') return reply.code(403).send({ error: 'Propriétaire requis' });
    if (userId === req.user.id) return reply.code(400).send({ error: 'Impossible de modifier son propre rôle' });

    const target = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, userId)),
    });
    if (target?.role === 'owner') return reply.code(403).send({ error: 'Impossible de modifier le rôle du propriétaire' });

    const [updated] = await db.update(houseMembers)
      .set({ role: body.data.role })
      .where(and(eq(houseMembers.houseId, id), eq(houseMembers.userId, userId)))
      .returning();
    return updated;
  });

  // POST /houses/:id/transfer — céder le titre de propriétaire à un admin
  app.post('/houses/:id/transfer', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ userId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Données invalides' });

    const requester = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!requester || requester.role !== 'owner') return reply.code(403).send({ error: 'Propriétaire requis' });

    const target = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, body.data.userId)),
    });
    if (!target || target.role !== 'admin') return reply.code(400).send({ error: 'La cible doit être un administrateur' });

    await db.update(houseMembers).set({ role: 'admin' }).where(and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)));
    await db.update(houseMembers).set({ role: 'owner' }).where(and(eq(houseMembers.houseId, id), eq(houseMembers.userId, body.data.userId)));
    return { ok: true };
  });

  // ─── Invitations ───────────────────────────────────────────────────────────

  // POST /houses/:id/invite — générer un lien d'invitation (admin)
  app.post('/houses/:id/invite', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) return reply.code(403).send({ error: 'Admin requis' });

    const body = z.object({
      role: z.enum(['admin', 'member']).default('member'),
      email: z.string().email().optional(),
    }).safeParse(req.body);
    const rawRole = body.success ? body.data.role : 'member';
    const email = body.success ? body.data.email : undefined;
    // Un admin ne peut inviter qu'en tant que membre
    const role = member.role === 'admin' ? 'member' : rawRole;

    const token = nanoid(24);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours
    const [inv] = await db.insert(invitations).values({
      houseId: id, invitedBy: req.user.id, token, role, expiresAt,
    }).returning();

    if (email) {
      const house = await db.query.houses.findFirst({ where: eq(houses.id, id) });
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      await sendInvitationEmail({
        to: email,
        houseName: house?.name ?? 'une maison',
        invitedBy: req.user.displayName,
        link: `${frontendUrl}/join/${token}`,
      }).catch(err => console.error('Erreur envoi email invitation:', err));
    }

    return { token: inv.token, role: inv.role, expiresAt: inv.expiresAt };
  });

  // GET /invitations/:token/preview — infos publiques sans auth
  app.get('/invitations/:token/preview', async (req, reply) => {
    const { token } = req.params as { token: string };
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    if (!inv || inv.status === 'revoked') return reply.code(404).send({ error: 'Invitation introuvable' });
    if (inv.expiresAt < new Date()) return reply.code(410).send({ error: 'Invitation expirée' });

    const house = await db.query.houses.findFirst({ where: eq(houses.id, inv.houseId) });
    const allMembers = await db.query.houseMembers.findMany({ where: eq(houseMembers.houseId, inv.houseId) });
    return {
      houseName: house?.name,
      houseDescription: house?.description,
      membersCount: allMembers.length,
      expiresAt: inv.expiresAt,
      valid: inv.status === 'pending',
    };
  });

  // POST /invitations/:token/accept — rejoindre via token
  app.post('/invitations/:token/accept', { preHandler: authenticate }, async (req, reply) => {
    const { token } = req.params as { token: string };
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    if (!inv) return reply.code(400).send({ error: 'Invitation introuvable' });
    if (inv.expiresAt < new Date()) return reply.code(400).send({ error: 'Invitation expirée' });
    if (inv.status === 'revoked') return reply.code(400).send({ error: 'Invitation révoquée' });

    const existing = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, inv.houseId), eq(houseMembers.userId, req.user.id)),
    });
    if (existing) return { houseId: inv.houseId };

    await db.insert(houseMembers).values({ houseId: inv.houseId, userId: req.user.id, role: inv.role });
    await db.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, inv.id));
    return { houseId: inv.houseId };
  });

  // DELETE /invitations/:invId/revoke — révoquer (admin)
  app.delete('/invitations/:invId/revoke', { preHandler: authenticate }, async (req, reply) => {
    const { invId } = req.params as { invId: string };
    const [inv] = await db.select().from(invitations).where(eq(invitations.id, invId)).limit(1);
    if (!inv) return reply.code(404).send({ error: 'Introuvable' });

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, inv.houseId), eq(houseMembers.userId, req.user.id)),
    });
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) return reply.code(403).send({ error: 'Admin requis' });

    await db.update(invitations).set({ status: 'revoked' }).where(eq(invitations.id, invId));
    return { ok: true };
  });

  // ─── Channels ──────────────────────────────────────────────────────────────

  app.post('/houses/:id/channels', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ name: z.string().min(1), flag: channelFlagEnum }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) return reply.code(403).send({ error: 'Admin requis' });

    const [channel] = await db.insert(channels).values({
      houseId: id, createdBy: req.user.id, ...body.data,
    }).returning();
    return reply.code(201).send(channel);
  });

  app.patch('/channels/:channelId', { preHandler: authenticate }, async (req, reply) => {
    const { channelId } = req.params as { channelId: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      flag: channelFlagEnum.optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const channel = await db.query.channels.findFirst({ where: eq(channels.id, channelId) });
    if (!channel) return reply.code(404).send({ error: 'Canal introuvable' });

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, channel.houseId), eq(houseMembers.userId, req.user.id)),
    });
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) return reply.code(403).send({ error: 'Admin requis' });

    const [updated] = await db.update(channels).set(body.data).where(eq(channels.id, channelId)).returning();
    return updated;
  });

  app.delete('/channels/:channelId', { preHandler: authenticate }, async (req, reply) => {
    const { channelId } = req.params as { channelId: string };
    const channel = await db.query.channels.findFirst({ where: eq(channels.id, channelId) });
    if (!channel) return reply.code(404).send({ error: 'Canal introuvable' });

    const allChannels = await db.query.channels.findMany({
      where: eq(channels.houseId, channel.houseId),
    });
    if (allChannels.length <= 1) {
      return reply.code(400).send({ error: 'Impossible de supprimer le dernier canal' });
    }

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, channel.houseId), eq(houseMembers.userId, req.user.id)),
    });
    if (!member || (member.role !== 'admin' && member.role !== 'owner')) return reply.code(403).send({ error: 'Admin requis' });

    await db.delete(channels).where(eq(channels.id, channelId));
    return { ok: true, houseId: channel.houseId };
  });
}
