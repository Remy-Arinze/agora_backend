# ADR-018: Soft Deletes via isActive Flag (Not Hard Deletes)

**Status:** Accepted  
**Date:** 2025-Q1  
**Deciders:** Engineering Lead

---

## Context

Schools frequently need to "remove" entities — deactivate a class arm, mark a subject as no longer offered, archive a student who left mid-year. Two options:

1. **Hard delete** — permanently remove the row from the database
2. **Soft delete** — set an `isActive = false` flag and filter it out of queries

Given Agora's role as a **Chain-of-Trust identity registry**, historical data integrity is critical. A student's grade history cannot be deleted if the class or subject they were in is removed.

## Decision

Core entities use **soft deletes via `isActive` boolean** columns:
- `School.isActive`
- `ClassLevel.isActive`
- `ClassArm.isActive`
- `Subject.isActive`
- `Teacher` (no isActive — use `accountStatus` on User)
- `Enrollment.isActive`
- `Tool.isActive`
- `SchoolToolAccess.status`

Most queries filter `where: { isActive: true }` by default. Super Admin and archive views can query all records.

`onDelete: Cascade` is used for truly dependent child records (e.g. deleting a school cascades to all its admins, teachers, enrollments). This is reserved for genuinely orphaned data.

## Consequences

**Positive:**
- Grade history, attendance records, and assessments remain intact even after a class is "deleted"
- Recoverable — an admin can reactivate an accidentally deactivated record
- Audit trail — `isActive` transitions can be tracked by `updatedAt` timestamps
- Prevents referential integrity violations from cascading deletes

**Negative:**
- Queries must always include `isActive: true` filter or risk returning stale data. Missing this filter in a new query is a latent bug.
- Database grows over time with inactive records — periodic archiving or cleanup jobs may be needed at scale
- Reporting must explicitly decide whether to include inactive records (e.g. "how many students have ever been enrolled?" vs "how many are currently active?")
