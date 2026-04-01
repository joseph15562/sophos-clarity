# REVIEW “100%” program — implementation evidence (living)

Companion to the Cursor plan **REVIEW 100% program** (do not duplicate the plan file). Link PRs and docs here as work lands.

## Phase A — Testing + PDF

- Executive one-pager **real `.pdf` download** when `VITE_E2E_PDF_DOWNLOAD=1` ([src/lib/executive-report-pdfmake.ts](../../src/lib/executive-report-pdfmake.ts), [DocumentPreview](../../src/components/DocumentPreview.tsx)); Playwright asserts download ([e2e/tier2-flows.spec.ts](../../e2e/tier2-flows.spec.ts)); CI build env in [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml), [staging.yml](../../.github/workflows/staging.yml), [playwright.config.ts](../../playwright.config.ts).
- **process-job-outbox** exported handler + **401** test when `CRON_SECRET` mismatches ([supabase/functions/process-job-outbox/](../../supabase/functions/process-job-outbox/)).
- **portal-data** Zod strict query tests ([portal_data_query_test.ts](../../supabase/functions/portal-data/portal_data_query_test.ts)).
- **parse-config** auth gate tests remain in [auth_gate_test.ts](../../supabase/functions/parse-config/auth_gate_test.ts).

## Phase B — Architecture

- Boundary check: `rg 'supabase\.from' src/pages src/components` → **0** (April 2026); documented in [client-data-layer.md](../api/client-data-layer.md).
- **SE Health Check** results UI: [HealthCheckResultsSection.tsx](../../src/pages/health-check/HealthCheckResultsSection.tsx) (context **`useHealthCheckInnerModel`** + **`HealthCheckInnerModel`** props spread).

## Phase C — Performance + journey

- [scripts/assert-bundle-budget.mjs](../../scripts/assert-bundle-budget.mjs) after production build.
- Analysis failure **toast** on every terminal error with deduped id ([use-report-generation.ts](../../src/hooks/use-report-generation.ts)).
- **Abort/signal sweep (March–April 2026):** **`useAbortableInFlight`**, **`mergeAbortSignals`**, **`streamConfigParse` / `streamChat` `signal`**, **`loadSavedReportsCloud(signal)`**, **`PortalViewerManager`**, **`use-config-upload`** mutations + poll, **Auth / passkey / invite / alert / scheduled reports**; **PSA** (**Autotask** / **ConnectWise Manage** + **Cloud** + **Org service keys**), **`ConfigUpload`**, **`SharedHealthCheck`**, **`ClientPortal`** **`portal-data`** **`fetch`** (generation + **`AbortController`**), **`AgentFleetPanel`** / **`AgentManager`** run-now + delete, **SE team drawer** / **history** / **ticket-from-finding** / **Teams+Slack test** / **`TeamInviteAccept`** / **follow-up PATCH**; Vitest [merge-abort-signals.test.ts](../../src/lib/__tests__/merge-abort-signals.test.ts). **Follow-on:** **`callGuestCentral`** + other **`src/lib`** **`fetch`** ([client-data-layer.md](../api/client-data-layer.md)).

## Phase D — Scalability + observability

- Dashboard + alert checklist in [observability.md](../observability.md) (§ Log drains — operational checklist).

## Phase E — Security + docs + DX

- Shared health-check **Print / PDF** uses sandboxed iframe + blob URL ([SharedHealthCheck.tsx](../../src/pages/SharedHealthCheck.tsx)).
- [dependabot.yml](../../.github/dependabot.yml) for npm.
- ESLint **`no-unused-vars`: `error`** for [src/hooks](../../src/hooks) ([eslint.config.js](../../eslint.config.js)).
- [CHANGELOG-POLICY.md](../CHANGELOG-POLICY.md).

## Phase F — Product + UX

- [feature-flags.ts](../../src/lib/feature-flags.ts); [product-analytics-dashboard.md](../product-analytics-dashboard.md).
- Opt-in **Playwright screenshots**: [e2e/visual-smoke.spec.ts](../../e2e/visual-smoke.spec.ts) (set **`PLAYWRIGHT_UPDATE_SNAPSHOTS=1`** or **`CI_VISUAL_SNAPSHOTS=1`**).
- **External WCAG audit** — still required for **UX 10**; track in REVIEW rescoring.

## Phase G — Rescore

- Update [REVIEW.md](../REVIEW.md) with dated evidence links; **10/10** rows require subjective sign-off + external audits where noted.
