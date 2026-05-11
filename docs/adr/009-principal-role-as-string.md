# ADR-009: Principal Role Stored as String (Not Enum)

**Status:** Accepted  
**Date:** 2025-Q2  
**Deciders:** Engineering Lead

---

## Context

School Admins have a `role` field that determines their level of authority within the school. The highest authority roles (Principal, School Owner, Head Teacher) need special treatment — they bypass all permission checks and have exclusive rights to assign principal roles to others.

Two options were considered:
1. **Enum column** — a typed `AdminRole` enum with values like `SCHOOL_OWNER`, `PRINCIPAL`, `ADMINISTRATOR`
2. **String column** — store role as a free-text string, with a code-level list of "principal role" strings

## Decision

The `SchoolAdmin.role` field is stored as a **`String` column** (Prisma type), defaulting to `"Administrator"`.

A static list of canonical principal roles is maintained in `src/lib/constants/roles.ts` (frontend) and referenced in `admin.service.ts` and `permission.guard.ts` (backend):

```typescript
const PRINCIPAL_ROLES = [
  'principal', 'school_principal', 'head_teacher',
  'headmaster', 'headmistress', 'school_owner'
];
```

The `isPrincipalRole(role: string): boolean` function performs a case-insensitive match against this list.

## Consequences

**Positive:**
- Schools can assign **custom role labels** (e.g. "Vice Principal", "Dean of Academics") without requiring a database migration or enum change
- The principal check is behavioural — any string matching the known principal role keywords gets elevated access, regardless of capitalization or whitespace
- Adding a new principal-equivalent role (e.g. a new regulatory title used in a specific state) only requires updating the constant list, not the schema

**Negative:**
- Type safety is reduced — a typo in a role string that doesn't match the principal list simply becomes a standard admin role silently. Mitigated by validation in `StaffValidator` which checks role against an allowed list when creating/updating an admin.
- Reporting and analytics on roles requires string matching, not enum comparisons
- The PRINCIPAL_ROLES list must be kept in sync between frontend (`roles.ts`) and backend — currently duplicated. Future: expose via API from backend
