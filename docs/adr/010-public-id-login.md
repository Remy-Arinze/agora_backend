# ADR-010: Public ID as Alternative Login Credential

**Status:** Accepted  
**Date:** 2025-Q2  
**Deciders:** Engineering Lead, Product

---

## Context

Nigerian schools frequently operate in environments where students and staff may not reliably remember or have access to their institutional email. Teachers and students often share devices (school lab computers, office terminals). Email-based login in these scenarios creates friction.

The system needed a way to log in that:
- Is unique per person
- Is memorable and human-readable
- Is linked to a specific school context (so the system knows which school's dashboard to load)
- Does not require personal email access at the point of login

## Decision

Every `SchoolAdmin`, `Teacher`, and `Student` is assigned a **Public ID** at creation:

```
Format: AG-{schoolabbreviation}-{6-char-alphanumeric}
Example: AG-STMARYS-X4K9P2
```

The login endpoint (`POST /auth/login`) accepts either an **email address** or a **Public ID** as the `emailOrPublicId` field. The system distinguishes them by the presence of `@`.

When a Public ID is submitted, the API resolves it in parallel across `SchoolAdmin`, `Teacher`, and `Student` tables, then proceeds with the standard OTP flow.

## Consequences

**Positive:**
- Students can log in on shared school computers using a card/printed credential without knowing their email
- The Public ID encodes school context — the system immediately knows which school the user belongs to, enabling the correct JWT claims to be issued
- Significantly reduces "forgot email" support tickets

**Negative:**
- Parallel DB lookup across three tables on every Public ID login adds ~3 concurrent queries. Acceptable at current scale; indexed via `@@index([publicId])` on each table.
- Public IDs must be printed and distributed by the school — adds an onboarding step for the school
- If a user's school abbreviation changes (e.g. school renamed), their Public ID becomes inconsistent with the name. The ID is never regenerated to preserve continuity.
