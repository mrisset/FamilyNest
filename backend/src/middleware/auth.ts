import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { eq, gt } from 'drizzle-orm';
import { createHash } from 'crypto';

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
