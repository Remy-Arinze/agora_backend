# ADR Index — Agora Platform

Architecture Decision Records capture significant technical decisions, their context, and the reasoning behind them. Each ADR is immutable after acceptance — new decisions supersede old ones via new ADRs.

## Format
Each ADR contains: **Status · Context · Decision · Consequences**

---

| # | Title | Status | Date |
|---|-------|--------|------|
| [ADR-001](adr/001-multi-tenancy-schoolid-not-schema.md) | Multi-Tenancy via SchoolId Column (Not DB Schema Per Tenant) | Accepted | 2025-Q1 |
| [ADR-002](adr/002-mandatory-otp-login.md) | Mandatory OTP Step on Every Login | Accepted | 2025-Q1 |
| [ADR-003](adr/003-single-user-table-with-profile-tables.md) | Single User Table with Role-Specific Profile Tables | Accepted | 2025-Q1 |
| [ADR-004](adr/004-bullmq-redis-for-background-jobs.md) | BullMQ + Redis for Background Job Processing | Accepted | 2025-Q2 |
| [ADR-005](adr/005-azure-openai-over-openai-direct.md) | Azure OpenAI as Primary AI Provider | Accepted | 2025-Q2 |
| [ADR-006](adr/006-prisma-orm.md) | Prisma ORM Over TypeORM | Accepted | 2025-Q1 |
| [ADR-007](adr/007-database-stored-permissions.md) | Database-Stored Granular RBAC Over Code-Based Roles | Accepted | 2025-Q2 |
| [ADR-008](adr/008-hierarchical-permission-cascading.md) | Hierarchical Permission Cascading (ADMIN > WRITE > READ) | Accepted | 2026-Q1 |
| [ADR-009](adr/009-principal-role-as-string.md) | Principal Role Stored as String (Not Enum) | Accepted | 2025-Q2 |
| [ADR-010](adr/010-public-id-login.md) | Public ID as Alternative Login Credential | Accepted | 2025-Q2 |
| [ADR-011](adr/011-cloudinary-for-file-storage.md) | Cloudinary for File Storage | Accepted | 2025-Q1 |
| [ADR-012](adr/012-nextjs-app-router.md) | Next.js 14 App Router (Over Pages Router) | Accepted | 2025-Q1 |
| [ADR-013](adr/013-rtk-query-api-layer.md) | RTK Query for Frontend API Layer | Accepted | 2025-Q1 |
| [ADR-014](adr/014-yearly-scheme-single-llm-call.md) | Generate Full Academic Year in One LLM Call | Accepted | 2026-Q1 |
| [ADR-015](adr/015-startup-queue-reconciliation.md) | Startup Queue Reconciliation Pattern | Accepted | 2025-Q3 |
| [ADR-016](adr/016-swagger-disabled-in-production.md) | Swagger API Docs Disabled in Production | Accepted | 2025-Q2 |
| [ADR-017](adr/017-tac-student-transfer-system.md) | TAC (Transfer Access Code) for Student Transfers | Accepted | 2025-Q2 |
| [ADR-018](adr/018-isactive-soft-deletes.md) | Soft Deletes via isActive Flag (Not Hard Deletes) | Accepted | 2025-Q1 |
| [ADR-019](adr/019-two-tier-curriculum-pipeline.md) | Two-Tier Curriculum Pipeline: Super Admin + School Admin | Accepted | 2025-Q3 |
| [ADR-020](adr/020-curriculum-scheme-permission-alias.md) | CURRICULUM and SCHEME_OF_WORK as Aliased UI Domain | Accepted | 2026-Q1 |
| [ADR-021](adr/021-event-driven-retention-pipeline.md) | Event-Driven Architecture for Retention & Engagement Pipeline | Accepted | 2026-Q2 |
| [ADR-022](adr/022-modular-prisma-schema.md) | Modular Prisma Schema Architecture | Accepted | 2026-Q2 |

