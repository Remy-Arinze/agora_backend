# ADR-012: Next.js 14 App Router (Over Pages Router)

**Status:** Accepted  
**Date:** 2025-Q1  
**Deciders:** Engineering Lead

---

## Context

The frontend was built with Next.js. At the time of project initiation, Next.js 13/14 introduced the App Router — a new routing paradigm based on React Server Components, layouts, and the `app/` directory. The original Pages Router remained supported. A choice had to be made.

## Decision

**Next.js 14 App Router** is used exclusively. The `app/` directory structure is the standard for all pages. There is no `/pages` directory.

## Consequences

**Positive:**
- **Nested layouts** (`layout.tsx`) allow the dashboard shell (Sidebar, Navbar, auth guards) to wrap all child routes without re-mounting on navigation — cleaner and more performant than Pages Router's `_app.tsx`
- React Server Components enable data fetching at the component level without extra API routes for public pages
- Streaming and Suspense boundaries are available for progressive loading
- The App Router is Next.js's forward-looking investment — it will receive new features; Pages Router is in maintenance mode

**Negative:**
- App Router is significantly more complex than Pages Router — `use client`, `use server`, RSC vs client component boundaries require careful thought
- Some third-party libraries (at project start) had incomplete App Router support, requiring `'use client'` directives more broadly than ideal
- RTK Query (Redux Toolkit) requires `'use client'` for all components using hooks — effectively making the dashboard entirely client-side rendered, negating some RSC benefits. This is an accepted trade-off given the complexity of the permission system and real-time state requirements.
- Error handling requires `error.tsx` files at each segment, not a single global handler
