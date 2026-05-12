# ADR 021: Event-Driven Architecture for Retention & Engagement Pipeline

**Date:** April 29, 2026  
**Status:** Accepted  
**Context:**  
Agora needs a way to send lifecycle nudges, feature discovery emails, and custom promotional campaigns to School Admins (Principals). Historically, systems often solve this by implementing massive, uniform, daily cron jobs that scan the entire database for inactive states (e.g., "Find all schools created > 24 hours ago with 0 students and email them"). This cron approach creates a poor user experience, sends messages out of context, and leads to massive query spikes at scheduled times. Furthermore, Super Admins need a targeted way to dispatch custom email campaigns to `ALL_SCHOOLS` or `SPECIFIC_SCHOOLS` without causing rate limit bottlenecks.

**Decision:**  
We will implement an **Event-Driven, Delayed-Queue Architecture** for the Retention & Engagement Pipeline, leveraging `@nestjs/event-emitter` and `BullMQ`.

1. **Event Triggers (Telemetry):** Instead of sweeping the DB on a timer, domain actions (e.g., `school.verified`) emit events via `@nestjs/event-emitter`.
2. **Delayed Playbooks:** Listeners catch these events and enqueue *delayed* jobs in BullMQ (e.g., a Day 1, Day 2, and Day 3 job delayed by exactly 24h, 48h, and 72h).
3. **Just-In-Time Evaluation:** When the delayed job executes, the worker checks the *current* state of the school in the database (e.g., `sessionCount === 0?`). If the user has already completed the action, the job exits silently. If not, the nudge is sent.
4. **Campaign Engine:** Super Admin campaigns are modeled as a `Campaign` record in Prisma. Activating a campaign enqueues a `dispatch-campaign` job to BullMQ to handle iteration and sending asynchronously.
5. **Idempotency (NotificationLog):** Before sending any email/nudge, the system queries the `NotificationLog` to ensure the specific user hasn't already received that specific type of nudge, preventing spam.

**Consequences:**  
- **Pros:** 
  - Highly contextual and personalized timing (48 hours after *their* specific activation, not 8 AM for everyone).
  - Removes the need for heavy, DB-sweeping cron queries.
  - Scales effortlessly; BullMQ manages concurrency and failures.
  - Cleanly decouples domain logic (e.g., `TeacherService`) from marketing logic (EngagementService) via the Event Emitter.
- **Cons:** 
  - Relies heavily on Redis up-time (if Redis crashes and loses delayed jobs, nudges might be missed unless we implement a reconciliation script).
  - Logic is spread across event emitters, services, and queue processors, requiring developers to trace the flow.
