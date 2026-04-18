import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users, sessions, houseMembers, houses } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export async function usersRoutes(app: FastifyInstance) {

  app.get('/me', { preHandler: authenticate }, async (req) => {
    const [user] = await db.select({
      id: users.id, email: users.email,
      displayName: users.displayName, avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, req.user.id)).limit(1);
    return user;
  });

  app.patch('/me', { preHandler: authenticate }, async (req, reply) => {
    const body = z.object({
      displayName: z.string().min(2).max(50).optional(),
      email: z.string().email().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    if (body.data.email) {
      const existing = await db.select({ id: users.id })
        .from(users).where(eq(users.email, body.data.email)).limit(1);
      if (existing.length && existing[0].id !== req.user.id)
        return reply.code(409).send({ error: 'Email déjà utilisé' });
    }

    const [updated] = await db.update(users)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(users.id, req.user.id))
      .returning({ id: users.id, email: users.email, displayName: users.displayName });
    return updated;
  });

  // PATCH /me/password — retourne un nouveau token pour éviter la déconnexion
  app.patch('/me/password', { preHandler: authenticate }, async (req, reply) => {
    const body = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    if (!user) return reply.code(404).send({ error: 'Utilisateur introuvable' });

    const valid = await bcrypt.compare(body.data.currentPassword, user.hashedPassword);
    if (!valid) return reply.code(401).send({ error: 'Mot de passe actuel incorrect' });

    const hashedPassword = await bcrypt.hash(body.data.newPassword, 12);
    await db.update(users).set({ hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, req.user.id));

    // Révoquer TOUTES les sessions existantes (y compris la courante)
    await db.delete(sessions).where(eq(sessions.userId, req.user.id));

    // Créer une nouvelle session et retourner le nouveau token
    const newToken = nanoid(48);
    const newTokenHash = createHash('sha256').update(newToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({ userId: req.user.id, tokenHash: newTokenHash, expiresAt });

    return {
      ok: true,
      token: newToken, // Le frontend doit stocker ce nouveau token
      message: 'Mot de passe modifié. Les autres appareils ont été déconnectés.',
    };
  });

  app.delete('/me', { preHandler: authenticate }, async (req, reply) => {
    const body = z.object({ password: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Mot de passe requis' });

    const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    if (!user) return reply.code(404).send({ error: 'Utilisateur introuvable' });

    const valid = await bcrypt.compare(body.data.password, user.hashedPassword);
    if (!valid) return reply.code(401).send({ error: 'Mot de passe incorrect' });

    const userId = req.user.id;

    // Supprimer les maisons dont l'utilisateur est le seul membre
    const memberships = await db.query.houseMembers.findMany({
      where: eq(houseMembers.userId, userId),
    });
    for (const m of memberships) {
      const allMembers = await db.query.houseMembers.findMany({
        where: eq(houseMembers.houseId, m.houseId),
      });
      if (allMembers.length === 1) {
        await db.delete(houses).where(eq(houses.id, m.houseId));
      }
    }

    await db.delete(users).where(eq(users.id, userId));
    return { ok: true };
  });
}
