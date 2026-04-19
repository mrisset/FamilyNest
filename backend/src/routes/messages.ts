import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { messages, houseMembers, channels, sessions, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { createHash } from 'crypto';

const MAX_MESSAGE_LENGTH = 4000; // caractères
const WS_AUTH_TIMEOUT_MS = 10_000; // 10s pour s'authentifier après connexion

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
      orderBy: (m, { desc }) => [desc(m.sentAt)],
      limit: 50,
    });
    return msgs.reverse();
  });

  // WebSocket /ws/channels/:channelId — chat temps réel
  // Auth via premier message : { type: "auth", token: "..." }
  // Le token ne passe plus dans l'URL pour éviter son exposition dans les logs
  app.get('/ws/channels/:channelId', { websocket: true }, async (connection, req) => {
    const socket = (connection as any).socket ?? connection;
    const { channelId } = req.params as { channelId: string };

    let authenticated = false;
    let currentUser: { id: string; displayName: string; avatarUrl: string | null } | null = null;

    // Fermeture automatique si pas d'authentification dans les 10s
    const authTimeout = setTimeout(() => {
      if (!authenticated) socket.close(1008, 'Délai d\'authentification dépassé');
    }, WS_AUTH_TIMEOUT_MS);

    socket.on('message', async (raw: Buffer | string) => {
      try {
        const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
        const parsed = JSON.parse(text);

        // ── Phase d'authentification ──────────────────────────────────────────
        if (!authenticated) {
          if (parsed?.type !== 'auth' || typeof parsed?.token !== 'string') {
            socket.close(1008, 'Premier message doit être { type: "auth", token: "..." }');
            return;
          }

          const tokenHash = createHash('sha256').update(parsed.token).digest('hex');
          const [session] = await db
            .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, lastUsedAt: sessions.lastUsedAt })
            .from(sessions)
            .where(eq(sessions.tokenHash, tokenHash))
            .limit(1);

          if (!session) { socket.close(1008, 'Token invalide'); return; }
          if (session.expiresAt < new Date()) { socket.close(1008, 'Session expirée'); return; }

          const INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - session.lastUsedAt.getTime() > INACTIVITY_LIMIT_MS) {
            await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
            socket.close(1008, 'Session expirée pour inactivité');
            return;
          }

          const channel = await db.query.channels.findFirst({ where: eq(channels.id, channelId) });
          if (!channel) { socket.close(1008, 'Canal introuvable'); return; }

          const member = await db.query.houseMembers.findFirst({
            where: and(eq(houseMembers.houseId, channel.houseId), eq(houseMembers.userId, session.userId)),
          });
          if (!member) { socket.close(1008, 'Accès refusé'); return; }

          const [user] = await db.select({
            id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl,
          }).from(users).where(eq(users.id, session.userId)).limit(1);
          if (!user) { socket.close(1008, 'Utilisateur introuvable'); return; }

          clearTimeout(authTimeout);
          authenticated = true;
          currentUser = user;

          if (!channelClients.has(channelId)) channelClients.set(channelId, new Set());
          channelClients.get(channelId)!.add(socket);

          socket.send(JSON.stringify({ type: 'auth_ok' }));
          return;
        }

        // ── Messages normaux (une fois authentifié) ───────────────────────────
        const content = parsed?.content?.trim();
        if (!content) return;

        if (content.length > MAX_MESSAGE_LENGTH) {
          socket.send(JSON.stringify({ type: 'error', message: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères)` }));
          return;
        }

        const [msg] = await db.insert(messages).values({
          channelId, authorId: currentUser!.id, content,
        }).returning();

        const payload = JSON.stringify({
          type: 'message',
          id: msg.id, content: msg.content, sentAt: msg.sentAt,
          author: currentUser,
        });

        const room = channelClients.get(channelId);
        room?.forEach(client => {
          try { if (client.readyState === 1) client.send(payload); } catch (_) {}
        });

      } catch (e) { console.error('[WS] message error:', e); }
    });

    socket.on('close', () => {
      clearTimeout(authTimeout);
      channelClients.get(channelId)?.delete(socket);
    });
    socket.on('error', (err: Error) => {
      console.error('[WS] error:', err.message);
      clearTimeout(authTimeout);
      channelClients.get(channelId)?.delete(socket);
    });
  });
}
