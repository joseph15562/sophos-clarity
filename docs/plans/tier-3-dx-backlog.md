# Tier 3 — DX / perf backlog (timeboxed)

Pulled from [docs/REVIEW.md](../REVIEW.md) Tier 3 checklist. **Does not block** core Query / E2E / Edge contract work. Pick items in ½–2 day slices when capacity allows.

| Item                                                                          | Effort hint | Notes                                                                                                                    |
| ----------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Debounce / throttle for search + scroll                                       | 1 day       | **Partial:** `useDebouncedValue` + **CustomerManagement** search (300ms). Extend to other search-heavy tables as needed. |
| `AbortController` on remaining fetches **or** migrate reads to TanStack Query | 1 week      | Align with [client-data-layer.md](../api/client-data-layer.md).                                                          |
| `React.memo` on expensive leaf components                                     | 2 days      | Charts, table rows first.                                                                                                |
| Stable keys in dynamic lists (not array index)                                | 1 day       | **Partial:** **AgentFleetPanel** top-findings list keys; grep `key=\{` for remaining hotspots.                           |
| Raster PNG → WebP + lazy load                                                 | 1 day       | Asset pipeline.                                                                                                          |
| Playwright viewport matrix (375 / 768 / 1024)                                 | 1 day       | **Partial:** `e2e/viewport-layout.spec.ts` (home + changelog per breakpoint).                                            |
| Client `zod` — remove dep or adopt on high-risk forms                         | 1 hr        | **Pilot:** **InviteStaff** invite email uses `z.string().trim().email()`.                                                |
| DB seed script for onboarding                                                 | 1 day       | **Stub:** `supabase/seed.sql` — extend with real inserts locally.                                                        |
| k6 load tests — top 3 endpoints                                               | 2–3 days    | **Template:** `scripts/k6/smoke.js` (`BASE_URL` required). Expand to top routes.                                         |
| `EXPLAIN ANALYZE` + composite indexes                                         | 1 day       | **Runbook:** [docs/PERF-EXPLAIN.md](../PERF-EXPLAIN.md).                                                                 |
| Server-side PDF generation (Edge)                                             | 1 week      | Alternative to client print-to-PDF.                                                                                      |
