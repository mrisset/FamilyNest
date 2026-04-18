import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { documents, houseMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import { createWriteStream, createReadStream, existsSync } from 'fs';
import { mkdir, unlink, stat, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function documentsRoutes(app: FastifyInstance) {
  await ensureUploadDir();

  // GET /houses/:id/documents
  app.get('/houses/:id/documents', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member) return reply.code(403).send({ error: 'Accès refusé' });

    const docs = await db.query.documents.findMany({
      where: eq(documents.houseId, id),
      with: { uploadedByUser: true },
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });
    return docs;
  });

  // POST /houses/:id/documents — upload
  app.post('/houses/:id/documents', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, id), eq(houseMembers.userId, req.user.id)),
    });
    if (!member || member.role !== 'admin' && member.role !== 'owner') return reply.code(403).send({ error: 'Admin requis' });

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'Aucun fichier reçu' });

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Type de fichier non autorisé' });
    }

    const ext = extname(data.filename) || '';
    const storedName = `${randomUUID()}${ext}`;
    const filePath = join(UPLOAD_DIR, storedName);

    // Écrire le fichier et vérifier la taille
    let sizeBytes = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      sizeBytes += chunk.length;
      if (sizeBytes > MAX_SIZE) {
        return reply.code(413).send({ error: 'Fichier trop volumineux (max 20 Mo)' });
      }
      chunks.push(chunk);
    }
    await writeFile(filePath, Buffer.concat(chunks));

    const [doc] = await db.insert(documents).values({
      houseId: id,
      uploadedBy: req.user.id,
      filename: data.filename,
      storedName,
      mimeType: data.mimetype,
      sizeBytes,
    }).returning();

    return reply.code(201).send(doc);
  });

  // GET /documents/:id/download — télécharger
  app.get('/documents/:docId/download', { preHandler: authenticate }, async (req, reply) => {
    const { docId } = req.params as { docId: string };
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
    if (!doc) return reply.code(404).send({ error: 'Document introuvable' });

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, doc.houseId), eq(houseMembers.userId, req.user.id)),
    });
    if (!member) return reply.code(403).send({ error: 'Accès refusé' });

    const filePath = join(UPLOAD_DIR, doc.storedName);
    if (!existsSync(filePath)) return reply.code(404).send({ error: 'Fichier introuvable sur le serveur' });

    reply.header('Content-Type', doc.mimeType);
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`);
    return reply.send(createReadStream(filePath));
  });

  // DELETE /documents/:id
  app.delete('/documents/:docId', { preHandler: authenticate }, async (req, reply) => {
    const { docId } = req.params as { docId: string };
    const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
    if (!doc) return reply.code(404).send({ error: 'Document introuvable' });

    const member = await db.query.houseMembers.findFirst({
      where: and(eq(houseMembers.houseId, doc.houseId), eq(houseMembers.userId, req.user.id)),
    });
    if (!member || member.role !== 'admin' && member.role !== 'owner') return reply.code(403).send({ error: 'Admin requis' });

    // Supprimer le fichier physique
    const filePath = join(UPLOAD_DIR, doc.storedName);
    await unlink(filePath).catch(() => {});
    await db.delete(documents).where(eq(documents.id, docId));

    return { ok: true };
  });
}
