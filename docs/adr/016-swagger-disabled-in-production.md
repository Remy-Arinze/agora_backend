# ADR-016: Swagger API Docs Disabled in Production

**Status:** Accepted  
**Date:** 2025-Q2  
**Deciders:** Engineering Lead

---

## Context

NestJS with `@nestjs/swagger` generates interactive API documentation at a configurable path. Swagger UI in production exposes the full API contract — endpoint names, request/response shapes, authentication requirements, and query parameters — to anyone who can reach the server.

## Decision

Swagger is **disabled when `NODE_ENV === 'production'`**. The check in `main.ts`:

```typescript
if (!isProduction) {
  // Swagger setup code
}
```

In development, both the Swagger UI (`/api`) and the JSON spec (`/swagger-json`) are available. In production, both routes are omitted.

## Consequences

**Positive:**
- Reduces attack surface — adversaries cannot trivially enumerate all endpoints, discover admin routes, or understand the exact parameter structure for exploitation
- Prevents accidental disclosure of internal architecture details to competitors
- The JSON spec (`/swagger-json`) is used by the frontend's `openapi-codegen` script — this is a development-only workflow, so production availability is not required

**Negative:**
- No runtime API reference in production. Engineers debugging production behaviour cannot use the UI.
- The frontend `generate-client` script must be run against the development server, not production. This is the expected workflow.
- If the OpenAPI spec needs to be shared with API consumers (e.g. a mobile app team or third-party integration), it must be manually exported and hosted separately. No automated process exists for this yet.
