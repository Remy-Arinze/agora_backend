# Agora — AI & Background Jobs Runbook

> **For:** On-call engineers and senior developers  
> **Last Updated:** April 2026

This runbook covers the two BullMQ-based background job pipelines in Agora: the **Super Admin Curriculum Processing Pipeline** and the **School Admin Scheme of Work Generation Pipeline**.

---

## Table of Contents
1. [Queue Overview](#1-queue-overview)
2. [Monitoring Job Status](#2-monitoring-job-status)
3. [Incident: Job Stuck in QUEUED State](#3-incident-job-stuck-in-queued-state)
4. [Incident: Job Stuck in PARSING / GENERATING State](#4-incident-job-stuck-in-parsng--generating-state)
5. [Incident: All Jobs Failing (AI Errors)](#5-incident-all-jobs-failing-ai-errors)
6. [Incident: Credits Deducted but Scheme Never Generated](#6-incident-credits-deducted-but-scheme-never-generated)
7. [Startup Reconciliation (Auto-Recovery)](#7-startup-reconciliation-auto-recovery)
8. [Manual Job Operations](#8-manual-job-operations)
9. [AI Service Configuration](#9-ai-service-configuration)

---

## 1. Queue Overview

| Queue Name | Redis Key Prefix | Processors | Concurrency |
|-----------|-----------------|-----------|-------------|
| `curriculum-processing` | `bull:curriculum-processing` | `curriculum.processor.ts`, `scheme-of-work.processor.ts` | 1 |
| `curriculum-consolidation` | `bull:curriculum-consolidation` | `curriculum.processor.ts` | 1 |

Both queues share the same Redis instance (configured via `REDIS_*` env vars).

**Job Names in `curriculum-processing`:**
| Job Name | Handler | Purpose |
|----------|---------|---------|
| `process-source` | `CurriculumProcessor` | Parse uploaded PDF/DOCX into structured JSON |
| `generate-scheme` | `SchemeOfWorkProcessor` | Generate single-term scheme of work via LLM |
| `generate-yearly-scheme` | `SchemeOfWorkProcessor` | Generate full 3-term year plan via single LLM call |

**Job Name in `curriculum-consolidation`:**
| Job Name | Handler | Purpose |
|----------|---------|---------|
| `consolidate-batch` | `CurriculumProcessor` | Merge approved sources into AgoraCurriculum |

---

## 2. Monitoring Job Status

**BullMQ Dashboard (Development Only):**
```
http://localhost:4000/admin/queues
```
Shows live queue depth, active jobs, failed jobs, and completed jobs.

**Database State Checks:**

Check for stuck curriculum sources (Super Admin pipeline):
```sql
-- Sources stuck in PARSING for more than 5 minutes
SELECT id, "fileName", status, "updatedAt"
FROM "AgoraCurriculumSource"
WHERE status = 'PARSING'
AND "updatedAt" < NOW() - INTERVAL '5 minutes';
```

Check for stuck schemes (School Admin pipeline):
```sql
-- Schemes stuck in QUEUED or GENERATING for more than 10 minutes
SELECT id, "schoolId", status, "createdAt", "updatedAt"
FROM "SchemeOfWork"
WHERE status IN ('QUEUED', 'VERIFYING', 'GENERATING')
AND "updatedAt" < NOW() - INTERVAL '10 minutes';
```

---

## 3. Incident: Job Stuck in QUEUED State

**Symptom:** School Admin sees "Generating..." spinner indefinitely. DB shows `QUEUED`, no active BullMQ jobs.

**Cause:** Redis connection dropped between the API enqueuing the job and the worker picking it up. Or the worker process crashed.

**Resolution:**

Option A — Restart the API server. Startup reconciliation (see Section 7) will automatically re-queue all `PENDING_PARSE` sources and reset `PARSING` sources to `FAILED`. For `SchemeOfWork`, manual re-trigger is required.

Option B — Manual re-queue for Scheme of Work (School Admin can retry from the UI if a "Retry" button is available on FAILED schemes).

Option C — Direct database fix if the school admin cannot retry:
```sql
-- Reset to FAILED so the UI shows an actionable error state
UPDATE "SchemeOfWork"
SET status = 'FAILED', "updatedAt" = NOW()
WHERE id = '<schemeId>' AND status = 'QUEUED';
```
Refund credits manually if needed.

---

## 4. Incident: Job Stuck in PARSING / GENERATING State

**Symptom:** Status has been `PARSING` or `GENERATING` for over 10 minutes and never moves.

**Cause:** The worker process died mid-job. The job is in `active` state in Redis but the worker is gone. BullMQ will not automatically clean these — they block queue slots indefinitely.

**Resolution:**

1. Restart the API server. The `onModuleInit()` startup routine in `AgoraCurriculumService` will:
   - Move all `active` BullMQ jobs → `failed`
   - Reset all `PARSING` DB records → `FAILED`
   - Re-queue all `PENDING_PARSE` sources

2. For `GENERATING` Scheme of Work records (not covered by startup reconciliation):
```sql
UPDATE "SchemeOfWork"
SET status = 'FAILED', "updatedAt" = NOW()
WHERE status = 'GENERATING'
AND "updatedAt" < NOW() - INTERVAL '10 minutes';
```
Then refund credits if applicable.

---

## 5. Incident: All Jobs Failing (AI Errors)

**Symptom:** Multiple scheme generations failing within a short window.

**Check logs for:**
- `Azure OpenAI rate limit exceeded` — wait and retry. Raise deployment quota if persistent.
- `VERIFICATION_FAILED` — LLM returned output that failed our structural validation. The curriculum input document may be malformed. No retry; the job is discarded. Credits partially refunded (verification fee kept).
- `JSON parse error` in AI response — LLM returned invalid JSON. Usually transient. BullMQ will retry up to the configured `attempts` count.
- `Authentication failed` / `401` from Azure OpenAI — check `AZURE_OPENAI_API_KEY` and key expiry.

**Refund Policy (auto-applied by `SchemeOfWorkProcessor.onFailed()`):**
- `VERIFICATION_FAILED`: Refund all credits except 5 (verification fee)
- `MAX_RETRIES_EXCEEDED` (platform failure): Refund 100% of credits

---

## 6. Incident: Credits Deducted but Scheme Never Generated

**Symptom:** School admin reports credits were consumed but no scheme appeared.

**Investigation:**
```sql
-- Find the scheme
SELECT s.id, s.status, s."schoolId", s."createdAt",
       sub.aiCredits, sub."aiCreditsUsed"
FROM "SchemeOfWork" s
JOIN "Subscription" sub ON sub."schoolId" = s."schoolId"
WHERE s."schoolId" = '<schoolId>'
ORDER BY s."createdAt" DESC
LIMIT 10;
```

**If status = FAILED:**
The auto-refund should have already run. Check `Subscription.aiCreditsUsed` — if credits were not refunded, manually refund:
```sql
UPDATE "Subscription"
SET "aiCreditsUsed" = "aiCreditsUsed" - <creditsToRefund>,
    "updatedAt" = NOW()
WHERE "schoolId" = '<schoolId>';
```

**If status = QUEUED and no BullMQ job exists:**
The job was lost from Redis. Reset status and trigger regeneration, or refund credits and delete the stale SchemeOfWork.

---

## 7. Startup Reconciliation (Auto-Recovery)

Every time the API server starts, `AgoraCurriculumService.onModuleInit()` runs the following:

```
Step 1: Find all BullMQ jobs in 'active' state
        → Move each to 'failed' (they'll never complete without a worker)

Step 2: Reset all AgoraCurriculumSource records with status = PARSING
        → Set to FAILED with message "Worker crashed — process was reset on server restart"

Step 3: Drain the entire curriculum-processing queue (remove all waiting jobs)
        Re-queue all PENDING_PARSE AgoraCurriculumSource records from the database
```

This makes the queue and database **eventually consistent** on every restart, preventing phantom jobs and stuck records from accumulating over time.

> **Note:** This only covers the `AgoraCurriculumSource` (Super Admin) pipeline. `SchemeOfWork` records stuck in `QUEUED` or `GENERATING` must be manually reset.

---

## 8. Manual Job Operations

### Force-fail and re-queue a specific source
Using BullMQ Dashboard at `/admin/queues` — click into the job and use "Fail" or "Retry" buttons.

### Clean completed/failed jobs older than 24 hours
BullMQ is configured with `removeOnComplete: true` and `removeOnFail: { count: 100 }`, so completed jobs are removed automatically and only the last 100 failures are retained.

### Add a job directly via code (for emergency re-processing)
```typescript
// In a NestJS context where you have access to the queue
await curriculumQueue.add('process-source', {
  sourceId: '<sourceId>',
  batchId: '<batchId>',
}, { priority: 1, removeOnComplete: true, removeOnFail: { count: 100 } });
```

---

## 9. AI Service Configuration

**Primary LLM (Scheme & Consolidation generation):**
- Provider: Azure OpenAI
- Model: `gpt-4.1-mini` (configured via `AZURE_OPENAI_DEPLOYMENT`)
- Endpoint: `AZURE_OPENAI_ENDPOINT`
- API Version: `AZURE_OPENAI_API_VERSION`

**Embedding Model (KnowledgeChunk vector store):**
- Provider: Azure OpenAI (separate resource)
- Model: `text-embedding-3-small`
- Endpoint: `Azure_OPENAI_EMBEDDING_ENDPOINT`
- Dimensions: 1536 (stored in `KnowledgeChunk.embedding` as pgvector)

**Token–Credit Conversion:**
```
credits_charged = (total_tokens / 1_000_000) * AGORA_CREDITS_PER_1M_TOKENS
```
Default: 1000 credits per 1M tokens. Override via environment variable.

**Prompt Chain Overview:**
1. `parseCurriculumSource()` — Extracts weeks, topics, objectives, activities from raw document text
2. `consolidateCurriculum()` — Merges multiple parsed sources, deduplicates, and restructures into a canonical 3-term 39-week curriculum
3. `generateSchemeOfWork()` — Takes a curriculum topic list + school context and produces a teacher-ready weekly scheme
4. `generateYearlySchemeOfWork()` — Single prompt that produces all 3 terms' worth of scheme content simultaneously (3× more efficient than 3 separate calls)
