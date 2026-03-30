# ADR 0004: Frontend data-access boundary

## Status

Accepted (2026-03) — **Wave 1:** org cloud purge deletes live in [`src/lib/data/purge-org-cloud-data.ts`](../../src/lib/data/purge-org-cloud-data.ts); [`ManagementDrawer.tsx`](../../src/components/ManagementDrawer.tsx) calls that module only (no direct `supabase.from` in the component). Exceptions and migration targets are listed in [`docs/api/client-data-layer.md`](../api/client-data-layer.md).

**Wave 2 (planned):** [`ManagementDrawer`](../../src/components/ManagementDrawer.tsx) is a thin shell, but **lazy-mounted panels** it hosts may still call `supabase.from` inside their own files (e.g. invite / scheduled reports / portal save paths). Wave 2 moves those reads/writes into **`src/lib/data/*`** and **`src/hooks/queries/*`** with **`useMutation`** / **`useQuery`** and shared invalidation. See **§ Wave 2** in [`docs/plans/review-follow-on-from-REVIEW.md`](../plans/review-follow-on-from-REVIEW.md) and the updated inventory in [`client-data-layer.md`](../api/client-data-layer.md).

## Context

Large UI modules (`ManagementDrawer`, health-check flows, wizards) historically mixed presentation with direct `supabase.from` / ad-hoc `fetch`, which obscures contracts, complicates testing, and makes cache invalidation inconsistent with TanStack Query ([ADR 0002](./0002-tanstack-query-server-state.md)).

## Decision

1. **Components / pages / routes** do not call `supabase.from` / `supabase.rpc` or raw Edge `fetch` for domain reads and writes except where documented in `client-data-layer.md`.
2. **Data access** for those operations lives under **`src/lib/data/*`** (imperative helpers) and/or **`src/hooks/queries/*`** (`useQuery` / `useMutation` with `queryKeys`).
3. **Mutations** invalidate affected keys via shared helpers (e.g. [`invalidateOrgScopedQueries`](../../src/lib/invalidate-org-queries.ts)) so UI stays coherent after destructive operations (e.g. org purge).

## Consequences

- Clearer place to add integration tests and reuse purge/delete ordering without touching JSX.
- **Wave 2+:** drawer-hosted components, then [`use-health-check-inner-state.tsx`](../../src/pages/health-check/use-health-check-inner-state.tsx) incremental Query migration; tracked in [`review-follow-on-from-REVIEW.md`](../plans/review-follow-on-from-REVIEW.md).
