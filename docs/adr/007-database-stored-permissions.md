# ADR-007: Database-Stored Granular RBAC Over Code-Based Roles

**Status:** Accepted  
**Date:** 2025-Q2  
**Deciders:** Engineering Lead, Product

---

## Context

School Admin access control initially worked on a coarse role check: if you have role `SCHOOL_ADMIN`, you can access everything. This was insufficient because schools have staff with different responsibilities (HR manager, academic coordinator, finance officer) who should only see relevant sections.

Two approaches were considered:
1. **Code-based RBAC presets** — define a fixed set of roles in code (e.g. `ACADEMIC_ADMIN`, `HR_ADMIN`), each with hardcoded permission sets
2. **Database-stored per-resource, per-type permissions** — store a `Permission` table (resource × type) and a `StaffPermission` join table linking each admin to their granted permissions

## Decision

**Database-stored granular permissions** via the `Permission` and `StaffPermission` models.

The permission matrix is: **18 resources × 3 types = 54 possible permission combinations** per admin.

Resources: `OVERVIEW, ANALYTICS, SUBSCRIPTIONS, STUDENTS, STAFF, CLASSES, SUBJECTS, TIMETABLES, CALENDAR, ADMISSIONS, SESSIONS, EVENTS, GRADES, CURRICULUM, SCHEME_OF_WORK, RESOURCES, TRANSFERS, INTEGRATIONS`

Types: `READ | WRITE | ADMIN`

Permissions are seeded (`npm run db:seed`) and assigned to admins through the UI. Principal-role admins bypass the permission system entirely.

## Consequences

**Positive:**
- School owners can create fine-grained access control without developer involvement
- Permissions are auditable — the database records exactly what each admin is allowed to do
- Adding new resources only requires adding a new enum value + seeding — no code changes to the permission model
- Supports future RBAC preset feature (batch-assign common configurations) without architecture changes

**Negative:**
- Every permission check on a non-principal admin requires a database lookup. Mitigated by loading all permissions at auth time and caching in the request context.
- The 54-permission matrix can be overwhelming to configure manually for each staff member. Mitigation: UI groups permissions by domain and UI aliasing reduces apparent complexity.
- Permission records must be seeded before any assignment is possible. A missing seed will silently prevent permission assignment.
