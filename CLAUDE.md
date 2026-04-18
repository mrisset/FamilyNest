# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FamilyNest** is a family/household management platform. It is a monorepo with two independent packages: `backend/` (Fastify + Drizzle ORM + PostgreSQL) and `frontend/` (React + Vite + TanStack Query). Each has its own `package.json` and must be run separately.

## Commands

### Backend (`cd backend`)
```bash
npm run dev          # Start dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript
npm run db:push      # Apply schema to PostgreSQL (non-destructive)
npm run db:studio    # Open Drizzle Studio (DB web UI)
```

### Frontend (`cd frontend`)
```bash
npm run dev          # Start Vite dev server on port 5173
npm run build        # TypeScript check + production build
npm run preview      # Preview production build
```

No test suite is currently configured.

## Environment Setup

Backend requires a `.env` file (see `backend/.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — defaults to 3001
- `FRONTEND_URL` — for CORS, defaults to `http://localhost:5173`

Frontend proxies `/api` and `/ws` to `http://localhost:3001` via Vite config — no env file needed for local dev.

## Architecture

### Backend (`backend/src/`)
- **`index.ts`** — Fastify server entry: registers CORS, cookies, WebSockets, multipart, then mounts all route modules
- **`db/schema.ts`** — Single source of truth for the database schema (Drizzle ORM). All tables, enums, and relations defined here
- **`middleware/auth.ts`** — Bearer token auth: hashes token with SHA256, looks up session, validates expiry (30 days), injects `req.user`
- **`routes/`** — One file per domain: `auth`, `users`, `houses`, `messages`, `reservations`, `documents`

Key patterns:
- Auth uses session tokens (not JWTs) stored hashed in the `sessions` table
- WebSocket chat in `messages.ts` uses an in-memory `Map<channelId, Set<WebSocket>>` for room tracking — this resets on server restart
- File uploads go to `./uploads/` on disk with UUID filenames; only metadata is stored in DB
- Role-based access: `admin` vs `member` per house (stored in `house_members.role`)
- Password changes in `users.ts` revoke ALL sessions and return a new token

### Frontend (`frontend/src/`)
- **`App.tsx`** — Router setup. `RequireAuth` wraps protected routes; redirects to `/login` if no token
- **`store/auth.ts`** — Zustand store persisted to `localStorage` (`fn_user`, `fn_token`)
- **`lib/api.ts`** — Axios instance with `/api` base URL; auto-injects `Authorization: Bearer` header; clears token on 401
- **`pages/HousePage.tsx`** — Main feature hub: tabbed UI for chat, reservations, members, documents, and house info
- **`components/ChatPanel.tsx`** — WebSocket client with 3s auto-reconnect; merges fetched history with live messages, deduped by ID

Data fetching uses TanStack React Query (30s staleTime). Mutations use `useMutation` + `queryClient.invalidateQueries`.

### Database Schema (key relationships)
```
users → sessions (1:N)
houses → house_members → users (N:M, with role)
houses → channels → messages → users (author)
houses → invitations → users
houses → reservations → users (requestedBy, reviewedBy)
houses → documents → users (uploadedBy)
```

## Design System

- **Colors**: Stone (neutral) + Amber (accent)
- **Fonts**: DM Sans (body), Fraunces (headings) — loaded from Google Fonts
- **Utility classes** defined in `frontend/src/index.css`: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.input`, `.card`
- Channel flags (`discussion`, `problem`, `maintenance`, `announcement`, `other`) have associated icons/colors defined in `frontend/src/lib/api.ts` as `FLAG_ICONS`, `FLAG_COLORS`, `FLAG_LABELS`
