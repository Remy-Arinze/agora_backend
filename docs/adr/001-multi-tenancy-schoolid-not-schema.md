# ADR-001: Multi-Tenancy via SchoolId Column (Not DB Schema Per Tenant)

**Status:** Accepted  
**Date:** 2025-Q1  
**Deciders:** Engineering Lead

---

## Context

Agora is a multi-tenant SaaS platform where each school is an isolated tenant. Two common approaches exist for multi-tenancy in relational databases:

1. **Schema-per-tenant:** Each school gets its own Postgres schema (e.g. `school_abc.*`, `school_xyz.*`).
2. **Shared schema with tenant column:** All schools share the same tables; every row has a `schoolId` foreign key.

The platform needs to support hundreds of schools with the ability to cross-query (e.g. analytics, transfers, super admin views) and must remain maintainable by a small team.

## Decision

We use the **shared schema with `schoolId` column** approach. Every school-scoped table has a `schoolId` column, and all queries are filtered by it.

Tenant context is injected by the `TenantMiddleware` from the JWT claim at request time and validated by `SchoolDataAccessGuard` against the route parameter.

## Consequences

**Positive:**
- Single Prisma schema — one migration affects all tenants simultaneously
- Cross-tenant queries (transfers, analytics, super admin) are natural SQL joins
- Dramatically simpler deployment and maintenance (no schema management per customer)
- Connection pooling is straightforward — one pool serves all tenants

**Negative:**
- Accidental data leakage is possible if `schoolId` filter is omitted from a query. Mitigated by `SchoolDataAccessGuard` and code review discipline.
- A single noisy school can impact query performance for others. Mitigated by database index per `schoolId` on every major table and query optimization with Prisma.
- Regulatory requirements for strict data isolation per tenant would require reconsideration. Not currently required for the Nigerian education market.
