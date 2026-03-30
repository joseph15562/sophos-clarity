# Plan: Address “outgrown architecture” pressure

**Source:** Mirrors Cursor plan `architecture_pressure_remediation_a0859c58` (team copy in git).

## Problem framing

Three pressures reinforce each other:

- **Frontend:** Large surfaces (`HealthCheck2.tsx`, `SetupWizard.tsx`) concentrate state, effects, and UI.
- **Backend:** Route modules under `supabase/functions/api/routes/` behave like a product API but need a **contract artifact** (OpenAPI + Zod) and consistent validation.
- **Client IO:** Ad-hoc `fetch` without consistent **cancellation / cache** — align with TanStack Query and `queryKeys`.

## Phase A — API as a product

1. Zod on high-traffic `api` bodies; reuse `logJson` on `safeParse` failure.
2. Centralize schemas in `supabase/functions/_shared/api-schemas.ts`.
3. Maintain `docs/api/openapi.yaml` (partial); link from `docs/api/edge-routes.md`.
4. Deno tests for schema behavior in `_shared/api_schemas_test.ts`.

## Phase B — Decompose megafiles

- **HealthCheck2:** Extract hooks and section components under `src/pages/health-check/`; target &lt;800 lines for the page composer.
- **SetupWizard:** Step components + thin orchestrator.

## Phase C — Client data layer

- Migrate read-heavy flows to TanStack Query with `src/hooks/queries/keys.ts`; use `AbortSignal` where supported.

## Phase D — Observability and ADRs

- Sentry / log drains; ADRs under `docs/adr/`.

## Doc hygiene

- Reconcile Tier 3 checklist with `tsconfig.app.json` (`noImplicitAny` already on).

---

## Execution log (high level)

| When    | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03 | Shipped `_shared/api-schemas.ts`; Zod on `agent` (register, heartbeat, submit, verify-identity), `admin` (reset-mfa), `auth/mfa-recovery`, `assessments` list query; `docs/api/openapi.yaml` + edge-routes link; `_shared/api_schemas_test.ts`; HealthCheck URL/hash hooks extracted; ADRs 0001–0002; REVIEW Tier 3 checkbox fix.                                                                                                                                               |
| 2026-03 | Remediation slice: `HealthCheck2.tsx` thin shell + `health-check/HealthCheckInner.tsx`; `use-config-upload` → `useQuery` + `queryKeys.seHealthCheck.configUploadRequests`; SetupWizard → `setup-wizard/SetupWizardBody.tsx` + `setup-storage.ts`; Zod on `health-checks`, `se-teams`, `passkey/register-verify`, `connectwise/credentials`; optional Sentry (`init-sentry.ts`, ADR 0003); `ScheduledReportInsert` typecheck fix.                                                |
| 2026-03 | REVIEW §4: PSA/Manage routes Zod + `logJson` names; `docs/api/openapi.yaml` Autotask/Manage paths; `ApiDocumentation.tsx` PSA summaries; `docs/observability.md` + SELF-HOSTED link; per-route Deno contract tests under `api/routes/*_test.ts`; portal viewers Query migration + `docs/api/client-data-layer.md`.                                                                                                                                                              |
| 2026-03 | REVIEW follow-on slice: Playwright PDF path via stubbed `print` + `__E2E_PDF_PRINT__`; `SavedReportsLibrary` → `useQuery`/`useMutation` + `queryKeys.savedReports`; `EmptyState` on portal viewers + scheduled reports; `BrandingStep` + `HealthCheckCentralApiHelp` extractions; `api-public`/`api-agent` `logJson` + `handleApiPublicRequest` + Deno `api-public/api_public_test.ts`; observability latency table + agent/public catalogs; `docs/plans/tier-3-dx-backlog.md`. |
| 2026-03 | Architecture maturity plan: Management drawer PSA flags + submission retention → Query; Customer Management → `fetchCustomerDirectory` + `useCustomerDirectoryQuery`; `client-data-layer.md` inventory; OpenAPI + API Hub for guest `config-upload` + SE `config-upload-request`; `GuideUploadStep`; health-check upload-requests dialog + ConfigHistory/AuditLog/NotificationCentre/PortfolioInsights `EmptyState`; `docs/SCALE-TRIGGERS.md`.                                  |
