import { db } from '../db/index.js';
import { messages, sessions, invitations } from '../db/schema.js';
import { lt, and, eq } from 'drizzle-orm';

// Durée de rétention des messages (par défaut 365 jours, configurable via MESSAGE_RETENTION_DAYS)
const RETENTION_DAYS = Number(process.env.MESSAGE_RETENTION_DAYS ?? 365);
const INTERVAL_MS = 24 * 60 * 60 * 1000; // toutes les 24h

export async function runCleanup() {
  try {
    const messageCutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const [deletedMessages, deletedSessions, deletedInvitations] = await Promise.all([
      // Messages plus anciens que la durée de rétention
      db.delete(messages)
        .where(lt(messages.sentAt, messageCutoff))
        .returning({ id: messages.id }),

      // Sessions expirées
      db.delete(sessions)
        .where(lt(sessions.expiresAt, new Date()))
        .returning({ id: sessions.id }),

      // Invitations expirées encore en statut "pending"
      db.delete(invitations)
        .where(and(eq(invitations.status, 'pending'), lt(invitations.expiresAt, new Date())))
        .returning({ id: invitations.id }),
    ]);

    const total = deletedMessages.length + deletedSessions.length + deletedInvitations.length;
    if (total > 0) {
      console.log(
        `[cleanup] ${deletedMessages.length} message(s), ` +
        `${deletedSessions.length} session(s), ` +
        `${deletedInvitations.length} invitation(s) supprimés`
      );
    }
  } catch (err) {
    console.error('[cleanup] Erreur :', err);
  }
}

export function scheduleCleanup() {
  // Premier passage au démarrage (nettoie l'arriéré existant)
  runCleanup();
  // Puis toutes les 24h
  setInterval(runCleanup, INTERVAL_MS);
  console.log(`[cleanup] Purge automatique activée (rétention messages : ${RETENTION_DAYS} jours)`);
}
