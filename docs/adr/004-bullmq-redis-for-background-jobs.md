# ADR-004: BullMQ + Redis for Background Job Processing

**Status:** Accepted  
**Date:** 2025-Q2  
**Deciders:** Engineering Lead

---

## Context

The curriculum pipeline requires long-running, resource-intensive operations (PDF parsing, LLM calls for scheme generation) that cannot complete within a standard HTTP request timeout (~30s). Alternatives considered:

1. **Synchronous HTTP with long timeouts** — not viable; Azure App Service has a hard limit and LLM calls for yearly schemes take 60–120 seconds
2. **NestJS built-in `@nestjs/schedule` cron jobs** — polling-based, not event-driven; poor fit for ad-hoc, per-request jobs
3. **Trigger.dev** — cloud-native background job platform; adds external service dependency and cost
4. **BullMQ + Redis** — mature, battle-tested queue library for Node.js; integrates natively with NestJS via `@nestjs/bullmq`

## Decision

We use **BullMQ** backed by **Redis** for all background processing. Two queues are defined: `curriculum-processing` and `curriculum-consolidation`.

BullMQ was chosen over alternatives because:
- Native NestJS integration (`@nestjs/bullmq`) with decorator-based processors
- Redis is already needed for other potential caching; co-locating queue storage adds no new infrastructure in production
- Built-in retry logic, dead letter handling, job priority, and concurrency control
- Bull Board (`@bull-board/nestjs`) provides a free inspection UI at `/admin/queues`
- Self-hosted — no third-party service dependency for core curriculum pipeline

## Consequences

**Positive:**
- Decouples the HTTP response from expensive computation — the API returns immediately with a job ID / status
- Job retry, concurrency limits, and priority queues are built-in
- Workers and API can be scaled independently
- Real-time job status visible to users (polling against DB status fields)

**Negative:**
- Redis is a required infrastructure dependency. No Redis = no background jobs. In production this is Azure Cache for Redis.
- Worker and API share the same NestJS process by default. Under extreme load they compete for CPU. Future mitigation: extract workers to a separate process.
- On deployment/restart, jobs in `active` state in Redis are orphaned. Addressed by the startup reconciliation pattern (see ADR-015).
