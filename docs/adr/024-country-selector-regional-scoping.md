# ADR-0001: Country Selector Regional Scoping

- Status: Accepted
- Date: 2026-05-11

## Context

Agora uses a shared `CountrySelector` component in multiple product areas, including school registration, student admission, staff creation, profile management, and super-admin school setup.

The product currently wants to operate within a narrower regional footprint during development, starting with West Africa. At the same time, the team wants to preserve an easy path to expand the selector back to all African countries, or to support other scoped subsets later.

Before this decision, country scoping was handled as a single hardcoded Africa-wide whitelist in the shared selector. That solved the first narrowing step, but it did not provide a clean API for future regional changes.

## Decision

The frontend will keep country availability centralized inside `frontend/src/components/ui/CountrySelector.tsx` and expose a scope-aware API:

- `scope="africa"`
- `scope="west-africa"`
- `whitelist={[...]}`

The component will maintain a `COUNTRY_SCOPES` map of ISO country-code lists and resolve the final whitelist from either:

1. an explicit `whitelist` prop, or
2. a named `scope`

The component default remains `africa`, while current product flows explicitly opt into `scope="west-africa"`.

## Consequences

### Positive

- Country policy remains centralized in one shared component.
- West Africa can be enabled immediately without duplicating country lists across forms.
- Future expansion back to Africa is a call-site change instead of a component redesign.
- One-off flows can still use a custom whitelist when needed.

### Negative

- The restriction is currently enforced only in the frontend selector UX, not in backend validation.
- Existing persisted values outside the selected scope may need separate handling if older or seeded records are edited later.

## Alternatives Considered

### Hardcode West Africa Globally

Rejected because it would make future expansion less explicit and would hide product policy inside component internals.

### Create Separate Components Per Region

Rejected because it would duplicate behavior, styling, and maintenance burden for what is fundamentally the same input.

### Inline Whitelists Per Page

Rejected because it spreads regional policy across multiple pages and undermines consistency.

## Implementation Notes

Current West Africa usage includes:

- `frontend/src/app/auth/register-school/page.tsx`
- `frontend/src/app/dashboard/school/students/add/page.tsx`
- `frontend/src/app/dashboard/school/staff/add/page.tsx`
- `frontend/src/components/modals/StudentAdmissionModal.tsx`
- `frontend/src/app/dashboard/school/settings/profile/page.tsx`
- `frontend/src/app/dashboard/super-admin/schools/add/page.tsx`
