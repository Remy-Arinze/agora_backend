# Frontend Architecture

## Overview

The Agora frontend is a Next.js App Router application that serves role-based school management workflows for school admins, staff, students, and super admins.

The frontend favors:

- shared UI primitives for consistent behavior
- RTK Query for API integration and cache management
- page-level orchestration with reusable feature components
- centralized form controls for cross-cutting UX decisions

## Main Structure

- `src/app`
  - route-level pages and page orchestration
- `src/components`
  - reusable UI primitives, modals, dashboard components, and feature components
- `src/lib/store/api`
  - RTK Query API slices and generated client bindings
- `src/hooks`
  - shared view logic and role/school-type helpers
- `src/lib`
  - validation, utilities, constants, and shared client-side support code

## Shared Form Controls

Shared form inputs are used to keep UX and policy decisions centralized. A key example is `frontend/src/components/ui/CountrySelector.tsx`, which wraps `react-country-region-selector` and exposes a project-specific API to the rest of the app.

This approach lets the product change country availability in one place without duplicating country logic across registration, admission, staff, profile, or super-admin flows.

## Country Selector Scoping

The shared `CountrySelector` supports scoped country lists through:

- `scope="africa"`
- `scope="west-africa"`
- `whitelist={[...]}`

The component resolves the allowed set centrally from `COUNTRY_SCOPES`, and passes the resulting ISO country-code whitelist into the underlying `CountryDropdown`.

### Current Product Decision

During the current development phase, the product is intentionally narrowed to **West Africa** on current user-facing form flows. The component still keeps the broader Africa scope available so the product can widen later without redesigning the API.

### Current West Africa Usage

The following flows currently opt into `scope="west-africa"`:

- school registration: `frontend/src/app/auth/register-school/page.tsx`
- add student page: `frontend/src/app/dashboard/school/students/add/page.tsx`
- add staff page: `frontend/src/app/dashboard/school/staff/add/page.tsx`
- student admission modal: `frontend/src/components/modals/StudentAdmissionModal.tsx`
- school profile settings: `frontend/src/app/dashboard/school/settings/profile/page.tsx`
- super-admin add school: `frontend/src/app/dashboard/super-admin/schools/add/page.tsx`

## Design Rationale

This design keeps country-selection policy:

- centralized in one shared component
- easy to widen from West Africa to all Africa
- easy to override for one-off cases with a custom whitelist
- explicit at the call site when a page wants a narrower scope

## ADRs

- [`ADR-0001 Country Selector Regional Scoping`](./adr/ADR-0001-country-selector-regional-scoping.md)
