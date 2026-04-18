import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post('/auth/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { email, password, displayName } = body.data;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) return reply.code(409).send({ error: 'Email déjà utilisé' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const [user] = await db.insert(users).values({ email, hashedPassword, displayName }).returning();

    const token = nanoid(48);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

    await db.insert(sessions).values({ userId: user.id, tokenHash, expiresAt });

    return reply.code(201).send({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  });

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Données invalides' });

    const { email, password } = body.data;
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
      return reply.code(401).send({ error: 'Email ou mot de passe incorrect' });
    }

    const token = nanoid(48);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(sessions).values({ userId: user.id, tokenHash, expiresAt });

    return { token, user: { id: user.id, email: user.email, displayName: user.displayName } };
  });

  // POST /auth/logout
  app.post('/auth/logout', async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    }
    return { ok: true };
  });
}
