# Agora Backend

Multi-tenant school management platform built with NestJS + Prisma + PostgreSQL.

> **API Description (from Swagger):** `Multi-Tenant Digital Education Identity Platform — Chain-of-Trust Registry`

## Quick Start

```bash
cp .env.example .env        # Fill in all required variables (see below)
npm install --legacy-peer-deps
npm run db:generate         # Generate Prisma client
npm run db:migrate          # Run database migrations
npm run db:seed             # Seed permissions table (required first run)
npm run dev                 # Start dev server on :4000
```

## Running Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Starts the API in watch mode |
| `npm run build` | Prisma generate + NestJS compile |
| `npm run start:prod` | Runs compiled production build |
| `npm run db:generate` | Regenerates Prisma client from schema |
| `npm run db:migrate` | Runs pending database migrations |
| `npm run db:studio` | Opens Prisma Studio GUI |
| `npm run db:seed` | Seeds the `Permission` table with all resource/type combinations |

## Docker

**API only** (requires external Postgres):
```bash
docker build -t agora-backend .
docker run -p 4000:4000 --env-file .env agora-backend
```
The container runs `prisma migrate deploy` on startup automatically.

**API + Postgres** (for local dev):
```bash
docker compose up -d
# API: http://localhost:4000   Postgres: agora/agora/agora
```

To enable Redis for BullMQ, uncomment the `redis` service in `docker-compose.yml` and set `REDIS_HOST=redis` in `.env`.

## Swagger / API Docs

Available in **development only** at:
- UI: `http://localhost:4000/api`
- JSON spec: `http://localhost:4000/swagger-json`

Swagger is **disabled in production** for security.

## BullMQ Dashboard

Available in development at `http://localhost:4000/admin/queues`.  
Shows live state of all background job queues (curriculum parsing, scheme generation).

## Environment Variables Reference

See [`docs/env-reference.md`](docs/env-reference.md) for a full description of every required and optional variable.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full system architecture, module breakdown, data model, AI pipeline, permission system, and deployment topology.

## Frontend Architecture Notes

- [`docs/frontend-architecture.md`](docs/frontend-architecture.md)
- [`docs/adr/ADR-0001-country-selector-regional-scoping.md`](docs/adr/ADR-0001-country-selector-regional-scoping.md)
