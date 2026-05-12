# ADR-014: Generate Full Academic Year in One LLM Call

**Status:** Accepted  
**Date:** 2026-Q1  
**Deciders:** Engineering Lead

---

## Context

When a School Admin uploads their curriculum documents and wants to generate a scheme of work for the entire academic year (3 terms × 13 weeks = 39 weeks), two approaches were possible:

1. **3 Sequential LLM calls** — call `generateSchemeOfWork()` once per term, each producing a 13-week plan
2. **1 LLM call for the full year** — a single prompt asking the model to produce all 39 weeks at once, then split the response by term

## Decision

A **single LLM call** (`generateYearlySchemeOfWork()`) generates the entire 3-term academic year simultaneously.

The prompt instructs the model to produce a JSON structure containing `term1`, `term2`, and `term3` arrays, each with 13 weeks of content. The service then splits the response and populates the three pre-created `SchemeOfWork` records.

## Consequences

**Positive:**
- **3× fewer LLM API calls** per yearly generation — lower cost and lower latency
- **Curriculum coherence:** The model can ensure topic progression across terms is logical (e.g. Term 1 topics build on in Term 2) because it sees the full year in context
- **One BullMQ job** instead of three — simpler queue management; all three schemes succeed or fail atomically
- **Better user experience** — users trigger one action and get a complete academic year plan

**Negative:**
- A single large LLM call is more likely to hit context window limits for subjects with very detailed curriculum documents. Mitigated by limiting input context size.
- If the model fails to produce properly structured JSON for one term, all three fail together. A 3-call approach would preserve the successful terms. Mitigation: JSON validation with retry on parse failure.
- The single call produces a larger response, increasing the chance of partial streaming failure. Mitigated by using non-streaming completion calls.
- `SchemeOfWorkProcessor` must handle both `generate-scheme` (single-term) and `generate-yearly-scheme` (full year) job types — adds branching logic to the processor.
