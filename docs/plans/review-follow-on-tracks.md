# REVIEW follow-on tracks (executed)

This file mirrors the multi-track plan from Cursor (`review_follow-on_tracks_*`) for GitHub. **Do not store secrets here.**

## Shipped in this effort

1. **Playwright / no-secrets CI** — `VITE_E2E_AUTH_BYPASS` + `src/lib/e2e-auth-bypass.ts`, `use-auth` integration, CI/staging build env, webServer on **4173**, new bypass tests in `e2e/tier2-flows.spec.ts`, TEST-PLAN T9.3a updated.
2. **EmptyState** — Agent fleet, SE history, assessment history, drift, tenant dashboard, customers, agent manager; `EmptyState` supports React `description`; TEST-PLAN §6 rows T6.9–T6.15.
3. **TanStack** — `queryKeys.org.teamRoster`, `useOrgTeamRosterQuery`, InviteStaff Query/mutations; `client-data-layer.md` updated.
4. **logJson** — `parse_config_unhandled`; observability appendix + `rg` recipe.
5. **OpenAPI / ApiDocumentation** — `portal-data`, `parse-config` paths.
6. **Tier 3 (partial)** — `useDebouncedValue` + CustomerManagement; viewport Playwright; k6 template; seed stub; PERF-EXPLAIN; zod pilot on InviteStaff; stable keys in AgentFleetPanel; `tier-3-dx-backlog.md` notes.

## Still open (larger items)

Redis caching, durable job queues, Gemini queue, server-side PDF, WebP asset pass, broad `React.memo`, full `AbortController`/`useQuery` sweep, ManagementDrawer deep migration, production Edge Sentry.
