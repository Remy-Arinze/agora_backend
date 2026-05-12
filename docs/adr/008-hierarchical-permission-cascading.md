# ADR-008: Hierarchical Permission Cascading (ADMIN > WRITE > READ)

**Status:** Accepted  
**Date:** 2026-Q1  
**Deciders:** Engineering Lead

---

## Context

Under the flat permission model, an admin needed explicit `READ`, `WRITE`, and `ADMIN` records assigned separately to properly access a resource at different levels. This meant:
- 3 database records per resource to grant full access
- School owners had to manually assign all three for every resource they wanted an admin to fully control
- A user with `WRITE` permission could not view (`READ`) a resource unless they also had an explicit `READ` record

This created permission bloat and frequent misconfiguration where admins could create but not view records.

## Decision

Implement **hierarchical permission cascading** in `PermissionGuard`:

```
ADMIN access  → satisfies ADMIN, WRITE, and READ requirements
WRITE access  → satisfies WRITE and READ requirements  
READ access   → satisfies only READ requirements
```

The guard now checks: "does the user hold a permission at the required level **or higher**?" rather than "does the user hold exactly this permission level?"

## Consequences

**Positive:**
- Granting `WRITE` to a resource is intuitive — the admin can both see and edit
- Granting `ADMIN` to a resource is complete — the admin has full control without additional READ/WRITE records
- Dramatically reduces the number of permission records needed per admin
- Eliminates the class of bug where an admin can create but not view records

**Negative:**
- Admins can no longer have write-only or admin-only access without read — this is acceptable as it was never a desirable configuration
- The cascading logic lives only in `PermissionGuard`. Any custom permission check bypassing the guard (e.g. inline service-level checks) must implement the same cascade logic manually

**Supersedes:** The old flat exact-match check in `PermissionGuard`
