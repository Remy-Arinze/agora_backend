# ADR-003: Single User Table with Role-Specific Profile Tables

**Status:** Accepted  
**Date:** 2025-Q1  
**Deciders:** Engineering Lead

---

## Context

The platform has multiple distinct user types: Super Admin, School Admin, Teacher, Student, Parent. Two modelling approaches were considered:

1. **Separate user tables per role** — `SchoolAdminUser`, `TeacherUser`, `StudentUser`, etc., each with their own auth credentials
2. **Single `User` table as authentication anchor** + role-specific profile tables (`SchoolAdmin`, `Teacher`, `Student`, `Parent`) linked via `userId`

## Decision

We use a **single `User` table** as the authentication and identity anchor. Role-specific information lives in dedicated profile tables (`Student`, `Teacher`, `SchoolAdmin`, `Parent`), each with a `userId` foreign key.

The `User.role` enum (`SUPER_ADMIN | SCHOOL_ADMIN | TEACHER | STUDENT`) determines which profile table is authoritative.

A person can hold multiple roles simultaneously — e.g. a `Teacher` in School A can also be a `SchoolAdmin` in School B. This is supported because `Teacher` and `SchoolAdmin` are arrays on `User`, not single relations.

## Consequences

**Positive:**
- A single authentication flow handles all roles — same login endpoint, same JWT structure
- Password reset, OTP, and session management are unified — no duplication
- Cross-role identity is natural (the single `User.id` is a permanent global identifier)
- The "chain of trust" concept (student identity travels across schools) is cleanly modelled — `Student.uid` is permanent regardless of which school a student is at

**Negative:**
- `User.role` is a single enum value, which doesn't perfectly reflect multi-role reality. In practice, a person who is both a teacher and an admin logs in as one role (the primary one). Managing the "primary role" for login context is handled by JWT claim priority logic.
- Including all profile relations on every auth query adds overhead. Mitigated by selecting only what is needed per role.
