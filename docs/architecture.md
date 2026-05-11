# Agora — System Architecture

> **Version:** April 2026 | **Stack:** NestJS · Prisma · PostgreSQL · BullMQ · Redis · Azure OpenAI · Next.js 14

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Backend Module Map](#3-backend-module-map)
4. [Data Model (Entity Relationships)](#4-data-model-entity-relationships)
5. [Authentication & Authorization Flow](#5-authentication--authorization-flow)
6. [Permission System](#6-permission-system)
7. [AI & Background Job Pipeline](#7-ai--background-job-pipeline)
8. [Subscription & Credit System](#8-subscription--credit-system)
9. [Multi-School Architecture](#9-multi-school-architecture)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Deployment Topology](#11-deployment-topology)
12. [Retention & Engagement Pipeline](#12-retention--engagement-pipeline)

---

## 1. System Overview

Agora is a **multi-tenant school management platform** targeting Nigerian educational institutions (Primary, Secondary, and Tertiary). Its core identity is the **"Chain-of-Trust Digital Education Registry"** — every student on the platform has a permanent, portable academic identity that travels with them across schools and institutions via a TAC (Transfer Access Code) system.

**Core Value Propositions:**
- Unified student identity across the Nigerian education system
- AI-powered curriculum and scheme of work generation ("Lois" AI)
- Comprehensive school operations (academics, timetables, assessments, attendance)
- Role-based, subscription-gated access control

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  Browser (Next.js 14)   ·   Mobile Apps   ·   Public APIs   │
└───────────────────────────┬──────────────────────────────────┘
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                   NestJS API (Port 4000)                      │
│  Helmet · CORS · Cookie Parser · Throttler (Rate Limiting)   │
│  Global Validation Pipe · HttpExceptionFilter · Sentry       │
│  TenantMiddleware → JWT Guard → PermissionGuard              │
└──────┬──────────────────┬────────────────┬───────────────────┘
       │                  │                │
       ▼                  ▼                ▼
  PostgreSQL           Redis            Cloudinary
  (Prisma ORM)      (BullMQ Queues)  (File Storage)
       │                  │
       │              BullMQ Workers
       │          ┌──────────────────────────┐
       │          │  curriculum.processor    │ ← Parse PDFs via AI
       │          │  scheme-of-work.processor│ ← Generate Schemes
       │          └──────────────────────────┘
       │                                ▲
       └──────────────────── AiService ─┘
                         (Azure OpenAI GPT-4.1-mini)
                         (Azure text-embedding-3-small)
```

**Rate Limiting Tiers** (defined on each controller endpoint):
| Name | Limit | Used For |
|------|-------|---------|
| `standard` | 300 req/min | Default — most UI fetch endpoints |
| `heavy-ai` | 100 req/min | AI-triggered endpoints (generation, parsing) |
| `database-intensive` | 100 req/min | Reports, analytics, global search |

---

## 3. Backend Module Map

```
src/
├── app.module.ts               # Root module — wires all modules together
├── main.ts                     # Bootstrap: helmet, CORS, validation, Swagger
│
├── auth/                       # JWT auth, OTP login, password reset/change
├── agora-curriculum/           # Super Admin curriculum pipeline (upload → parse → consolidate → publish)
├── ai/                         # AiService — all LLM calls (Azure OpenAI)
├── analytics/                  # School analytics and reporting
├── assessments/                # Assessment creation, submission, grading
├── attendance/                 # Daily student attendance
├── email/                      # Email service (SMTP via Nodemailer)
├── events/                     # School calendar events + Google Calendar sync
├── grades/                     # Grade entry, report cards
├── integrations/               # Google Calendar OAuth integration
├── live-status/                # WebSocket / SSE status feeds
├── notification/               # In-app notification logs
├── onboarding/                 # Student bulk import workflows
├── operations/errors/          # Application error tracking (ErrorsModule)
├── payments/                   # Paystack subscription payment webhooks
├── public/                     # Public-facing unauthenticated endpoints
├── sessions/                   # Academic session + term lifecycle
├── storage/cloudinary/         # Cloudinary file upload service
├── students/                   # Student records, profiles, enrollment
├── subscriptions/              # Subscription plans, AI credit management
├── tenant/                     # TenantMiddleware — injects schoolId from JWT
├── timetable/                  # Timetable periods, rooms, subject-teacher assignment
├── transfers/                  # TAC-based student transfers between schools
│
├── schools/                    # Multi-module school management umbrella
│   ├── classes/                # Class levels, class arms, rooms
│   ├── curriculum/             # School Admin curriculum pipeline (upload → parse → generate scheme)
│   │   └── scheme-of-work.processor.ts  # BullMQ worker for scheme generation
│   ├── domain/                 # Repository pattern: school.repository, staff.repository
│   ├── dto/                    # Shared DTOs (permission.dto, school.dto, etc.)
│   ├── faculties/              # Tertiary: faculties and departments
│   ├── public/                 # Public school directory endpoints
│   ├── scheme-of-work/         # Read/manage generated schemes of work
│   ├── school-admin/           # School Admin dashboard, profile, staff list
│   │   ├── school-admin-schools.controller.ts
│   │   └── school-admin-schools.service.ts
│   ├── shared/                 # Id generator, staff validator, password utils
│   ├── staff/                  # Teacher + Admin CRUD
│   │   └── admins/             # Admin service with principal hierarchy enforcement
│   └── super-admin/            # Super Admin school registry + verification
│
└── common/
    ├── decorators/             # @RequirePermission decorator
    ├── filters/                # Global HttpExceptionFilter (Sentry + structured errors)
    ├── guards/                 # PermissionGuard, SchoolDataAccessGuard, ThrottlerGuard
    ├── interceptors/           # ThrottlerHeaders, HttpMetrics
    ├── metrics/                # Prometheus metrics (auth counts, BullMQ job durations)
    └── utils/                  # Password hashing, misc utilities
```

---

## 4. Data Model (Entity Relationships)

### Modular Prisma Schema Architecture
As of April 2026, Agora utilizes Prisma's `prismaSchemaFolder` feature (Prisma v5.22.0) to break down its database schema into domain-specific modules instead of a monolithic `schema.prisma`.
The schemas are located in `prisma/schema/` and are grouped as follows:
- `config.prisma`: Generator and Datasource config
- `users.prisma`: Core User, Auth, OTP, and Session models
- `schools.prisma`: School core, Subscriptions, Errors, Tools, and Campaigns
- `staff.prisma`: Teachers, Admins, and Granular Permissions
- `students.prisma`: Students, Parents, Enrollments, and Transfers
- `academics.prisma`: Classes, Sessions, Faculties, and Terms
- `curriculum.prisma`: Subjects, Timetables, and Scheme of Work entities
- `assessments.prisma`: Grades, Assessment Templates, and Violations
- `resources.prisma`: Class Resources, AI Logs, and Chat History

### Core Entities

```
User (1) ─── (0..1) Student
           ─── (0..1) Parent
           ─── (0..n) Teacher        (across multiple schools)
           ─── (0..n) SchoolAdmin    (across multiple schools)
```

A single **User** row is the authentication anchor. Role-specific data lives in profile tables. A person can be a `Teacher` in School A and a `SchoolAdmin` in School B simultaneously.

### School Hierarchy
```
School
  ├── ClassLevel  (e.g. JSS1, SS2, Year 3, 100 Level)
  │     └── ClassArm  (e.g. Gold, Blue, Red — arm within a level)
  ├── Subject     (school-specific, optionally linked to AgoraSubject)
  ├── AcademicSession  (e.g. 2025/2026)
  │     └── Term  (1st Term, 2nd Term, 3rd Term)
  │           └── TimetablePeriod
  ├── Enrollment  (Student ↔ School ↔ ClassArm ↔ Term)
  ├── Curriculum  (teacher-built weekly plan per subject/class/term)
  └── SchemeOfWork  (AI-generated scheme — see section 7)
```

### Curriculum / Scheme of Work Entities
```
[SUPER ADMIN LAYER]
AgoraSubject  ──→  AgoraCurriculumSource (uploaded PDFs, parsed by AI)
                          ↓
                   AgoraCurriculum (consolidated + versioned)
                          ↓ (published)
                   AgoraCurriculumTopic[] (weekly breakdown)

[SCHOOL ADMIN LAYER]
SchoolCurriculumDoc (school's own uploaded files, parsed by AI)
        ↓
SchemeOfWork  ←── generated by Lois AI using either:
                  - AgoraCurriculum only    (AGORA_ONLY)
                  - SchoolCurriculumDoc only (SCHOOL_ONLY)
                  - Both merged             (MERGED)
        ↓
SchemeOfWorkWeek[] (13-week breakdown per term, with delivery tracking)
```

### Key Enum States

**SchemeOfWorkStatus:**
`QUEUED → VERIFYING → GENERATING → DRAFT → APPROVED → PUBLISHED`  
(Also: `FAILED`, `CANCELLED`)

**AgoraCurriculumSourceStatus:**
`PENDING_PARSE → PARSING → PARSED → APPROVED`  
(Also: `REJECTED`, `FAILED`)

**AccountStatus (User):**
`SHADOW` (not yet activated) → `ACTIVE` → `SUSPENDED` → `ARCHIVED`

---

## 5. Authentication & Authorization Flow

### Login Flow (Mandatory OTP)
```
1. POST /auth/login  { emailOrPublicId, password }
   → Validates credentials (bcrypt hash check)
   → Checks school registration status (UNAPPROVED blocks login)
   → Creates LoginSession record + sends 6-digit OTP to email
   → Returns { requiresOtp: true, sessionId, email }

2. POST /auth/verify-login-otp  { sessionId, code }
   → Verifies OTP against LoginSession table
   → Signs JWT (access: 1d, refresh: 7d) containing:
      { sub, role, schoolId, publicId, profileId, pwdChangedAt }
   → Returns tokens + user profile

3. POST /auth/refresh  { refreshToken }
   → Re-signs tokens preserving school context
   → Invalidates session if password was changed after token was issued (pwdChangedAt claim)
```

### Public ID Login
Staff (admins, teachers) and students can log in with their **Public ID** (format: `AG-{schoolname}-{alphanum}`) instead of email. The API resolves the Public ID to a User record by searching SchoolAdmin, Teacher, and Student tables in parallel.

### Guards Applied Globally
All routes pass through (in order):
1. **`JwtAuthGuard`** — validates the Bearer token, populates `req.user`
2. **`SchoolDataAccessGuard`** — scoped to school routes: ensures `req.user.schoolId` matches the `:schoolId` parameter  
3. **`PermissionGuard`** — checks the `@RequirePermission()` decorator if present

---

## 6. Permission System

### Overview
School Admin access is governed by a granular `Resource × Type` permission matrix stored in the database.

### Resources (PermissionResource enum)
| Resource | Controls Access To |
|----------|-------------------|
| `OVERVIEW` | Dashboard, school profile, logo upload |
| `ANALYTICS` | School analytics and reports |
| `SUBSCRIPTIONS` | Subscription plans and billing |
| `STUDENTS` | Student records, profiles, enrollment |
| `STAFF` | Teachers and administrators |
| `CLASSES` | Class levels, arms, rooms |
| `SUBJECTS` | Subject registry and teacher assignments |
| `TIMETABLES` | Timetable creation and management |
| `CALENDAR` | School calendar events |
| `ADMISSIONS` | Student admission processing |
| `SESSIONS` | Academic sessions and terms |
| `EVENTS` | School events |
| `GRADES` | Student grades and assessments |
| `CURRICULUM` | Curriculum creation (automatically implies SCHEME_OF_WORK) |
| `SCHEME_OF_WORK` | Scheme of work management |
| `RESOURCES` | Class resource uploads |
| `TRANSFERS` | Student transfer management |
| `INTEGRATIONS` | Third-party integrations (Google Calendar) |

### Permission Types (PermissionType enum) — Hierarchical
| Type | Access Level | Backend Cascade Rule |
|------|-------------|---------------------|
| `READ` | View only | Route requires READ → accepts READ, WRITE, or ADMIN |
| `WRITE` | Create & edit | Route requires WRITE → accepts WRITE or ADMIN |
| `ADMIN` | Full control including delete | Route requires ADMIN → accepts ADMIN only |

> **Cascading** is enforced in `PermissionGuard` — granting `WRITE` implicitly satisfies all `READ` requirements without needing a separate READ record.

### Principal Role Override
Admins whose `role` string matches any entry in `PRINCIPAL_ROLES` (`principal`, `school_principal`, `head_teacher`, `headmaster`, `headmistress`, `school_owner`) **bypass all permission checks** entirely. This is checked via `isPrincipalRole()` before any database query.

### Permission Guard Logic (simplified pseudocode)
```
if (no @RequirePermission decorator) → allow
if (user.role === 'SUPER_ADMIN') → allow
if (user.role === 'SCHOOL_ADMIN') {
  if (isPrincipalRole(admin.role)) → allow
  if (admin has ADMIN permission for resource) → allow
  if (route requires READ and admin has READ/WRITE/ADMIN) → allow
  if (route requires WRITE and admin has WRITE/ADMIN) → allow
  else → ForbiddenException
}
if (user.role === 'TEACHER' or 'STUDENT') → allow (service-level auth)
else → ForbiddenException
```

### Security Rules for Principal Role Assignment
- Only a user who is already a **Principal** can assign, update, or promote other users to principal-level roles
- No admin can modify the profile of a Principal unless they themselves are also a Principal
- `school_owner` cannot be deleted — ever

---

## 7. AI & Background Job Pipeline

### AI Service (AiService)
Located at `src/ai/ai.service.ts`. All AI operations go through this single service.

**Key Operations:**
| Method | Purpose | BullMQ Job |
|--------|---------|------------|
| `parseCurriculumSource()` | Extracts structured curriculum data from PDF/DOCX | `process-source` |
| `consolidateCurriculum()` | Merges multiple parsed sources into a single curriculum | `consolidate-batch` |
| `generateSchemeOfWork()` | Generates a 13-week single-term scheme from a curriculum | `generate-scheme` |
| `generateYearlySchemeOfWork()` | Generates schemes for all 3 terms in one LLM call | `generate-yearly-scheme` |

### Queue Architecture
Two BullMQ queues share the Redis instance:

```
CURRICULUM_PROCESSING_QUEUE ("curriculum-processing")
  ├── process-source     → curriculum.processor.ts (AgoraCurriculumModule)
  └── generate-scheme    → scheme-of-work.processor.ts (SchoolsModule)
  └── generate-yearly-scheme → scheme-of-work.processor.ts

CURRICULUM_CONSOLIDATION_QUEUE ("curriculum-consolidation")
  └── consolidate-batch  → curriculum.processor.ts
```

**Worker Concurrency:** `SchemeOfWorkProcessor` runs at concurrency 1 (AI generation is resource-heavy, kept serial to prevent rate-limit spikes).

### Job Lifecycle — Single-Term Scheme
```
1. School Admin clicks "Generate Scheme"
2. CurriculumService.setupSchemeOfWork()
   a. Creates SchemeOfWork record with status = QUEUED
   b. Deducts AI credits from Subscription
   c. Enqueues job { schemeId, schoolId, userId, creditsUsed }
3. SchemeOfWorkProcessor.process() picks up job
4. AiService.generateSchemeOfWork(schemeId)
   a. Fetches SchemeOfWork + related Agora/School curriculum data
   b. Builds LLM prompt with subject, grade level, and curriculum content
   c. Calls Azure OpenAI (gpt-4.1-mini)
   d. Parses JSON response into SchemeOfWorkWeek[] records
   e. Updates SchemeOfWork.status = DRAFT
5. On failure: SchemeOfWorkProcessor.onFailed() refunds credits + marks FAILED
```

### Job Lifecycle — Full-Year (3-Term) Scheme
```
1. School Admin selects curriculum docs + clicks "⚡ Compile Academic Year"
2. CurriculumService.setupYearlySchemeOfWork()
   a. Creates 3 SchemeOfWork records (one per term), all status = QUEUED
   b. Deducts 3× AI credits
   c. Enqueues single "generate-yearly-scheme" job { schemeIds[], schoolCurriculumDocIds[], ... }
3. SchemeOfWorkProcessor handles "generate-yearly-scheme"
4. AiService.generateYearlySchemeOfWork(schemeIds, schoolCurriculumDocIds)
   a. Single LLM prompt generates a full 39-week academic year plan
   b. Maps response into 3 term bundles
   c. Creates SchemeOfWorkWeek records for each term's SchemeOfWork
   d. Updates all 3 SchemeOfWork records to DRAFT
```

### Startup Reconciliation
On server start (`AgoraCurriculumService.onModuleInit()`):
1. Moves any `active` BullMQ jobs (orphaned from a crashed worker) to `failed`
2. Resets any DB sources stuck in `PARSING` → `FAILED`
3. Drains the queue and re-enqueues all `PENDING_PARSE` sources from the database

This ensures the queue and database are always perfectly synchronized after a restart or crash.

---

## 8. Subscription & Credit System

Each school has one `Subscription` record linked to a `SubscriptionPlan`.

**Subscription Tiers:** `FREE | PRO | PRO_PLUS | CUSTOM`

**AI Credits:**
- Stored as `Subscription.aiCredits` and `Subscription.aiCreditsUsed`
- Deducted before enqueuing generation jobs (pre-flight check)
- Refunded on failure via `SubscriptionsService.refundAiCredits()`
- Rate: `AGORA_CREDITS_PER_1M_TOKENS` (default: 1000 credits per 1M tokens)
- Schools can purchase additional credits via Paystack (`AiCreditPurchase` model)

**Tool Access:**
Individual product features (e.g. "PrepMaster", "Bursary") are tracked in `SchoolToolAccess`, gated by subscription tier and activation status (`ACTIVE | TRIAL | EXPIRED | DISABLED`).

---

## 9. Multi-School Architecture

### Tenant Isolation
Every request to a school-scoped endpoint carries the `schoolId` either:
- In the JWT payload (for `/school-admin/*`, `/teachers/*`)
- As an explicit `x-tenant-id` header (for admin API clients)
- As a `:schoolId` route parameter (for super admin endpoints)

**`TenantMiddleware`** injects `req.schoolId` from the JWT before the route handler runs. **`SchoolDataAccessGuard`** then validates that the JWT's `schoolId` matches the route parameter before allowing access, preventing one school from accessing another's data.

### Public ID Format
Every staff member and student is assigned a human-readable **Public ID** on creation:
```
Format: AG-{schoolabbreviation}-{6-char-alphanum}
Example: AG-LAGSCHOOL-X4K9P2
```
This is the credential used for kiosk-style login (e.g. students logging in on shared school computers without needing to remember an email).

---

## 10. Frontend Architecture

See [`../frontend/FRONTEND_ARCHITECTURE.md`](../frontend/FRONTEND_ARCHITECTURE.md) for the full frontend architecture.

**Tech Stack:** Next.js 14 (App Router) · RTK Query (Redux Toolkit) · Tailwind CSS · Sentry

**Dashboard Routes:**
| Path | Role |
|------|------|
| `/dashboard/school/*` | School Admin |
| `/dashboard/super-admin/*` | Super Admin |
| `/dashboard/teacher/*` | Teacher |
| `/dashboard/student/*` | Student |

---

## 11. Deployment Topology

**Production Environment:** Azure

| Component | Service |
|-----------|---------|
| API | Azure App Service (Docker container) |
| Database | Azure Database for PostgreSQL (Flexible Server) |
| Redis | Azure Cache for Redis (cluster mode) |
| File Storage | Cloudinary |
| AI | Azure OpenAI (gpt-4.1-mini + text-embedding-3-small) |
| Error Tracking | Sentry |
| Metrics | Prometheus → Grafana Cloud |
| CI/CD | Azure DevOps Pipelines (`azure-pipelines.yml`) |
| Frontend | Separate deployment (Azure Static Web Apps or App Service) |

**Container Startup Sequence:**
```
[docker-entrypoint.sh]
1. If DB_URL set → run `prisma migrate deploy`
2. Start API: `node dist/main.js`
```

---

## 12. Retention & Engagement Pipeline

### Overview
Agora utilizes an **Event-Driven, Delayed-Queue Architecture** for its intelligent retention and engagement pipeline. This replaces massive, uniform cron jobs with highly targeted, contextual nudges tailored to the exact state of a Principal or School Admin.

### Core Components
1. **`@nestjs/event-emitter`**: Emits domain events (e.g., `school.verified`, `campaign.activated`) across the application without coupling code.
2. **`EngagementModule`**: Houses the logic for scheduling and processing engagement tasks.
3. **BullMQ `retention-queue`**: Handles all delayed and scheduled engagement jobs.
4. **`NotificationLog` Model**: Tracks messages sent to users to prevent spamming and duplicate nudges.
5. **`Campaign` Model**: Allows Super Admins to curate and blast custom promotional emails or in-app notifications targeted to `ALL_SCHOOLS` or `SPECIFIC_SCHOOLS`.

### Dynamic Workflows (Playbooks)
The system employs tailored "Playbooks" triggered by specific events:

- **Playbook A: The "Activation" Nudge (Days 1-7)**
  - *Trigger:* `school.verified`
  - *Flow:* 
    - Day 1: Checks for `AcademicSession`. If none, sends a setup guide.
    - Day 2: Checks for `Teacher` count. If 0, sends an invite tutorial.
    - Day 3: Checks for `Enrollment` count. If 0, sends a student bulk import guide.

- **Playbook B: Feature Discovery (Days 14+)**
  - *Trigger:* Contextual (e.g., `term.started` or periodic checks).
  - *Flow:* Nudges users to explore underutilized features like AI Curriculum generation or Digital Timetables based on their actual `AiUsageLog` or `TimetablePeriod` data.

- **Playbook C: Super Admin Campaigns**
  - Super Admins can dynamically curate promotional campaigns (e.g., "Upgrade Tier", "Black Friday AI Credits") targeting specific segments. Campaigns are dispatched through the `retention-queue` to ensure smooth delivery without rate-limit spikes.

### Implementation Pattern
```typescript
// 1. Event emitted in domain logic
this.eventEmitter.emit('school.verified', schoolId);

// 2. Listener catches and delegates to EngagementService
@OnEvent('school.verified')
async handle(schoolId) {
  await this.engagementService.scheduleOnboardingPlaybook(schoolId);
}

// 3. EngagementService pushes DELAYED jobs to BullMQ
await this.retentionQueue.add('check-onboarding-session', { schoolId }, { delay: 24h });

// 4. Processor executes the job, checking current DB state BEFORE sending
if (sessionCount === 0) {
  await this.sendNudge(schoolId);
}
```

