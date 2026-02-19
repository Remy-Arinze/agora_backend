# Agora Backend (standalone)

Single-package NestJS API with Prisma. Flat structure: `src/` (NestJS), `prisma/` (schema, migrations, seed).

## Setup

1. Copy `.env.example` to `.env` in this directory. Fill in values (DB_URL, JWT_SECRET, etc.).
2. `npm install --legacy-peer-deps`
3. `npm run db:generate`
4. `npm run db:migrate`
5. `npm run dev`

## Scripts

- `npm run dev` – start API in dev mode
- `npm run build` – Prisma generate + Nest build
- `npm run start:prod` – run production build
- `npm run db:generate` – Prisma generate
- `npm run db:migrate` – Prisma migrate dev
- `npm run db:studio` – Prisma Studio
- `npm run db:seed` – seed database

## Docker

- **Build and run the API only** (expects `DB_URL` to point to an existing Postgres):
  ```bash
  docker build -t agora-backend .
  docker run -p 4000:4000 --env-file .env agora-backend
  ```
  The container runs `prisma migrate deploy` on startup when `DB_URL` is set, then starts the API.

- **Run API + Postgres with Docker Compose:**
  ```bash
  cp .env.example .env   # optional: set JWT_SECRET, FRONTEND_URL, etc.
  docker compose up -d
  ```
  API is at `http://localhost:4000`. Postgres uses user/pass/db `agora`/`agora`/`agora` (set in `docker-compose.yml`). To use Redis for BullMQ, uncomment the `redis` service and set `REDIS_HOST=redis` in `.env`.
