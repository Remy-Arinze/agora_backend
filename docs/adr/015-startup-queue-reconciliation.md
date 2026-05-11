# ADR-015: Startup Queue Reconciliation Pattern

**Status:** Accepted  
**Date:** 2025-Q3  
**Deciders:** Engineering Lead

---

## Context

BullMQ workers and the API server share the same NestJS process. When the server restarts (for a deployment, crash, or scale event), any BullMQ job that was `active` (being processed) at the time of the restart becomes a "ghost" — it exists in Redis as `active` but there is no worker processing it. It will never complete or fail on its own and permanently occupies a worker slot.

Additionally, database records that were in `PARSING` status when the crash occurred are permanently stuck — the UI shows endless spinners.

## Decision

On every application startup, `AgoraCurriculumService.onModuleInit()` runs a **reconciliation routine**:

1. Fetches all `active` BullMQ jobs from the `curriculum-processing` queue
2. Moves each to `failed` with message "Worker crashed — job reset on startup"
3. Resets all `AgoraCurriculumSource` records in `PARSING` status → `FAILED`
4. Drains the entire queue (removes all waiting/delayed jobs)
5. Re-fetches all `PENDING_PARSE` sources from the database and re-enqueues them

This makes Redis and the database **the single source of truth is the database**, not Redis — on every restart the queue is rebuilt from DB state.

## Consequences

**Positive:**
- Zero manual intervention required after a crash or deployment restart — the system self-heals
- Redis can be flushed or the queue can be cleared without data loss — the database is the authoritative record of what needs to be processed
- Eliminates the class of bug where ghost jobs block queue concurrency slots indefinitely

**Negative:**
- Startup reconciliation adds latency to API boot time proportional to the number of `PENDING_PARSE` sources (usually < 100ms in practice)
- If the server restarts mid-parse, the source is reset to `FAILED` and must be re-uploaded. The AI credits for that parse were not yet consumed (billing happens after parse), so there is no financial impact.
- This pattern only covers `AgoraCurriculumSource` (Super Admin pipeline). `SchemeOfWork` records stuck in `GENERATING` are **not** auto-recovered and require manual DB intervention. This is a known gap to be addressed.
