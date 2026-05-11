# ADR-013: RTK Query for Frontend API Layer

**Status:** Accepted  
**Date:** 2025-Q1  
**Deciders:** Engineering Lead

---

## Context

The frontend needs a client-side data fetching and caching solution. Options considered:
1. **React Query (TanStack Query)** — popular, framework-agnostic
2. **SWR** — lightweight, from Vercel
3. **RTK Query (Redux Toolkit)** — built into Redux Toolkit, tightly integrated with Redux state

The platform already required Redux for auth state management (persisted login sessions). A separate data-fetching library would create two state systems to manage.

## Decision

**RTK Query** (part of Redux Toolkit) is used for all API calls and data caching.

API slices are defined in `src/lib/store/api/`:
- `authApi.ts` — authentication endpoints
- `schoolAdminApi.ts` — all school admin operations
- `superAdminApi.ts` — super admin platform operations

The Redux store with Redux Persist handles auth token storage and rehydration.

## Consequences

**Positive:**
- Single state management system — auth state and server state coexist in Redux; no bridging needed
- Built-in cache invalidation via tag-based invalidation (`providesTags`, `invalidatesTags`) — e.g. adding a student automatically refreshes the student list
- Generated hooks (`useGetStudentsQuery`, `useAddStudentMutation`) are type-safe if generated from OpenAPI spec via `openapi-codegen`
- Redux DevTools works for both auth state and API cache inspection

**Negative:**
- RTK Query is more verbose to define than React Query — requires defining query/mutation builders in an API slice rather than simply calling `useQuery(async () => fetch(...))`
- Bundle size is larger than SWR or lightweight alternatives
- `'use client'` directive is required on every component using RTK Query hooks in the Next.js App Router — effectively prevents Server Component usage in data-fetching components
- The auto-generated client (`openapi-codegen.config.ts`) requires the backend Swagger endpoint to be running during frontend development
