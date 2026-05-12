# ADR-020: CURRICULUM and SCHEME_OF_WORK as Aliased UI Domain

**Status:** Accepted  
**Date:** 2026-Q1  
**Deciders:** Engineering Lead

---

## Context

The permission system has two separate database resources: `CURRICULUM` and `SCHEME_OF_WORK`. In practice:
- A school admin who can manage curriculum materials should obviously also be able to manage the schemes generated from those materials
- Granting `CURRICULUM: WRITE` without `SCHEME_OF_WORK: WRITE` would create a broken user experience (can upload documents but cannot see the generated output)
- Presenting both as separate toggles in the staff permission UI adds cognitive load for school owners who must configure staff access

The database must maintain both as separate records for backend granularity and potential future divergence, but the UI should not burden users with this distinction.

## Decision

In the frontend `PermissionSelector`, `CURRICULUM` and `SCHEME_OF_WORK` are treated as a **single aliased domain**: "Academics & Curriculum".

When the admin toggles the Academics & Curriculum domain:
- Any change to `CURRICULUM` permissions automatically applies the same change to `SCHEME_OF_WORK`
- Displayed as one row with one set of READ/WRITE/ADMIN toggles
- Both resources are committed to the backend simultaneously

`SCHEME_OF_WORK` is excluded from the UI's rendered resource list (`ALL_RESOURCES` array) but is still present in the `RESOURCE_INFO` dictionary to satisfy TypeScript's `Record<PermissionResource, ...>` type constraint.

## Consequences

**Positive:**
- School owners see 17 permission rows instead of 18 — reduces configuration complexity
- The aliased UX matches the logical expectation: curriculum access and scheme access are inseparable in day-to-day use
- Backend granularity is preserved — `CURRICULUM` and `SCHEME_OF_WORK` remain distinct in the database for future flexibility

**Negative:**
- It is impossible from the UI to grant access to schemes without also granting curriculum access, or vice versa. This is intentional but would need to be reconsidered if the features diverge significantly.
- The aliasing logic lives in the frontend component — if another frontend app or API consumer assigns permissions directly, they must manage both resources manually
- `SCHEME_OF_WORK` must still be present in all frontend `Record<PermissionResource, ...>` type maps even though it is never rendered directly, creating a minor maintenance burden when the dictionary is updated
