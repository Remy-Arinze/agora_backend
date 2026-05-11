# Future Plan: Open Agora Public API & Developer Platform

## Objective
To allow third-party educational tools (LMS, specialized assessment software, parent engagement apps) to integrate with the Agora Digital Identity Registry, creating a unified data ecosystem for Nigerian schools.

## Context
Third-party vendors often struggle with fragmented student data. By opening Agora's API, we become the "Identity and Record Provider" for the Nigerian EdTech space.

## Architecture

### 1. Developer Portal
- Manage **API Keys** and **Client Secrets**.
- OAuth 2.0 implementation for third-party apps ("Login with Agora").
- Webhook registration for events (e.g., student admitted, grade published, transfer completed).

### 2. Scoped Permissions
- Granular Scopes: `students.read`, `grades.write`, `timetable.read`.
- User-level consent: "App X wants to access your school's attendance records. Allow?"

### 3. Public Endpoints
- **Identity API**: 
    - `GET /v1/identity/verify`: Verify student identities and TAC codes.
    - `GET /v1/identity/profile`: Retrieve basic profile data for authenticated students/staff.
- **Academics API**: 
    - `GET /v1/academics/subjects`: List school-specific subjects.
    - `GET /v1/academics/schemes`: Read-only access to published Schemes of Work.
- **Records API**: 
    - `GET /v1/records/grades`: Fetch student grades for external report generation.
    - `POST /v1/records/assessments`: Submit external assessment scores into the Agora gradebook.

### 4. Webhook Events
Partner platforms can subscribe to real-time events via HTTPS POST:
- `student.admitted`: Triggered when a new student enrollment is finalized.
- `assessment.published`: Triggered when a teacher publishes grades for a class.
- `transfer.initiated`: Triggered when a TAC is generated for a student.
- `session.started`: Triggered when a new academic term begins.

### 5. Rate Limiting & Monetization
- Free Tier: Basic read-only access for internal school scripts.
- Partner Tier: High-throughput access for commercial EdTech partners.
- Data Usage Billing: API usage charged in Agora Credits.

## SDKs & Documentation
- Release `agora-node-sdk` and `agora-python-sdk`.
- Static documentation hosted at `developer.agora-schools.com` (generated from OpenApi spec).

## Security
- IP Whitelisting for high-privilege keys.
- Audit logs for every API call made by a third-party application.
- Periodic rotation of API secrets.
