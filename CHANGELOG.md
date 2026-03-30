# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Curated release notes for end users also appear on the in-app **What’s new** page (`/changelog`).

## [Unreleased]

### Added

- **`docs/SCALE-TRIGGERS.md`** — when to prioritise Redis, job queues, and Gemini throttling vs client/API structural work; linked from **`docs/observability.md`**.
- **`src/lib/customer-directory.ts`** + **`useCustomerDirectoryQuery`** (`queryKeys.org.customerDirectory`); **Customer Management** loads directory via TanStack Query with invalidation on delete / portal save.
- **`useOrgPsaIntegrationFlagsQuery`** + **`useOrgSubmissionRetentionQuery`**; **Management drawer** PSA summary and data-governance retention copy use Query (invalidate PSA flags when PSA modals close).
- OpenAPI + API Hub: **guest `config-upload/{token}`** (`api-public`) and SE **`/api/config-upload-request`** / **`/api/config-upload-requests`**.
- **`GuideUploadStep`** (`setup-wizard/steps/`) extracted from **SetupWizardBody**.
- **EmptyState** in **Config History**, **Audit Log**, **Notification Centre**, **Portfolio Insights** trend chart, and SE health-check **upload requests** dialog.

- Playwright **without** `E2E_USER_*` secrets: `VITE_E2E_AUTH_BYPASS=1` (CI build + webServer) + loopback-only synthetic session in `use-auth`; new bypass journey in `e2e/tier2-flows.spec.ts`. Playwright webServer defaults to **127.0.0.1:4173** to reduce port clashes with local dev.
- Viewport smoke tests: `e2e/viewport-layout.spec.ts` (375 / 768 / 1024) for home + changelog.
- `useDebouncedValue` hook; **CustomerManagement** search uses 300ms debounce.
- `useOrgTeamRosterQuery` + **`queryKeys.org.teamRoster`**; **InviteStaff** uses TanStack Query + mutations with zod email pilot.
- OpenAPI + API Hub entries for **`portal-data`** (GET) and **`parse-config`** (POST SSE); `parse-config` top-level catch logs `parse_config_unhandled`.
- `docs/observability.md`: other-function log highlights + `rg` parity recipe; `docs/PERF-EXPLAIN.md`; `scripts/k6/smoke.js`; `supabase/seed.sql` stub.
- `EmptyState` on **AgentFleetPanel**, **SEHealthCheckHistory2**, **AssessmentHistory**, **DriftMonitor**, **TenantDashboard**, **CustomerManagement**, **AgentManager**; **`EmptyState` `description` accepts React nodes**.

- Optional signed-in Playwright path: workspace upload → Executive one-pager → Word `.docx` download + PDF export path (print preview `print()` stubbed via `window.open` wrapper; assert opener flag). See `docs/TEST-PLAN-TIER2-BACKLOG.md` (T9.3a).
- Deno: `api-public` smoke tests (`OPTIONS` 204, unknown `GET` 404) via exported `handleApiPublicRequest`.
- `docs/plans/tier-3-dx-backlog.md`: timeboxed Tier 3 DX/perf checklist from `docs/REVIEW.md`.
- Root `npm run typecheck` runs `tsc` against `tsconfig.ci.json` and `tsconfig.node.json` so application source is typechecked in CI.
- `npm run types:supabase` regenerates `src/integrations/supabase/types.ts` (requires Supabase CLI; project id embedded in script).
- Optional Edge secret `API_KEY_HMAC_SECRET` for HMAC of org service API keys (see `docs/SELF-HOSTED.md`).

### Changed

- Portal settings: tenant/bootstrap data loads via TanStack Query (`queryKeys.portal.tenantBootstrap`) with invalidation after save.
- Saved reports library (management drawer): list/delete via TanStack Query (`queryKeys.savedReports.packages`).
- `api-public` / `api-agent`: structured `logJson` on 404, auth failures, and unhandled errors; observability doc catalogs messages + latency dashboard hints.
- Setup wizard branding step and SE health-check Central API help extracted to focused components; portal viewers and scheduled reports empty rows use `EmptyState`.
- Report Centre empty state uses shared `EmptyState` + workspace CTA.
- API Hub / `openapi.yaml`: document public `api-public` shared-report and shared-health-check GET paths for embeds.
- `docs/REVIEW.md` — scorecard, Dimension 1–7 findings, Tier 2/3 checkboxes, and **§4 THE BRUTAL TRUTH** aligned with review follow-on: **E2E auth bypass**, **viewport** Playwright, **EmptyState** sweep (fleet / SE / assessments / drift / customers / AgentManager), **Invite Staff** Query + zod pilot, **`portal-data` / `parse-config`** OpenAPI, **`parse_config_unhandled`**, **debounce** / **k6** smoke / **seed** stub / **PERF-EXPLAIN** / partial stable keys.
- Client toasts use Sonner only (removed duplicate shadcn toast stack).
- Scheduled report sender batches `agent_submissions` by org; health-check follow-ups batch `se_profiles`; regulatory scanner batches `upsert` rows.
