# ADR-002: Mandatory OTP Step on Every Login

**Status:** Accepted  
**Date:** 2025-Q1  
**Deciders:** Engineering Lead, Product

---

## Context

The initial login implementation allowed direct token issuance after password validation. As the platform moved toward handling sensitive student academic records and financial data (subscription billing, fees), a stronger authentication posture was required.

Two options were considered:
1. **Optional 2FA** — users opt in to OTP-based two-factor authentication
2. **Mandatory OTP on every login** — no user ever receives tokens without verifying an OTP

## Decision

Every login **always** requires OTP verification. There is no bypass path.

**Implementation:**
- `POST /auth/login` validates credentials, creates a `LoginSession` record, sends a 6-digit OTP to the user's email, and returns `{ requiresOtp: true, sessionId }` — never tokens
- `POST /auth/verify-login-otp` verifies the OTP against the `LoginSession` table and issues the JWT pair
- The OTP code is explicitly **not** stored in the `User` table — it lives in `LoginSession` to limit exposure

## Consequences

**Positive:**
- Credential stuffing attacks are defeated — compromised passwords cannot be used without email access
- All login events result in an email to the legitimate user, alerting them of the attempt
- Compliance-friendly posture for handling minor (student) data

**Negative:**
- Login takes two round trips instead of one — marginally worse UX for users on slow connections
- Email deliverability becomes a critical dependency. If the mail server is down, users cannot log in. Mitigation: monitor SMTP delivery and have fallback provider ready.
- Users without email access (some student scenarios) must use another credential path. Mitigated by Public ID login which still routes through the same email OTP (using the email on the User record, not the login identifier).
