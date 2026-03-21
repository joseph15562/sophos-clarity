---
name: FireComply Review Implementation
overview: "A phased implementation plan addressing the code review: security and quick wins first, then shared types and CORS, then Index split and store, then bug hardening and tooling/testing."
todos: []
isProject: false
---

# FireComply Code Review — Implementation Plan

This plan turns the review into actionable work in five phases, with the **Top 5 refactors** and **critical security fixes** in Phases 1–3. Phases 4–5 cover robustness, tooling, and testing.

---

## Phase 1 — Security and shared helpers (high impact, low risk)

### 1.1 Dedicated HMAC secret for agent API

- **File:** [supabase/functions/api/index.ts](supabase/functions/api/index.ts)
- **Change:** Replace `const HASH_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""` with a dedicated env var, e.g. `AGENT_API_HMAC_SECRET`.
- **Actions:**
  - Use `Deno.env.get("AGENT_API_HMAC_SECRET") ?? ""` for `hmacHash` / `hmacVerify` only.
  - Document in README or deploy docs: set `AGENT_API_HMAC_SECRET` (e.g. 32+ byte hex) in Supabase Edge Function secrets; rotate independently from the service role key.
  - If unset, log a warning and reject agent auth (or fail fast on first use).

### 1.2 Supabase client env guard

- **File:** [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts)
- **Change:** Before `createClient`, assert URL and key are defined (e.g. throw a clear error in dev or when empty). Prevents silent `createClient(undefined, undefined)` and speeds up misconfiguration feedback.

### 1.3 Single `getFileLabel` helper and replace all usages

- **New/updated file:** Add helper in [src/lib/utils.ts](src/lib/utils.ts) (or new `src/lib/parsed-file.ts` if you prefer a dedicated module):

```ts
export function getFileLabel(f: { label?: string; fileName: string }): string {
  return f.label ?? f.fileName.replace(/\.(html|htm)$/i, "");
}
```

- **Replace in 6 files (21 occurrences):**
  - [src/pages/Index.tsx](src/pages/Index.tsx) — lines 106, 108, 169, 474, 551 (use `getFileLabel(f)` or remove local `fileLabel`/`label` and call helper).
  - [src/hooks/use-report-generation.ts](src/hooks/use-report-generation.ts) — 11 occurrences (lines 214, 222, 237, 270, 295, 325, 332, 348, 351, 376, 390).
  - [src/hooks/use-firewall-analysis.ts](src/hooks/use-firewall-analysis.ts) — line 17.
  - [src/components/RuleOptimiser.tsx](src/components/RuleOptimiser.tsx) — line 90.
  - [src/components/AttackSurfaceMap.tsx](src/components/AttackSurfaceMap.tsx) — line 29.
  - [src/components/AnalysisTabs.tsx](src/components/AnalysisTabs.tsx) — line 117 (return value of a small helper; replace with `getFileLabel(f)`).

Use a single pattern: `getFileLabel(f)` everywhere; where a closure exists only for this (e.g. Index’s `fileLabel`), remove it and call `getFileLabel` directly.

### 1.4 Shared CORS helper for Edge Functions

- **New file:** `supabase/functions/_shared/cors.ts`
  - Export `ALLOWED_ORIGINS` (array built from literal origins + `Deno.env.get("ALLOWED_ORIGIN")`) and `getCorsHeaders(req: Request)`.
  - Match current behavior: same headers and logic as in [supabase/functions/api/index.ts](supabase/functions/api/index.ts) (lines 17–35).
- **Update 5 functions** to import and use the shared helper (remove local ALLOWED_ORIGINS and getCorsHeaders):
  - [supabase/functions/api/index.ts](supabase/functions/api/index.ts)
  - [supabase/functions/parse-config/index.ts](supabase/functions/parse-config/index.ts)
  - [supabase/functions/sophos-central/index.ts](supabase/functions/sophos-central/index.ts)
  - [supabase/functions/portal-data/index.ts](supabase/functions/portal-data/index.ts)
  - [supabase/functions/regulatory-scanner/index.ts](supabase/functions/regulatory-scanner/index.ts)

Use relative import: `import { getCorsHeaders, ALLOWED_ORIGINS } from "../_shared/cors.ts";`. Note: `api/index.ts` currently assigns to a module-level `corsHeaders` and uses it in `json()`; either keep that pattern by calling `getCorsHeaders(req)` at request start and exporting a way to set a module-level variable, or pass headers into the response builder. Other functions use `getCorsHeaders(req)` per request; align api the same way where possible.

---

## Phase 2 — Canonical types and toast/React Query cleanup

### 2.1 Centralise ParsedFile and related types

- **New file:** `src/types/parsed-file.ts` (or `src/lib/parsed-file.ts`)
  - Define canonical `ParsedFile` (from [src/hooks/use-report-generation.ts](src/hooks/use-report-generation.ts) lines 81–91: id, label, fileName, content, extractedData, centralEnrichment?, serialNumber?, agentHostname?, hardwareModel?).
  - Re-export or define `CentralEnrichment` here if used across boundaries (currently in [src/lib/stream-ai.ts](src/lib/stream-ai.ts)); otherwise keep it in stream-ai and import into parsed-file only if needed for the type.
- **Update consumers:** Use the single type from this file:
  - [src/hooks/use-report-generation.ts](src/hooks/use-report-generation.ts) — remove local `ParsedFile`, import from types.
  - [src/hooks/use-firewall-analysis.ts](src/hooks/use-firewall-analysis.ts) — replace local inline type with `ParsedFile` from the same module (ensure it has the fields the hook needs: id, label, fileName, extractedData, centralEnrichment).
  - [src/pages/Index.tsx](src/pages/Index.tsx) — import `ParsedFile` from types where applicable.
  - [src/components/UploadSection.tsx](src/components/UploadSection.tsx) and any other components that reference `ParsedFile` — import from the canonical module.

Ensure `use-firewall-analysis` accepts the same `ParsedFile` shape (it may not need `content`; that’s fine as long as the type allows optional or unused fields).

### 2.2 Single toast system

- **File:** [src/App.tsx](src/App.tsx)
- **Change:** Remove one of the two toasts. Recommendation: keep **Sonner** only; remove `<Toaster />` from Radix.
- **Follow-up:** Search for `useToast()` (Radix) usage; migrate those call sites to Sonner’s `toast` API (e.g. `toast.success`, `toast.error`). Then remove Radix toast components and hook if unused.

### 2.3 React Query decision

- **Options:** (A) Remove `@tanstack/react-query` and `QueryClientProvider` if you do not plan to use them soon. (B) Keep and add one or two queries (e.g. saved reports list or portal data) to start adopting it.
- **Recommendation:** If no immediate plan to use React Query, remove it in this phase to reduce confusion; reintroduce later when adding server-state features. If you prefer to keep it, leave as-is and add a short comment in App that it’s reserved for future server state.

---

## Phase 3 — Index split and app state

### 3.1 Introduce a store for report/branding/view state

- **Goal:** Move report list, activeReportId, branding, viewingReports, and related setters out of Index state into a store so child components can subscribe to slices instead of receiving 20+ props.
- **Approach:** Add a small Zustand store (or a Context + useReducer) with slices such as: `files`, `reports`, `activeReportId`, `branding`, `viewingReports`, and actions like `setReports`, `setActiveReportId`, `setBranding`, `setViewingReports`, etc. Keep “session” and “UI” state (e.g. drawer open, wizard open) in Index or in the same store under a `ui` slice, as you prefer.
- **Files to add:** e.g. `src/stores/app-store.ts` (or `src/context/AppState.tsx`).
- **Files to refactor:** [src/pages/Index.tsx](src/pages/Index.tsx) — replace the relevant `useState` and props with store selectors and actions; pass only what’s still needed as props (e.g. callbacks that coordinate multiple actions).

### 3.2 Split InnerApp into smaller components

- **Target structure:**
  - **Shell:** Minimal `InnerApp` that renders layout, header, and the following.
  - **UploadAndAnalysis:** Upload section + AnalysisTabs when not viewing reports; receives files, handlers, and store-derived state.
  - **ReportView:** Report list, DocumentPreview, back button, save/start-over when viewing reports.
  - **AppModals (or similar):** ManagementDrawer, SetupWizard, KeyboardShortcutsModal, AIChatPanel, ConfigDiff (when in diff mode). These can stay in Index and receive props/state from the store or Index until they are further refactored.

Move state that is only used inside one of these areas into that component or into the store slice that component reads from. Keep shared state (files, reports, branding) in the store.

### 3.3 Constants for magic strings

- **New file:** e.g. `src/constants/analysis-tabs.ts` and `src/constants/report-ids.ts` (or a single `src/constants/app.ts`).
  - Tab ids: `"overview"`, `"remediation"`, `"compare"` → `AnalysisTabId` enum or const object.
  - Report ids: `"report-executive"`, `"report-compliance"`, and pattern `report-${fileId}` → `ReportId` or constants.
- **Refactor:** Replace string literals in [src/pages/Index.tsx](src/pages/Index.tsx), [src/components/AnalysisTabs.tsx](src/components/AnalysisTabs.tsx), and [src/hooks/use-report-generation.ts](src/hooks/use-report-generation.ts) with these constants to avoid typos and simplify refactors.

---

## Phase 4 — Bug fixes and robustness

### 4.1 Parsing errors: do not add invalid file

- **File:** [src/pages/Index.tsx](src/pages/Index.tsx), `handleFilesChange`.
- **Current behavior:** On parse failure, a toast is shown but the file is still pushed with `extractedData: {} as ExtractedSections`.
- **Change:** On catch, do **not** push the file into `parsed`; only push successfully parsed files. Optionally collect failed files and show a single toast listing them (“Could not parse: file1.html, file2.html”). This avoids downstream assumptions that every file has valid sections.

### 4.2 Central enrichment: avoid race between effect runs

- **File:** [src/pages/Index.tsx](src/pages/Index.tsx), the `useEffect` that calls `getCentralStatus`, `getCachedFirewalls`, `getAlerts`, etc. (~319–401).
- **Change:** Use a “run id” (e.g. `let runId = 0;` at top of effect, increment at start, capture in closure) or an `AbortController`. Before each `setFiles` / `setCentralEnriched`, check that the run id still matches the current run (or that the abort signal is not aborted). On cleanup, increment run id or abort the controller so in-flight async work does not update state for a stale run.

### 4.3 Report generation: guard setState after unmount / stale run

- **File:** [src/hooks/use-report-generation.ts](src/hooks/use-report-generation.ts)
- **Change:** Inside `generateSingleReport` (and any other async paths that call `setReports`, `setLoadingReportIds`, `setFailedReportIds`), use a ref `isMounted` or `runId` that is set to false or incremented when the component unmounts or when a new generation run starts. Before every state update, check that the component is still mounted or that the run id matches; skip updates if not. This prevents state updates after unmount or after the user has started a new action.

### 4.4 Session restore effect comment

- **File:** [src/pages/Index.tsx](src/pages/Index.tsx), `useEffect` with `loadSession()` (~199–206).
- **Change:** Add a one-line comment above the eslint-disable explaining “Run once on mount to restore session; loadSession is stable and has no external deps.” This documents why the deps array is intentionally empty and keeps the disable justified.

### 4.5 Save error message normalisation

- **File:** [src/pages/Index.tsx](src/pages/Index.tsx), `handleSaveReports` catch block.
- **Change:** Introduce a small helper, e.g. `function normalizeErrorMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }`, and use `setSaveError(normalizeErrorMessage(e))` so non-Error throws (e.g. string) still show the message instead of a generic “Save failed”.

### 4.6 User-facing errors for key flows

- **Scope:** Loading saved reports (ManagementDrawer / SavedReportsLibrary), Central status/enrichment, and any other user-initiated fetch that currently only logs or sets internal state.
- **Change:** In those flows, on error from `supabase.from(...)` or `fetch(...)`, call Sonner (or your chosen toast) with a short message (e.g. “Could not load saved reports. Please try again.”) so users know something failed instead of seeing stale or empty UI.

---

## Phase 5 — Tooling, lint, and tests

### 5.1 ESLint

- **File:** [eslint.config.js](eslint.config.js)
- **Change:** Re-enable `@typescript-eslint/no-unused-vars` as `"warn"` (or `"error"`). Fix or suppress existing violations.
- **Add:** `eslint-plugin-jsx-a11y` and enable recommended or a subset of a11y rules (e.g. `aria-props`, `aria-role`, `label-has-associated-control`). Fix critical issues that appear.

### 5.2 Prettier and Husky + lint-staged

- Add Prettier config (e.g. `.prettierrc` / `.prettierignore`) and format the repo once.
- Add Husky and lint-staged so that on commit, `lint-staged` runs (e.g. ESLint + Prettier on staged files, and optionally `npm test`). Document in README how to install hooks (`npx husky install` or similar).

### 5.3 E2E in CI

- **File:** [.github/workflows/deploy.yml](.github/workflows/deploy.yml) (or the workflow that runs on PR/push).
- **Change:** Add a job that runs Playwright (e.g. `npm run test:e2e`) with a minimal smoke: open app, optionally upload one file and open report view. Use CI-friendly settings (e.g. headed false, single worker if needed). Ensure required env (e.g. `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`) are set in the workflow for the E2E build.

### 5.4 Unit tests for new/refactored code

- **getFileLabel:** Add a small test in `src/lib/__tests__/utils.test.ts` or next to [src/lib/utils.ts](src/lib/utils.ts) (e.g. `utils.test.ts`): test with `{ fileName: "a.html" }`, `{ label: "X", fileName: "a.html" }`, `{ fileName: "b.HTM" }` and assert the returned label.
- **Session persistence:** If not already covered, add tests for `loadSession` / `saveSession` (or the exported helpers in [src/hooks/use-session-persistence.ts](src/hooks/use-session-persistence.ts)) with a mock localStorage.
- **normalizeErrorMessage:** Unit test the helper (Error vs string vs undefined).

### 5.5 Integration tests for high-risk flows (optional but recommended)

- **use-report-generation:** React Testing Library test that mocks `streamConfigParse` / fetch; assert report ids, retry behavior, and that no setState is called after unmount (e.g. unmount mid-stream and assert no console errors or state updates).
- **Central enrichment effect:** Test with mocked Supabase and getCentralStatus/getCachedFirewalls/getAlerts; assert that when effect re-runs or unmounts, no setState is called for stale runs (using a run-id or similar in the test).

---

## Optional / later (not in initial scope)

- **Naming consistency:** Standardise `analysisResult` vs `analysisResults` (prefer plural for collections) and `CentralEnrichment` vs `centralEnrichment` in prop names across components; can be done incrementally during Phase 3 refactors.
- **Portal access review:** Explicitly document that `portal-data` is intended for unauthenticated access by slug/org_id and that RLS and `portal_config` restrict data appropriately; no code change required unless you find gaps.
- **UX:** Global loading indicator (e.g. top progress bar or skeleton), clearer parsing progress (“Parsing 3 of 5…” + disabled actions), persistent “Reports Saved” until next action, and empty-state copy + CTA on key views.
- **A11y:** Add `aria-expanded` / `aria-controls` on TOC toggles (SharedReport, DocumentPreview); ensure severity badges have text/icon and contrast; verify focus trap and aria-labels in Radix modals/drawers; add aria-label or summary for charts.
- **Performance:** Memoize heavy children (e.g. AnalysisTabs, DocumentPreview) after Phase 3; consider merging the three snapshot-writing useEffects in Index into one pass; optional caching or Web Worker for `analyseConfig` in useFirewallAnalysis.
- **Error monitoring:** Add Sentry (or similar) for unhandled rejections and ErrorBoundary, with source maps for production.

---

## Execution order summary


| Phase | Focus                                                 | Dependency                                      |
| ----- | ----------------------------------------------------- | ----------------------------------------------- |
| 1     | Security (HMAC, env guard), getFileLabel, shared CORS | None                                            |
| 2     | ParsedFile types, single toast, React Query decision  | Phase 1 (getFileLabel used in types’ consumers) |
| 3     | Store, Index split, constants                         | Phase 2 (types in place)                        |
| 4     | Parsing/save/effect/error fixes                       | Can run in parallel with 2–3                    |
| 5     | ESLint, Prettier, Husky, E2E, unit/integration tests  | Phases 1–2 done for tests to target stable APIs |


Phases 1 and 2 can be done first for quick, low-risk wins; Phase 3 is the largest refactor and benefits from the store and types being in place. Phase 4 and 5 can be split across sprints as needed.