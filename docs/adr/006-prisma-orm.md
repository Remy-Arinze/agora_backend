# ADR-006: Prisma ORM Over TypeORM

**Status:** Accepted  
**Date:** 2025-Q1  
**Deciders:** Engineering Lead

---

## Context

NestJS supports multiple database ORMs. The two most common for TypeScript/NestJS projects are TypeORM and Prisma. The choice needed to support PostgreSQL, complex relations, migrations, and a single developer initially moving fast.

**TypeORM:** Decorator-based entity definitions, long history with NestJS, powerful but verbose.  
**Prisma:** Schema-first (`schema.prisma`), generates fully-typed client, first-class PostgreSQL support including pgvector.

## Decision

**Prisma** is used as the ORM.

The schema is defined in `prisma/schema.prisma` (1990 lines at time of writing, ~60 models and enums). Migrations are managed with `prisma migrate`. The generated Prisma client (`@prisma/client`) provides complete type safety from schema to query.

## Consequences

**Positive:**
- Single source of truth for the data model — `schema.prisma` is the canonical definition
- Generated client is fully typed — query auto-completion and compile-time type errors catch database mistakes early
- `prisma migrate` with built-in diff detection is safer than TypeORM's `synchronize: true` footguns
- Native pgvector support (`Unsupported("vector(1536)")`) for `KnowledgeChunk` embeddings — would require raw SQL with TypeORM
- Prisma Studio provides a GUI for database inspection without a separate tool

**Negative:**
- Prisma requires regenerating the client (`prisma generate`) after every schema change — an extra step in the CI/CD pipeline (handled in `azure-pipelines.yml`)
- N+1 query problem is less obvious than with TypeORM's eager loading — requires intentional use of `include` and `select`
- Complex raw queries require `prisma.$queryRaw` with template literals, which loses some type safety
- Prisma versions must be kept in sync between `prisma` CLI and `@prisma/client` — mismatches cause runtime errors
