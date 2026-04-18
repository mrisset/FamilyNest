import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { messages, houseMembers, channels, sessions, users } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { createHash } from 'crypto';

// Map: channelId → Set of WebSocket clients
const channelClients = new Map<string, Set<any>>();

export async function messagesRoutes(app: FastifyInstance) {
  // GET /channels/:id/messages — historique
  app.get('/channels/:id/messages', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const channel = await db.query.channels.findFirst({ where: eq(channels.id, id) });
    if (!channel) return reply.code(404).send({ error: 'Canal introuvable' });
    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, channel.houseId), eq(houseMembers.userId, req.user.id)),
    });
    if (!member) return reply.code(403).send({ error: 'Accès refusé' });
    const msgs = await db.query.messages.findMany({
      where: eq(messages.channelId, id),
      with: { author: true },
      orderBy: [desc(messages.sentAt)],
      limit: 50,
    });
    return msgs.reverse();
  });

  // WebSocket /ws/channels/:channelId — chat temps réel
  app.get('/ws/channels/:channelId', { websocket: true }, async (connection, req) => {
    const socket = (connection as any).socket ?? connection;
    const { channelId } = req.params as { channelId: string };

    const token = (req.query as any).token as string;
    if (!token) { socket.close(1008, 'Non authentifié'); return; }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [session] = await db.select({ userId: sessions.userId })
      .from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
    if (!session) { socket.close(1008, 'Token invalide'); return; }

    const channel = await db.query.channels.findFirst({ where: eq(channels.id, channelId) });
    if (!channel) { socket.close(1008, 'Canal introuvable'); return; }

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, channel.houseId), eq(houseMembers.userId, session.userId)),
    });
    if (!member) { socket.close(1008, 'Accès refusé'); return; }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

    if (!channelClients.has(channelId)) channelClients.set(channelId, new Set());
    const room = channelClients.get(channelId)!;
    room.add(socket);

    socket.on('message', async (raw: Buffer | string) => {
      try {
        const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
        const parsed = JSON.parse(text);
        const content = parsed?.content?.trim();
        if (!content) return;

        const [msg] = await db.insert(messages).values({
          channelId, authorId: session.userId, content,
        }).returning();

        const payload = JSON.stringify({
          id: msg.id, content: msg.content, sentAt: msg.sentAt,
          author: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl ?? null },
        });

        room.forEach(client => {
          try { if (client.readyState === 1) client.send(payload); } catch (_) {}
        });
      } catch (e) { console.error('[WS] message error:', e); }
    });

    socket.on('close', () => { room.delete(socket); });
    socket.on('error', (err: Error) => {
      console.error('[WS] error:', err.message);
      room.delete(socket);
    });
  });
}
