# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Curated release notes for end users also appear on the in-app **What’s new** page (`/changelog`).

## [Unreleased]

### Fixed

- **Demo / agent assessments:** `firewall_config_links` queries use `maybeSingle()` so “no link yet” no longer surfaces as HTTP 406 in the browser console.
- **Report generation:** skip calling `parse-config` when extracted sections are empty (avoids repeated 400s and retries for agent-only or demo rows without a real HTML export).
- **Management — fleet overview:** tolerate missing `riskScore` or `categories` on snapshot firewalls so the drawer does not crash on sparse demo data.

### Changed

- **Fleet Command:** when Sophos Central is connected and healthy, show a compact “Connected to Sophos Central” strip (aligned with Customer Management’s Central pill), partner API type, relative last sync, and link to Central settings (`CentralHealthBanner` `showConnectedIndicator`).

- **Assess — compliance (multi-firewall):** union of per-upload compliance frameworks is passed into analysis tabs; heatmap, posture ring, coverage bars, gap analysis, evidence collection, and control–finding map merge deduplicated findings from all loaded configs instead of only the first file’s analysis.

- **Assess — Sophos Central:** per-upload **Link to Sophos Central** is full width with a lighter outline-style trigger; expanded picker keeps roomier padding, `h-10` inputs, taller scroll list, and larger row typography.

- **Assess — Assessment Context:** **Report identity** and **Customer name** are combined in one column; **environment** and **country** dropdowns removed from this card (set per upload under **Compliance (this firewall)** or via Central / Fleet defaults). Directory customer selection still hydrates branding geo fields in the background when available.

- **Assess — compliance per upload:** removed the global **Compliance alignment** card; each config row has **Compliance (this firewall)** (web filter mode + framework grid). Every upload gets a `configComplianceScopes` entry seeded from Customer context; deterministic analysis and AI reports use per-file scope (and `webFilterComplianceMode` on scope). Unlinking clears the Central tenant label on the scope but no longer deletes the row. Multi-device compliance prompts include per-firewall web-filter mode when set to informational. Per-row **Scope for this export** (environment, country, US state) shows when the file is unlinked or the Central link did not populate both sector and country on the scope; otherwise chips stay above the link control only.

### Added

- **Assess — Customer Context:** directory selection, `?customer=` (after directory loads), and Central firewall links hydrate global environment, country, and default frameworks when still empty (single-file from link; multi-file only while global geo unset).

- **Assess — per-config compliance scope:** `configComplianceScopes` keyed by upload id; Central link updates one config only; **`explicitSelectedFrameworks`** per linked file (full grid under the row, seeded on link); legacy sessions without explicit still use implicit geo + `additionalFrameworks`; `parse-config` accepts `perFirewallComplianceContext` and `jurisdictionSummary` for multi-jurisdiction compliance/executive reports; session persistence includes the map.

- **Trust page — Legal & questionnaires:** security-review checklist, SOC2/ISO control mapping stub table, data-flow diagram placeholders (with DATA-PRIVACY link), questionnaire topic matrix, legal document link stubs, procurement callout; **Subprocessors** section id **`#trust-subprocessors`** for in-page links.

- **UX / a11y / forms (March 2026)** — `EmptyState` on remediation progress/roadmap and geographic fleet map; **`e2e/viewport-signed-in.spec.ts`** expanded (signed-in viewports + axe; session storage cleared in E2E; Overview tab matcher + **ExtractionSummary** `covHex` for coverage bar); **`docs/UI-NOTIFICATIONS.md`** (toasts vs Notification Centre); **jest-axe** on **ExportCentre**, **EmptyState**, **UploadSection** tests; **Zod** field validation on **InviteStaff** and **WebhookSettings**; **ExportCentre** `reviewerSignoff` wired from cloud-linked assessment in **Index** / **AnalysisTabs** / **AssessmentHistory**; **WorkspaceSettingsStrip** “Opens on Assess” contrast (light theme) for axe on **/customers**.

- **March 2026 compliance & Tier 3 slice** — Postgres **`assessments.reviewer_signed_*`** / **`reviewer_signoff_notes`** (migration `20260330203000_assessments_reviewer_signoff.sql`); **Assessment History** sign-off UI (cloud); **Export Centre** non-blocking validation alert (**`collectFindingExportValidationIssues`**) and compliance findings CSV (**`exportFindingsCsv`** with frameworks); optional CSV **reviewer sign-off** block via **`ExportCentre`** `reviewerSignoff` prop (wire from Assess when snapshot-linked export is desired). **CertificatePostureStrip** (Compliance) and **VpnTopologyDiagram** (Security); **Assessment History** score-trend **CSV** export. **`use-company-logo`** → TanStack Query + **`src/lib/data/company-logo.ts`** / **`queryKeys.org.companyLogo`**. **SE Health Check:** **`AbortSignal`** on **send-report** `fetch`; **`supabaseWithAbort`** on prepared-by migration. **`SEScoreTrendChart`** wrapped in **`React.memo`**; **EvidenceCollection** stable keys. **`manage_deeplink_blocked_viewer`** telemetry when viewers hit blocked workspace settings deeplinks. Docs: **`docs/OPS-SCHEDULED-REPORTS-QUEUE.md`**, **`docs/product-telemetry-events.md`**, **`docs/PLAYWRIGHT-STAGING.md`**; **`docs/plans/full-backlog-sequence.md`**; expanded **`deploy/helm/sophos-clarity/README.md`**.

- **Fleet & playbook Query layer** — `agent-submissions-latest.ts`, `useAgentSubmissionsLatestBatchQuery`, `useRemediationPlaybookIdsQuery`; **PPTP/L2TP** + **email anti-spam** analysis signals; **control IDs** on findings CSV/PDF and SE Health Check CSV + optional **reviewer sign-off**; **GuideOptimisationStep** / **GuideRemediationStep**; **`report-export-validation.ts`** (see Unreleased above for Phase 4 export UI extensions).
- **Workspace primary nav** (Assess, Fleet, Customers, Reports, …) on every signed-in hub page — Fleet, Customers, Reports (including saved report viewer), Insights, Drift, Playbooks, API, Trust, and What’s new — not only the Assess screen; Reports stays highlighted on `/reports/saved/:id`.

- **ADR 0004 wave 2** — TanStack Query hooks and `src/lib/data` helpers for management-drawer settings: team invites/revokes, scheduled reports CRUD, portal bootstrap + save, passkey delete, MSP setup checklist, org agents + 7d submission counts, shared remediation mutations.
- **Scheduled report job queue** — **`job_outbox`** + **`claim_job_outbox_batch`**; **`send-scheduled-reports`** enqueues due runs; **`process-job-outbox`** claims, sends (Resend), retries with backoff, dead-letters after max attempts. Shared **`scheduled-report-email.ts`**; runbook in [`docs/SELF-HOSTED.md`](docs/SELF-HOSTED.md) and [`docs/job-queue-outline.md`](docs/job-queue-outline.md).
- **`portal-data`** GET query schema ([`portal_data_query.ts`](supabase/functions/portal-data/portal_data_query.ts)) with Deno tests (invalid / long slug).
- **`send-scheduled-reports`** — **`handler.ts`** exports **`handleSendScheduledReports`** (testable without `serve`) + Deno OPTIONS smoke test + **`scheduled-report-email`** unit tests.
- Setup wizard **`GuideAiReportsStep`** extraction; optional Edge Sentry placeholder **`supabase/functions/_shared/sentry-edge.ts`**.
- **Product route telemetry** — `spa_page_view` via `ProductRouteTelemetry` when `VITE_ANALYTICS_INGEST_URL` is set (`src/components/ProductRouteTelemetry.tsx`).
- **Optional Upstash Redis** for **`portal-data`** GET caching (`UPSTASH_REDIS_REST_*` Edge secrets); docs in **`docs/redis-pilot.md`**.
- **Engineering docs:** **`docs/job-queue-outline.md`**, **`docs/pdf-generation-client-ceiling.md`**, **`docs/threat-model-stride-oneshot.md`**, **`docs/bundle-lighthouse-notes.md`**.
- **`src/lib/feature-flags.ts`** — build-time `VITE_FEATURE_*` toggles; Vitest coverage in **`src/lib/__tests__/feature-flags.test.ts`**.
- **CI:** Deno `fmt --check` + **`npm run test:deno`** on **`deploy.yml`** / **`staging.yml`**; **`npm test -- --coverage`** with Vitest threshold floors.
- **OpenAPI** path entries for **`send-scheduled-reports`**, **`agent-nudge`**, **`regulatory-scanner`**, **`sophos-central`** (with `functions/v1` base server).
- **`npm run format:deno`** / **`format:check:deno`**; **`deno fmt`** applied across **`supabase/functions`**.

- **`src/lib/supabase-with-abort.ts`** — shared helper so TanStack Query `signal` can cancel Supabase reads; wired into agents, customer directory, team roster, PSA flags, submission retention, passkeys, health-check list, and SE teams fetch.
- **`useOrgCloudPurgeMutation`** — org data-governance purge + cache invalidation; optional **`workspace_data_purged`** product telemetry when **`VITE_ANALYTICS_INGEST_URL`** is set (**`docs/SELF-HOSTED.md`**).
- **`docs/SELF-HOSTED.md`** — optional **`VITE_ANALYTICS_INGEST_URL`** for SPA event ingest.
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
- `npm run types:supabase` regenerates `src/integrations/supabase/types.ts` (requires Supabase CLI; set `SUPABASE_PROJECT_REF` or `SUPABASE_PROJECT_ID`).
- Optional Edge secret `API_KEY_HMAC_SECRET` for HMAC of org service API keys (see `docs/SELF-HOSTED.md`).

### Changed

- **Keyboard shortcuts** modal (**?**) — light mode uses an opaque **card** surface and disables the default dialog blur so the navy assess shell does not show through; shortcut keycaps use **background** in light mode for clearer contrast. Dark mode appearance unchanged.

- **Tours** dropdown (Compass) — light mode uses the standard **popover** surface and **popover-foreground** for menu rows instead of a forced dark gradient with dark text. Dark mode keeps the glassy navy gradient panel.

- **Assess — report view:** the same **full-width bottom bar** as the analysis dashboard shows **Tours** and **Shortcuts** (no floating corner pills). **View Findings** / **Generate Reports** stay on the analysis layout only.

- **Sticky bottom bar (light theme):** translucent gradient (not near-opaque white), **backdrop-blur-2xl**, and **backdrop-saturate** so the bar reads as frosted glass like dark mode.

- **Analysis tabs** — **Tab order:** Overview → Security → Compliance → **Remediation** (if findings) → Optimisation → Tools → **Insurance Readiness** → Compare. **Eager (static) imports** in **`AnalysisTabs`** for each tab’s primary surface — **`ScoreDialGauge`**, **`ScoreDeltaBanner`**, **`QuickActions`**, **`RiskScoreDashboard`**, **`ComplianceHeatmap`**, **`SophosBestPractice`**, **`RuleOptimiser`**, **`InsuranceReadiness`**, **`RemediationPlaybooks`** — so Vite dev is not blocked on **`React.lazy` / Suspense** for those; remaining widgets still lazy-load with preload + dev retry + tab-hover prefetch (Radix unmounts inactive panels). Removed unused **`FleetComparison`** lazy stub.
- ESLint **`@typescript-eslint/no-unused-vars`**: **`error`** under **`src/lib/**`** only; **`warn`** elsewhere (with `\_`-prefix ignores).
- **OpenAPI** — **`portal-data`** GET query parameters include **`maxLength`** aligned with Edge Zod.
- **`ScoreDialGauge`** wrapped in **`React.memo`** (alongside **`ScoreTrendChart`**).
- **Compliance heatmap** — debounced cell tooltips; secondary **`<img>`** marks: **`loading="lazy"`** / **`decoding="async"`** on several shared / portal / wizard / drawer surfaces.
- **`docs/REVIEW.md`** — scorecard (**~79/100** March 30 follow-on), Dimension 8 ESLint finding, Tier 2/3 Zod/API checklist, **`job_outbox`** / **`ScoreDialGauge`** / Deno coverage narrative.
- SE Health Check: clearer toast when an uploaded file is not a valid Sophos HTML/XML export; **`health_check_config_parse_failed`** telemetry event (optional ingest).
- AI report generation: failure toasts title **Analysis did not finish** and mention **Retry analysis** on the report panel.
- LocalStorage JSON fallbacks in **finding-snapshots**, **scheduled-reports**, and **config-snapshots** log via **`warnOptionalError`** instead of silent **`catch`**.
- **Stale deploy recovery:** error UI explains “module script” / dynamic-import failures after releases, offers **Reload page** (full refresh), and once-per-session auto-reload on matching `unhandledrejection`. Non-asset routes send `Cache-Control: …, no-cache` so browsers revalidate the SPA shell sooner.
- Portal settings: tenant/bootstrap data loads via TanStack Query (`queryKeys.portal.tenantBootstrap`) with invalidation after save.
- Saved reports library (management drawer): list/delete via TanStack Query (`queryKeys.savedReports.packages`).
- `api-public` / `api-agent`: structured `logJson` on 404, auth failures, and unhandled errors; observability doc catalogs messages + latency dashboard hints.
- Setup wizard branding step and SE health-check Central API help extracted to focused components; portal viewers and scheduled reports empty rows use `EmptyState`.
- Report Centre empty state uses shared `EmptyState` + workspace CTA.
- API Hub / `openapi.yaml`: document public `api-public` shared-report and shared-health-check GET paths for embeds.
- `docs/REVIEW.md` — scorecard, Dimension 1–7 findings, Tier 2/3 checkboxes, and **§4 THE BRUTAL TRUTH** aligned with review follow-on: **E2E auth bypass**, **viewport** Playwright, **EmptyState** sweep (fleet / SE / assessments / drift / customers / AgentManager), **Invite Staff** Query + zod pilot, **`portal-data` / `parse-config`** OpenAPI, **`parse_config_unhandled`**, **debounce** / **k6** smoke / **seed** stub / **PERF-EXPLAIN** / partial stable keys.
- **PDF (print) & Word report exports:** tables use Sophos navy headers, light zebra rows, and `table-layout: fixed` with wrapping so wide firewall-rule grids stay on the page instead of clipping; Word uses landscape + a fixed column grid. Document preview export buttons no longer shrink awkwardly in tight layouts.
- **PDF print (refine):** report header bar no longer clips date/meta in print; tables use Sophos accent left rule, `break-word` (not per-letter breaks), tighter header typography, and **sticky `th` disabled** for print. **A4 landscape** for all PDF/print exports (aligned with Word); removed fixed print chrome that caused **“Page 0 of 0”** and text sliced by the footer — use **@page** margins instead; paragraph **orphans/widows** tuned for print.
- Client toasts use Sonner only (removed duplicate shadcn toast stack).
- Scheduled report sender batches `agent_submissions` by org; health-check follow-ups batch `se_profiles`; regulatory scanner batches `upsert` rows.
