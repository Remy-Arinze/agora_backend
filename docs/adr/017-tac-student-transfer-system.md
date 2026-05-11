# ADR-017: TAC (Transfer Access Code) for Student Transfers

**Status:** Accepted  
**Date:** 2025-Q2  
**Deciders:** Engineering Lead, Product

---

## Context

Students in Nigeria frequently transfer between schools. The traditional process involves physical paper documents (leaving certificates, academic records), which are fragile, easy to forge, and create administrative bottlenecks.

Agora's core identity proposition is that a student's digital academic record should be **portable and verifiable** across schools. A mechanism was needed for:
- A sending school to authorize the release of a student's records
- A receiving school to securely claim those records
- Preventing unauthorized access to student data

## Decision

Implement a **Transfer Access Code (TAC)** system:

1. Only the **sending school** can initiate a transfer and generate a TAC
2. The TAC is a unique, cryptographically random code stored in `Transfer.tac`
3. The TAC expires after **30 days** (`Transfer.tacExpiresAt`)
4. The TAC is **one-time use** — once claimed, `Transfer.tacUsedAt` and `Transfer.tacUsedBy` are set and the TAC cannot be reused
5. The receiving school enters the TAC in their dashboard to claim the student's full academic history

## Consequences

**Positive:**
- The sending school retains control — they determine when and to whom a TAC is issued
- One-time use prevents brute-force TAC sharing or re-use after a transfer falls through
- 30-day expiry prevents TACs from sitting in compromised email threads indefinitely
- Verifiable chain of custody — `tacUsedBy` records which school claimed the transfer

**Negative:**
- The TAC must be communicated out-of-band (email or written) from one school to another — Agora does not have a secure messaging channel between schools yet
- If the TAC is lost, a new one must be generated (current admin: delete and re-initiate transfer)
- 30-day expiry may be too short for some administrative processes in the Nigerian school system. Configurable expiry per school was considered but deferred.
- The TAC is stored as plain text in the database (indexed for fast lookup). Future improvement: store only a hash.
