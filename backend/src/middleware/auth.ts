import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

// Déconnexion après 7 jours d'inactivité (aucune requête API)
const INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
// On met à jour lastUsedAt au maximum toutes les 5 minutes (évite les écritures inutiles)
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Non authentifié' });
  }

  const token = authHeader.slice(7);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const [session] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (!session || session.session.expiresAt < new Date()) {
    return reply.code(401).send({ error: 'Session expirée ou invalide' });
  }

  const lastUsed = session.session.lastUsedAt;
  if (Date.now() - lastUsed.getTime() > INACTIVITY_LIMIT_MS) {
    await db.delete(sessions).where(eq(sessions.id, session.session.id));
    return reply.code(401).send({ error: 'Session expirée pour inactivité' });
  }

  // Mise à jour lastUsedAt en arrière-plan (throttlée)
  if (Date.now() - lastUsed.getTime() > REFRESH_THRESHOLD_MS) {
    db.update(sessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(sessions.id, session.session.id))
      .execute()
      .catch(() => {});
  }

  request.user = {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string; displayName: string };
  }
}
