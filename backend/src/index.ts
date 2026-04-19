import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import 'dotenv/config';

import { scheduleCleanup } from './utils/cleanup.js';
import { authRoutes } from './routes/auth.js';
import { housesRoutes } from './routes/houses.js';
import { messagesRoutes } from './routes/messages.js';
import { reservationsRoutes } from './routes/reservations.js';
import { usersRoutes } from './routes/users.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
});
await app.register(helmet, {
  contentSecurityPolicy: false,       // géré côté front via Vite
  crossOriginEmbedderPolicy: false,   // bloquerait les requêtes API
  crossOriginResourcePolicy: false,   // idem
});
await app.register(rateLimit, {
  global: false, // activé uniquement sur les routes qui le demandent explicitement
});
await app.register(cookie);
await app.register(websocket);

await app.register(authRoutes);
await app.register(housesRoutes);
await app.register(messagesRoutes);
await app.register(reservationsRoutes);
await app.register(usersRoutes);

app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
console.log(`🏠 FamilyNest backend → http://localhost:${port}`);

scheduleCleanup();
