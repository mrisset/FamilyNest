# 🏠 FamilyNest

Plateforme familiale privée : maisons, chats multi-canaux, réservations.

---

## Prérequis

- **Node.js** 20+ → https://nodejs.org
- **PostgreSQL** 15+ → https://www.postgresql.org/download/
- **pnpm** (optionnel mais conseillé) : `npm install -g pnpm`

---

## 1. Base de données

### Installer PostgreSQL (macOS)
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Installer PostgreSQL (Ubuntu/Debian)
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Créer la base
```bash
psql -U postgres
```
```sql
CREATE DATABASE familynest;
CREATE USER familynest_user WITH PASSWORD 'monmotdepasse';
GRANT ALL PRIVILEGES ON DATABASE familynest TO familynest_user;
\q
```

---

## 2. Backend

```bash
cd backend
cp .env.example .env
```

Éditez `.env` :
```env
DATABASE_URL=postgresql://familynest_user:monmotdepasse@localhost:5432/familynest
JWT_SECRET=une-longue-chaine-aleatoire-ici-changez-moi
PORT=3001
FRONTEND_URL=http://localhost:5173
```

```bash
npm install

# Crée toutes les tables en base
npm run db:push

# Lance le serveur en mode développement (hot reload)
npm run dev
```

Le backend tourne sur → http://localhost:3001
Vérification : http://localhost:3001/health doit retourner `{"status":"ok"}`

---

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

L'app tourne sur → http://localhost:5173

---

## Structure du projet

```
familynest/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Point d'entrée Fastify
│   │   ├── db/
│   │   │   ├── index.ts      # Connexion Drizzle
│   │   │   └── schema.ts     # Schéma complet (tables, relations, enums)
│   │   ├── middleware/
│   │   │   └── auth.ts       # Middleware d'authentification
│   │   └── routes/
│   │       ├── auth.ts       # /auth/register, /auth/login, /auth/logout
│   │       ├── houses.ts     # CRUD maisons, invitations, canaux
│   │       ├── messages.ts   # Historique + WebSocket temps réel
│   │       └── reservations.ts # CRUD réservations
│   ├── drizzle.config.ts
│   ├── .env.example
│   └── package.json
│
└── frontend/
    └── src/
        ├── App.tsx            # Router principal
        ├── main.tsx           # Point d'entrée React
        ├── index.css          # Tailwind + classes custom
        ├── lib/
        │   └── api.ts         # Client Axios + types TypeScript
        ├── store/
        │   └── auth.ts        # Store Zustand (user, token)
        └── pages/
            ├── LoginPage.tsx
            ├── RegisterPage.tsx
            ├── DashboardPage.tsx  # Liste des maisons
            ├── HousePage.tsx      # Chat + Réservations + Membres
            └── JoinPage.tsx       # Rejoindre via token
        └── components/
            ├── ChatPanel.tsx         # Chat WebSocket temps réel
            ├── ReservationsPanel.tsx # Gestion des réservations
            └── MembersPanel.tsx      # Membres + génération d'invitations
```

---

## Flux d'utilisation

### Créer un compte et une maison
1. Aller sur http://localhost:5173/register
2. Créer un compte
3. Sur le dashboard, cliquer "Nouvelle maison"
4. Vous êtes automatiquement admin de la maison créée

### Inviter quelqu'un
1. Ouvrir la maison → onglet "Membres"
2. Cliquer "Générer un lien" (admin seulement)
3. Copier et partager le lien
4. La personne crée un compte puis visite le lien → elle rejoint la maison

### Chat
- Onglet "Chat" → sidebar gauche avec les canaux
- Admins : cliquer "+" pour créer un canal avec un flag (Discussion, Problème, Maintenance, Annonce)
- Messages en temps réel via WebSocket

### Réservations
- Onglet "Réservations" → "Demander" pour soumettre
- Admins voient les boutons Approuver / Refuser
- Le demandeur peut annuler une réservation en attente

---

## Déboguer

### Problème de connexion à la base
```bash
# Tester la connexion
psql postgresql://familynest_user:monmotdepasse@localhost:5432/familynest

# Voir les tables créées
\dt

# Quitter
\q
```

### Voir les logs du backend
Le backend utilise le logger Fastify — toutes les requêtes apparaissent dans le terminal.
En cas d'erreur 500, le message complet est affiché.

### Inspecter la base avec Drizzle Studio
```bash
cd backend
npm run db:studio
```
Ouvre une interface web sur http://local.drizzle.studio

### Erreur CORS
Vérifiez que `FRONTEND_URL=http://localhost:5173` dans le `.env` du backend.

### WebSocket ne se connecte pas
- Vérifiez que le backend tourne bien (`/health`)
- Le proxy Vite (`vite.config.ts`) redirige `/ws/*` vers le backend
- Ouvrez la console navigateur → onglet Network → filtre "WS"

### Réinitialiser la base
```bash
cd backend
# Supprime et recrée toutes les tables
npx drizzle-kit drop
npm run db:push
```

---

## Pour aller plus loin

| Feature | Comment faire |
|---|---|
| Upload de photos (maison, avatar) | Ajouter `@fastify/multipart` + Cloudinary/S3 |
| Notifications push | Service Worker + Web Push API |
| App mobile | Créer un projet Expo, réutiliser les mêmes appels API |
| Déploiement | Frontend → Vercel, Backend → Railway ou Render |
| Auth OAuth (Google) | Ajouter un provider dans les routes auth |
| Calendrier visuel | Ajouter `react-big-calendar` dans ReservationsPanel |
