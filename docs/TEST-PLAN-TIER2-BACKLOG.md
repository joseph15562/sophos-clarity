# Test plan — Tier 2 engineering backlog

**Purpose:** Regression and validation checklist for the Tier 2 backlog (TypeScript/CI, lint, UI refactors, N+1 batching, primitives, mutations, edge validation/logging, tests/a11y). Use after each themed PR or before a release train.

**Environments:** Local dev (optional staging). **CI must be green:** `npm run lint`, `npx tsc --noEmit` (or project-specific command once fixed), `npm test`, `npm run build`, `npm run test:e2e`, `npm run test:deno` (if applicable).

**Pass criteria (global):** No new unhandled console errors on exercised paths; no duplicate critical toasts; critical user journeys match pre-change behaviour unless intentionally changed.

---

## 1. TypeScript and CI

| ID   | Objective                         | Type      | Steps                                                            | Pass |
| ---- | --------------------------------- | --------- | ---------------------------------------------------------------- | ---- |
| T1.1 | CI typechecks application sources | Automated | CI “Type-check” step passes; locally run the same command as CI. | ☐    |
| T1.2 | Strictness ramp (if enabled)      | Automated | `tsc` + `build` green after flag changes.                        | ☐    |
| T1.3 | Main flows still load             | Manual    | Open `/`, guest/skip if shown, signed-in hub if you use auth.    | ☐    |

---

## 2. ESLint `@typescript-eslint/no-unused-vars` (warn)

| ID   | Objective              | Type      | Steps                                     | Pass |
| ---- | ---------------------- | --------- | ----------------------------------------- | ---- |
| T2.1 | Lint policy acceptable | Automated | `npm run lint` completes per team policy. | ☐    |

---

## 3. UI/UX and docs (Sonner, polling, types, HMAC, CHANGELOG)

### 3.1 Sonner-only toasts

| ID    | Objective              | Type   | Steps                                                                 | Pass |
| ----- | ---------------------- | ------ | --------------------------------------------------------------------- | ---- |
| T3.1a | Management drawer      | Manual | Trigger an action that used shadcn toast; one Sonner toast, readable. | ☐    |
| T3.1b | Portal configurator    | Manual | Save/validation path shows Sonner (or agreed pattern).                | ☐    |
| T3.1c | Client portal          | Manual | Same as above on a portal flow.                                       | ☐    |
| T3.1d | Report generation hook | Manual | Start report generation; success/failure toast once, no double stack. | ☐    |
| T3.1e | No duplicate Toasters  | Manual | Only one global toast host in app shell.                              | ☐    |

### 3.2 Polling `useEffect` cleanup

| ID    | Objective                   | Type   | Steps                                                                                              | Pass |
| ----- | --------------------------- | ------ | -------------------------------------------------------------------------------------------------- | ---- |
| T3.2a | Agent fleet poll teardown   | Manual | Start activity that polls; navigate away; no “unmounted component” / runaway requests in DevTools. | ☐    |
| T3.2b | Agent manager poll teardown | Manual | Same for agent manager surface.                                                                    | ☐    |

### 3.3 Supabase `types.ts` regeneration

| ID    | Objective     | Type      | Steps                                       | Pass |
| ----- | ------------- | --------- | ------------------------------------------- | ---- |
| T3.3a | Build and app | Automated | `npm run build`; smoke open hub + one CRUD. | ☐    |

### 3.4 HMAC / API key secret (when implemented)

| ID    | Objective             | Type   | Steps                                                              | Pass |
| ----- | --------------------- | ------ | ------------------------------------------------------------------ | ---- |
| T3.4a | Existing keys work    | Manual | After migration window: connector ping with existing key succeeds. | ☐    |
| T3.4b | New keys (if rotated) | Manual | Issue new key; verify; revoke; denied after revoke.                | ☐    |

### 3.5 CHANGELOG

| ID    | Objective | Type   | Steps                                           | Pass |
| ----- | --------- | ------ | ----------------------------------------------- | ---- |
| T3.5a | Doc valid | Manual | Root `CHANGELOG.md` present, links sane if any. | ☐    |

---

## 4. Edge function batching (N+1)

### 4.1 `send-scheduled-reports`

| ID   | Objective                    | Type   | Steps                                                                                                  | Pass |
| ---- | ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------ | ---- |
| T4.1 | Multiple due reports correct | Manual | Trigger with several due rows (staging); each report gets expected payload/recipients; no silent skip. | ☐    |

### 4.2 `health-checks` follow-up emails

| ID   | Objective                | Type   | Steps                                                                                                    | Pass |
| ---- | ------------------------ | ------ | -------------------------------------------------------------------------------------------------------- | ---- |
| T4.2 | Profile batching correct | Manual | Multiple `due` rows, mixed `se_user_id`; emails use correct names; DB `followup_sent` updated as before. | ☐    |

### 4.3 `regulatory-scanner` upserts

| ID   | Objective  | Type   | Steps                                                     | Pass |
| ---- | ---------- | ------ | --------------------------------------------------------- | ---- |
| T4.3 | Idempotent | Manual | Run twice; counts stable; no duplicate-key failure storm. | ☐    |

---

## 5. Frontend batching (`AgentFleetPanel`, `AgentManager`)

| ID   | Objective                 | Type   | Steps                                                                                                               | Pass |
| ---- | ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- | ---- |
| T5.1 | Submissions map correctly | Manual | Tenant with multiple agents: each row shows correct latest submission; network shows batched fetch vs N sequential. | ☐    |

---

## 6. `LoadingState`, `SafeHtml`, `EmptyState`

| ID    | Objective                        | Type   | Steps                                                                                       | Pass |
| ----- | -------------------------------- | ------ | ------------------------------------------------------------------------------------------- | ---- |
| T6.1  | Loading consistency              | Manual | Key pages: loading/skeleton still sensible.                                                 | ☐    |
| T6.2  | Report HTML renders              | Manual | Open document preview + shared report: tables/lists/formatting OK.                          | ☐    |
| T6.3  | Sanitization not over-aggressive | Manual | Spot-check AI HTML (code blocks, lists); compare to pre-change screenshot if needed.        | ☐    |
| T6.4  | Empty lists                      | Manual | Each wired empty state: copy + CTA correct; data appears when added.                        | ☐    |
| T6.5  | Report Centre — no saved reports | Manual | With no reports: `EmptyState` shows; **Go to workspace** navigates to workspace.            | ☐    |
| T6.6  | Portal viewers empty             | Manual | No viewers: `EmptyState` + copy; invite form still usable.                                  | ☐    |
| T6.7  | Scheduled reports empty          | Manual | No schedules: `EmptyState`; create flow still reachable.                                    | ☐    |
| T6.8  | Saved library (drawer) empty     | Manual | No packages: `EmptyState` in Management drawer library.                                     | ☐    |
| T6.9  | Agent fleet / connector          | Manual | No agents, no submissions, filter miss: `EmptyState` copy + actions in **AgentFleetPanel**. | ☐    |
| T6.10 | SE health history                | Manual | No rows: `EmptyState` in **SEHealthCheckHistory2**.                                         | ☐    |
| T6.11 | Assessment history               | Manual | No snapshots: `EmptyState` in **AssessmentHistory**.                                        | ☐    |
| T6.12 | Drift monitor                    | Manual | No snapshots: `EmptyState` + back CTA on **DriftMonitor**.                                  | ☐    |
| T6.13 | Tenant dashboard                 | Manual | No customers: `EmptyState` in **TenantDashboard**.                                          | ☐    |
| T6.14 | Customer management              | Manual | No customers: `EmptyState` + onboard CTA on **CustomerManagement**.                         | ☐    |
| T6.15 | Connector register               | Manual | No agents: `EmptyState` in **AgentManager** (Management drawer).                            | ☐    |

---

## 7. `useMutation` and query invalidation

| ID   | Objective           | Type   | Steps                                                              | Pass |
| ---- | ------------------- | ------ | ------------------------------------------------------------------ | ---- |
| T7.1 | Lists refresh       | Manual | After write: list/detail updates without full reload.              | ☐    |
| T7.2 | Double-submit guard | Manual | Rapid double-click does not duplicate resource (where applicable). | ☐    |
| T7.3 | Error surfaces      | Manual | Forced error shows toast/message; UI not left inconsistent.        | ☐    |

---

## 8. Edge routes — Zod, API docs, structured logging

| ID   | Objective               | Type        | Steps                                                          | Pass |
| ---- | ----------------------- | ----------- | -------------------------------------------------------------- | ---- |
| T8.1 | Happy-path APIs         | Manual/Auto | Exercised clients (app, agent) succeed.                        | ☐    |
| T8.2 | Bad payload 4xx         | Manual      | Malformed body → stable 4xx JSON, no stack leak to client.     | ☐    |
| T8.3 | Docs vs reality         | Manual      | Sample `curl`/UI match documented auth + paths.                | ☐    |
| T8.4 | Logs JSON + no PII leak | Manual      | Supabase logs: structured lines; no unexpected secrets/emails. | ☐    |

---

## 9. Automated tests and accessibility

| ID    | Objective                   | Type      | Steps                                                                                                                                                                                                                                                                                                                                                                                  | Pass |
| ----- | --------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| T9.1  | Unit tests                  | Automated | `npm test`                                                                                                                                                                                                                                                                                                                                                                             | ☐    |
| T9.2  | Deno shared/tests           | Automated | `npm run test:deno`                                                                                                                                                                                                                                                                                                                                                                    | ☐    |
| T9.3  | Playwright                  | Automated | `npm run test:e2e`                                                                                                                                                                                                                                                                                                                                                                     | ☐    |
| T9.3a | Signed-in workspace journey | Automated | **Bypass (no secrets):** CI build sets `VITE_E2E_AUTH_BYPASS=1`; Playwright webServer passes same; `tier2-flows` describe **signed-in hub (E2E bypass)** runs upload → **Executive One-Pager** → Word `.docx` + PDF print stub (`__E2E_PDF_PRINT__`). **Optional secrets:** `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` still run the **real sign-in** duplicate journey for live Supabase. | ☐    |
| T9.4  | axe (if integrated)         | Automated | CI axe step green or waivers documented.                                                                                                                                                                                                                                                                                                                                               | ☐    |

**Playwright follow-ons (when product or CI changes):** If PDF export becomes a real browser **download** (blob / `Content-Disposition`) instead of print, add `page.waitForEvent("download")` and assert `.pdf` filename or minimum size. If CI **drops** `VITE_E2E_AUTH_BYPASS`, use **`page.route`** mocks for Supabase auth/session (or a dedicated test project with seed data) so signed-in journeys stay green without `E2E_USER_*` secrets. For any spec that waits on **live AI** or slow network, use **`test.describe.configure({ timeout: 120_000 })`** (or an env gate) rather than raising the global Playwright timeout in `playwright.config.ts`.

---

## 10. AI-generated reports (regression band)

Run after any change to **parse/stream edge routes**, **markdown/HTML pipeline**, or **`SafeHtml`/DOMPurify**.

| ID    | Objective                      | Type   | Steps                                                                                                  | Pass |
| ----- | ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------ | ---- |
| T10.1 | Technical report end-to-end    | Manual | Upload config → run analysis → generate **technical** AI report → stream completes → preview readable. | ☐    |
| T10.2 | Executive / evidence (if used) | Manual | Same for other report types you ship.                                                                  | ☐    |
| T10.3 | Export (if used)               | Manual | PDF/DOCX/ZIP still produces file without error.                                                        | ☐    |
| T10.4 | Shared report view             | Manual | Open a shared link; HTML renders; no blank/sanitized-to-empty body.                                    | ☐    |

---

## Release smoke (minimal)

Execute before tagging a release if any Tier 2 item shipped:

1. Guest path: landing → upload/analyse visible outcome.
2. Signed-in path (if applicable): open hub, one save/load assessment.
3. One AI report completes (T10.1).
4. Agent or fleet view loads (if you use connectors).
5. CI green on `main`.

---

## Sign-off

| Role   | Name | Date | Notes |
| ------ | ---- | ---- | ----- |
| Tester |      |      |       |
