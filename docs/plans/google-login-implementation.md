# Future Plan: Login with Google

## Objective
To provide a seamless, single-click authentication experience for staff and students, reducing the dependency on the traditional email/OTP flow while maintaining security.

## Context
Our current system mandates a password + email OTP flow. We already have `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` placeholders in the environment. We need to implement the OAuth2 flow and reconcile it with our multi-tenant identity model.

## Implementation Strategy

### 1. Backend OAuth2 Integration
- Use `@nestjs/passport` and `passport-google-oauth20`.
- **Strategy Logic**:
    - Extract email from Google profile.
    - Search for an existing `User` with that email.
    - If found: Proceed to token issuance.
    - If not found: check if the user is a new recruit (Shadow account) or needs to be blocked (unknown).
- **Security Bypass**: Google login inherently verifies the email, so we can safely bypass the mandatory Agora OTP step for these sessions.

### 2. Account Linking
- If a user logs in with Google and their email matches an existing password-based account, we link them.
- Users can choose to "Connect Google Account" in their profile settings.

### 3. Identity Reconciliation
- Ensure that the `schoolId` and `role` are correctly derived even when logging in via Google.
- If a User has multiple profiles (e.g., Teacher in School A, Admin in School B), provide a "Select School" view after Google Auth if the context is ambiguous.

### 4. UI/UX Changes
- Add "Continue with Google" button to the `/auth/login` page.
- Add "Security & Connections" tab in the user profile to manage OAuth links.

## Challenges
- **Multiple Schools**: A single Google email might belong to different users in different schools if they aren't unified under a single `User` record. (See ADR-003).
- **Public ID**: Users logging in via Google might still need to see their Agora Public ID for kiosk-based school operations.
