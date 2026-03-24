# WAR ROOM AUDIT — Sophos FireComply

**Date:** 24 March 2026  
**Auditors:** Principal Engineer (Google), Senior Product Designer (Apple), Cybersecurity Architect (CrowdStrike), Performance Engineer (Netflix), YC Partner  
**Project:** Sophos FireComply (Sophos Clarity)

---

## DIMENSION 1 — CODE ARCHITECTURE & QUALITY

**Score: 4/10**

**Justification:** The codebase has clear domain intent and reasonable folder separation at the top level, but catastrophic file-size violations, no enforced formatting, dead dependencies, duplicated page implementations, and god-files that make this a maintenance liability.

### Issues Found

**1. God Files — Multiple components/pages over 1,000 lines**

- `HealthCheck2.tsx`: 3,412 lines
- `HealthCheck.tsx`: 2,842 lines
- `analyse-config.ts`: 3,152 lines
- `api/index.ts`: 2,440 lines
- `SetupWizard.tsx`: 2,017 lines
- **WHY:** Violates Single Responsibility. A single typo in a 3,400-line file can break 15 features. No engineer can hold this in working memory.
- **SEVERITY:** Critical
- **FIX:** Extract sub-components and domain functions. `HealthCheck2.tsx` should be \~5–8 files. `api/index.ts` needs shared-module extraction then route splitting.

**2. Duplicated page implementations — HealthCheck.tsx AND HealthCheck2.tsx**

- Two parallel 2,800+ and 3,400+ line implementations of the same feature.
- **WHY:** Violates DRY at the most expensive level. Bug fixes must be applied twice. One will inevitably drift.
- **SEVERITY:** High
- **FIX:** Delete the legacy version. If both are in use, extract shared logic into hooks/utilities and thin both pages down.

**3. Dead dependencies — react-hook-form, @hookform/resolvers, TanStack React Query**

- `react-hook-form` + `@hookform/resolvers` are in `package.json` but `FormField`/`FormProvider` are never used outside the UI primitive file. TanStack React Query provider is mounted but `useQuery`/`useMutation` are never called.
- **WHY:** Bloats bundle, confuses new engineers ("should I use this?"), signals incomplete migration.
- **SEVERITY:** Medium
- **FIX:** Remove unused dependencies or commit to adopting them. Pick one form strategy and one data-fetching strategy.

**4. No Prettier — no enforced code formatting**

- No `.prettierrc`, no format script, no pre-commit hooks.
- **WHY:** Style debates in PRs, inconsistent formatting across files, AI-generated code with different conventions mixed in. *(Google Engineering Practices, Airbnb Style Guide)*
- **SEVERITY:** Medium
- **FIX:** Add Prettier with a config, add a `format` script, add a pre-commit hook via `lint-staged` + `husky`.

**5. 22+ components over 500 lines**

- See the full list in the audit data. These are not complex algorithms — they are UI components with mixed concerns (data fetching, state management, rendering, business logic).
- **SEVERITY:** High
- **FIX:** Systematic extraction. Each component should do ONE thing. Data fetching in hooks, business logic in lib, rendering in components.

**6. Prop drilling — AnalysisTabs receives 20+ props from Index.tsx**

- No dashboard context. Props fan out horizontally to dozens of sub-components.
- **SEVERITY:** Medium
- **FIX:** Create an `AnalysisContext` or use a lightweight store (Zustand) for the analysis session state.

**7. `strictNullChecks: false` in root tsconfig.json, `noImplicitAny: false`**

- The app tsconfig overrides some of this, but the root config is permissive enough to mask real bugs.
- **SEVERITY:** Medium
- **FIX:** Enable strict mode project-wide and fix the resulting type errors. This is a one-time cost that prevents an ongoing class of bugs.

### Priority Fixes

1. Kill duplicate pages
2. Extract god files
3. Remove dead deps
4. Add Prettier + pre-commit hooks

---

## DIMENSION 2 — PERFORMANCE & EFFICIENCY

**Score: 5/10**

**Justification:** Good code splitting at route/feature level, but zero `React.memo` usage, heavy unused dependencies in the bundle, unbounded database queries, and no systematic approach to memoisation or caching.

### Issues Found

**1. Zero `React.memo` usage across 214 components**

- Despite heavy `useCallback`/`useMemo` usage, no components are memoised. Every parent re-render cascades through the entire tree.
- **WHY:** `useCallback` is pointless if the child receiving it isn't wrapped in `React.memo`. This is textbook cargo-cult memoisation. *(React docs: "useMemo/useCallback are useful as performance optimisations when passing data to memo-ised children")*
- **SEVERITY:** Medium
- **FIX:** Profile with React DevTools. Wrap frequently-rerendered leaf components in `React.memo`. Remove `useCallback`/`useMemo` from places where they provide no benefit.

**2. Unbounded Supabase queries — at least 12 identified**

- `saved_reports`, `assessments`, `org_invites`, `org_members`, `finding_snapshots`, `remediation_status`, `alert_rules`, `agents`, `passkey_credentials` — all fetched without `.limit()`.
- **WHY:** As customer data grows, these become O(n) memory bombs. A customer with 10,000 findings will crash the browser tab. *(Netflix perf principle: "bound everything")*
- **SEVERITY:** High
- **FIX:** Add `.limit()` to every query. Implement cursor-based pagination for lists. Add virtual scrolling for long lists (e.g. `@tanstack/react-virtual`).

**3. Heavy bundle — 5 document generation libraries simultaneously**

- `pdfmake` (1MB+ gzipped), `jspdf`, `docx`, `pptxgenjs`, `html2canvas` all in dependencies.
- **WHY:** Even with code splitting, the user who exports one PDF format still downloads significant JS. Multiple PDF engines is a red flag for unfinished consolidation.
- **SEVERITY:** Medium
- **FIX:** Pick ONE PDF strategy. If `pdfmake` works, remove `jspdf` + `html2canvas`. Ship document generation as a web worker or server-side function.

**4. No server-state caching strategy**

- TanStack Query is installed but unused. Supabase data is re-fetched on every mount with no `staleTime`, no deduplication, no background refresh.
- **WHY:** Unnecessary network requests, stale data between tabs, poor perceived performance on navigation.
- **SEVERITY:** Medium
- **FIX:** Either adopt TanStack Query properly (with `staleTime` and `gcTime` configured) or build a minimal cache layer in your custom hooks.

**5. `console.log` in production code**

- 2 debug statements in `raw-config-to-sections.ts` (VLAN/Interface debug logging).
- **SEVERITY:** Low
- **FIX:** Remove or wrap in `if (import.meta.env.DEV)`.

### Priority Fixes

1. Add `.limit()` to all queries
2. Remove unused PDF libraries
3. Adopt or remove TanStack Query

---

## DIMENSION 3 — SECURITY & VULNERABILITY

**Score: 6/10**

**Justification:** Good foundations — DOMPurify on all HTML rendering, no hardcoded secrets, RLS on most tables, proper CORS allow-listing, Supabase parameterised queries. But critical gaps in rate limiting, one table without RLS, JWT verification disabled on edge functions, and sensitive data in localStorage.

### Issues Found

**1. `gemini_usage` table has no RLS enabled**

- Migration `20250319000000_gemini_usage.sql` creates the table but never calls `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- **WHY:** If the `anon` or `authenticated` role has been granted access, any authenticated user can read/write/delete all rows. Exposes usage patterns and potentially token counts. *(OWASP: Broken Access Control — #1 on 2021 Top 10)*
- **SEVERITY:** Critical
- **FIX:** Add a migration: `ALTER TABLE public.gemini_usage ENABLE ROW LEVEL SECURITY;` with a service-role-only insert policy.

**2. JWT verification disabled on 3 edge functions**

- `deploy.yml` deploys `parse-config`, `api`, `sophos-central` with `--no-verify-jwt`. `config.toml` sets `verify_jwt = false` for two of them.
- **WHY:** Security relies entirely on custom auth inside the function. If a bug bypasses the custom check, there's no gateway safety net. Defence-in-depth principle violated.
- **SEVERITY:** High
- **FIX:** For functions that accept Supabase JWTs (which is most of `api/index.ts`), re-enable JWT verification and only disable for the specific public routes (config upload, shared report).

**3. In-memory rate limiting resets on cold start**

- `parse-config` uses `Map<string, number[]>()` that resets every time the Deno isolate cold-starts.
- **WHY:** Under load, Supabase spins up multiple isolates — each with its own empty map. Rate limiting is effectively non-existent under concurrent load. An attacker can exhaust your Gemini API quota.
- **SEVERITY:** High
- **FIX:** Use Supabase DB or Upstash Redis for rate limit state. Count rows in `gemini_usage` within the last minute as a simple alternative.

**4. Webhook URLs and integration configs stored in plaintext localStorage**

- Slack webhooks, Teams webhooks, PSA config stored in `localStorage` without encryption.
- **WHY:** Any XSS vulnerability or malicious browser extension can exfiltrate webhook URLs, enabling an attacker to post to the customer's Slack/Teams channels. Shared workstations compound the risk.
- **SEVERITY:** Medium
- **FIX:** Move webhook configuration to the server (Supabase table with RLS) or use session-scoped storage.

**5. `managementIp` interpolated into URLs without validation**

- `remediation-playbooks.ts` constructs `https://${managementIp}:4444` without format validation.
- **WHY:** If `managementIp` is attacker-controlled or malformed, it could create phishing links in the UI.
- **SEVERITY:** Medium
- **FIX:** Validate `managementIp` matches IPv4/IPv6 format before constructing the URL.

**6. 10+ empty `catch` blocks swallowing errors**

- `use-auth.ts`, `use-se-auth.ts`, `InviteStaff.tsx`, `FirewallLinkPicker.tsx`, `use-central.ts`, `SavedReportsLibrary.tsx`, `CentralIntegration.tsx`, `TenantDashboard.tsx`, `saved-reports.ts`, `Index.tsx`.
- **WHY:** Silent failures in audit logging mean you won't know when your audit trail is broken — which defeats the purpose of having one.
- **SEVERITY:** Medium
- **FIX:** At minimum, `console.error` in catch blocks. For audit logging failures, implement a retry queue or fallback.

### Priority Fixes

1. Enable RLS on `gemini_usage`
2. Implement distributed rate limiting
3. Validate `managementIp`

---

## DIMENSION 4 — UI/UX & PRODUCT DESIGN

**Score: 6/10**

**Justification:** The systematic UI refactor has created a genuinely premium visual language in dark mode. But token discipline is poor (hundreds of raw hex values), light mode needs a dedicated pass, loading states are inconsistent, and accessibility has real gaps.

### Issues Found

**1. Hundreds of hardcoded hex colours across components**

- Raw `#EA0022`, `#F29400`, `#2006F7`, `#00F2B3`, etc. appear in 40+ files instead of using CSS custom properties or Tailwind theme tokens.
- **WHY:** Changing the brand colour requires a find-and-replace across the entire codebase. Light/dark mode variations multiply the problem. *(Design Systems best practice: single source of truth for colour)*
- **SEVERITY:** Medium
- **FIX:** Define severity/brand colours as CSS custom properties in `index.css` and extend Tailwind theme. Replace all raw hex with token references.

**2. No unified loading/error/empty state pattern**

- Some pages use skeletons, some use text spinners, some use toast-only. The app shell Suspense fallback is a plain "Loading..." div.
- **WHY:** Violates Nielsen Heuristic #1 (Visibility of system status). Users don't know if the app is working or broken. *(Nielsen Norman Group)*
- **SEVERITY:** Medium
- **FIX:** Create `<PageSkeleton>`, `<ErrorBoundaryFallback>`, `<EmptyState>` shared components. Use them consistently across all routes.

**3. Accessibility gaps**

- Skip link doesn't work on `ClientPortal.tsx`, `ThemePreview.tsx`. Several pages lack `<main>` landmark. `KeyboardShortcutsModal` uses a custom div instead of `Dialog` (no focus trap, no `role="dialog"`, no `aria-modal`). No evidence of WCAG audit.
- **WHY:** Fails WCAG 2.1 AA. Enterprise customers in regulated industries (education, healthcare, government) may require WCAG compliance. Screen reader users cannot navigate effectively.
- **SEVERITY:** High
- **FIX:** Add `id="main-content"` to all page-level `<main>` elements. Replace custom modal with Radix `Dialog`. Conduct an `axe-core` audit.

**4. Non-technical user comprehension**

- The core workflow requires uploading a Sophos `entities.xml` export — a highly technical artefact. The UI uses jargon like "WAN rules", "IPS", "SSL/TLS inspection" without explanation for business users.
- **WHY:** An MSP sales engineer may understand, but the customer receiving a shared report may not. *(Nielsen Heuristic #2: Match between system and real world)*
- **SEVERITY:** Low (acceptable for the target persona — SEs and MSPs)

### Priority Fixes

1. Unify loading/error states
2. Fix accessibility gaps
3. Consolidate colour tokens

---

## DIMENSION 5 — FUNCTIONALITY & BUSINESS LOGIC

**Score: 7/10**

**Justification:** The core analysis engine is well-tested and produces deterministic, evidence-based findings. Remediation playbooks are genuinely useful. But half-built features exist, the "auto-fix" button is permanently disabled, and several features in the UI promise capabilities that don't exist yet.

### Issues Found

**1. Auto-remediate button is always disabled with "coming soon" tooltip**

- `RemediationPlaybooks.tsx` shows an auto-fix button for every finding but it's hard-coded `disabled`.
- **WHY:** Shipping disabled features erodes trust. Users click, nothing happens, they wonder if the app is broken. *(Nielsen Heuristic #7: Flexibility and efficiency of use — violated by teasing features)*
- **SEVERITY:** Medium
- **FIX:** Remove the button entirely, or hide it behind a feature flag that's only enabled when the Sophos Central API integration is actually wired up.

**2. TODO comments in production business logic**

- `assessment-schedule.ts`, `benchmarks.ts`, `scheduled-reports.ts`, `change-approval.ts` — 4 TODO markers indicating incomplete implementations.
- **WHY:** These modules exist in the codebase and may be referenced by the UI, but contain stub or placeholder logic.
- **SEVERITY:** Medium
- **FIX:** Audit each TODO. Either implement the feature or remove the dead code path.

**3. Verify-identity endpoint returns a random UUID as a "session token"**

- `api/index.ts` lines 864–868: `handleVerifyIdentity` returns `crypto.randomUUID()` as a session token with no actual TOTP verification.
- **WHY:** This is a security-critical authentication endpoint that does no authentication. If any code path relies on this for actual MFA verification, it's a bypass.
- **SEVERITY:** High
- **FIX:** Either implement proper TOTP verification using Supabase Auth MFA API, or remove the endpoint and document it as not-yet-implemented.

**4. No retry logic on Supabase mutations**

- Inserts/updates to `remediation_status`, `audit_log`, `agent_submissions` etc. have no retry on transient failures.
- **WHY:** Network blips silently lose data. User marks a finding as "done" → network hiccup → state lost on refresh.
- **SEVERITY:** Medium
- **FIX:** Add retry with exponential backoff for mutations, or use an optimistic update pattern with rollback.

### Priority Fixes

1. Fix the verify-identity endpoint
2. Remove or hide auto-fix button
3. Implement mutation retries

---

## DIMENSION 6 — TESTING & RELIABILITY

**Score: 3/10**

**Justification:** The analysis engine has meaningful behavioural tests, but 0% of components are tested, E2E exists but isn't in CI, coverage is configured only for `src/lib/`, and the connector has zero tests.

### Issues Found

**1. Zero component tests — 0 out of 214 components**

- Not a single `.test.tsx` file exists.
- **WHY:** The entire UI layer is untested. A refactor that breaks rendering, a conditional that hides a critical button, a prop type change — none of these would be caught. *(Google Testing Blog: "Test Pyramid" — UI tests are essential)*
- **SEVERITY:** Critical
- **FIX:** Start with the most critical user journeys: upload → analyse → view findings → export report. Use Testing Library to test component behaviour, not implementation.

**2. E2E tests not in CI**

- `e2e/smoke.spec.ts` exists (33 lines, 4 scenarios) but `deploy.yml` and `staging.yml` only run `npm test` (Vitest).
- **WHY:** E2E tests that don't run in CI don't exist. They rot and break silently.
- **SEVERITY:** High
- **FIX:** Add Playwright to the CI pipeline. Use the Playwright GitHub Action for reliable browser testing.

**3. Coverage only scoped to `src/lib/**`**

- `vitest.config.ts` excludes components, pages, hooks from coverage reporting.
- **WHY:** Creates a false sense of security. "90% coverage" could mean zero coverage of the most-used code paths.
- **SEVERITY:** Medium
- **FIX:** Expand coverage scope to all of `src/`. Set a minimum coverage threshold.

**4. FireComply Connector has zero tests**

- No test files, no test script in `firecomply-connector/package.json`.
- **WHY:** This is a deployed Electron agent that runs on customer infrastructure. Untested agent code that connects to firewalls and submits data is a reliability and security risk.
- **SEVERITY:** High
- **FIX:** Add unit tests for config loading, API communication, analysis submission, and error handling.

**5. No chaos engineering, no resilience testing**

- No tests for what happens when Supabase is down, when Gemini returns 500, when the firewall config is malformed.
- **SEVERITY:** Medium
- **FIX:** Add failure-scenario tests: mock API errors, malformed inputs, timeout scenarios.

### Priority Fixes

1. Add component tests for critical journeys
2. Add E2E to CI
3. Test the connector

---

## DIMENSION 7 — DOCUMENTATION & KNOWLEDGE

**Score: 5/10**

**Justification:** The README is solid with architecture overview, setup instructions, and env vars. Plan documents exist in `docs/plans/`. But there's no API documentation, no architecture decision records, and the connector has minimal docs.

### Issues Found

**1. No API documentation for edge functions**

- 6 edge functions with no request/response documentation. The `api/index.ts` monolith handles 30+ routes with no OpenAPI spec or even a route table.
- **SEVERITY:** High
- **FIX:** Generate an API route table (method, path, auth, description) at minimum. Consider adding `public/api-docs.json` (noted as existing but needs verification of completeness).

**2. No architecture decision records (ADRs)**

- Why pdfmake AND jspdf? Why no global state management? Why Supabase over alternatives? These decisions are tribal knowledge.
- **SEVERITY:** Medium
- **FIX:** Create `docs/decisions/` with ADR format for key technical choices.

**3. Connector documentation is a config example only**

- `firecomply-connector/config.example.json` exists but no README explaining setup, requirements, Electron packaging, or operational procedures.
- **SEVERITY:** Medium
- **FIX:** Write a connector README with setup, build, deploy, and troubleshooting instructions.

### Priority Fixes

1. Document API routes
2. Create connector README

---

## DIMENSION 8 — DEVELOPER EXPERIENCE & TOOLING

**Score: 6/10**

**Justification:** CI/CD exists and runs lint + typecheck + test + build + audit. Environment management is clean. But no Prettier, no pre-commit hooks, no Docker for local dev, and the Supabase local dev story requires manual setup.

### Issues Found

**1. No code formatter — no Prettier, no pre-commit hooks**

- **SEVERITY:** Medium
- **FIX:** Add Prettier, `lint-staged`, and `husky`.

**2. No Docker/containerised local dev**

- Local development requires manual Supabase CLI setup, Node install, env file creation.
- **SEVERITY:** Low
- **FIX:** Add `docker-compose.yml` for Supabase local + app dev server as an optional convenience.

**3. Dependencies not pinned (all use `^` ranges)**

- Every dependency uses caret ranges, meaning minor versions can change between installs.
- **SEVERITY:** Low
- **FIX:** Use a lockfile (which npm/yarn already creates) and consider exact versions for critical dependencies.

### Priority Fixes

1. Add Prettier + lint-staged + husky

---

## DIMENSION 9 — SCALABILITY & SYSTEM DESIGN

**Score: 4/10**

**Justification:** Good database indexing and RLS policies. But the 2,440-line monolith edge function is a scaling ceiling, in-memory rate limiting doesn't work at scale, no caching layer, no background job queue, and direct Supabase calls from 40+ components create tight coupling.

### Issues Found

**1. `api/index.ts` is a monolith that cannot scale independently**

- Agent heartbeats, passkey auth, team management, config upload, email sending — all in one function.
- **WHY:** A spike in agent heartbeats blocks config uploads. A bug in email sending crashes the entire API.
- **SEVERITY:** Critical
- **FIX:** Extract into separate edge functions using `supabase/functions/_shared/` for common utilities.

**2. No caching layer**

- Despite TanStack Query being installed, there's no server-state cache. Every component mount re-fetches.
- **SEVERITY:** High
- **FIX:** Adopt TanStack Query properly (with `staleTime` and `gcTime` configured) or build a minimal cache layer.

**3. No background job queue**

- Email sending, config upload processing, scheduled reports — all synchronous in edge function request lifecycle.
- **SEVERITY:** Medium
- **FIX:** Use Supabase's `pg_cron` + `pg_net` or an external queue for async work.

**4. Single point of failure: Gemini API**

- Report generation depends entirely on Google Gemini. No fallback model, no cached results, no degraded mode.
- **SEVERITY:** High
- **FIX:** Cache generated reports in Supabase. Add a fallback model (e.g. OpenAI). Show a meaningful error when Gemini is down.

### Priority Fixes

1. Split the API monolith
2. Implement persistent rate limiting
3. Add Gemini fallback

---

## DIMENSION 10 — PRODUCT VISION & STRATEGIC QUALITY

**Score: 7/10**

**Justification:** The core value proposition — deterministic, evidence-based firewall security assessment with remediation playbooks — is genuinely differentiated and well-executed. The product clearly solves a real pain point for Sophos SEs and MSPs. But feature sprawl dilutes focus, and the "premium" polish is inconsistent between features.

### Issues Found

**1. Feature sprawl — too many half-polished surfaces**

- Client portal, NOC mode, geographic fleet map, attack surface analysis, change approval, PSA integration, Slack/Teams webhooks, email digest, assessment scheduling, peer benchmarking, insurance readiness, evidence collection, attestation workflow, compliance calendar...
- **WHY:** Each of these adds maintenance burden but may serve <5% of users. The most important journey (upload → analyse → remediate → report) competes for attention.
- **SEVERITY:** Medium
- **FIX:** Instrument usage. Cut features with <10% adoption. Polish the core journey to perfection.

**2. The single thing that would make this 10x better**

- **A one-click "Connect Firewall → Continuous Monitoring" flow.** The current workflow requires manual XML export, upload, and re-upload for each assessment. If the connector agent could auto-discover, auto-assess, and auto-report on a schedule with drift detection — that transforms this from a point-in-time tool to a continuous security posture platform.

**3. Trust signals for enterprise buyers are missing**

- No SOC 2 badge, no data residency documentation in-app, no SLA commitments, no uptime status page.
- **SEVERITY:** Medium for current stage.

### Priority Fixes

1. Instrument feature usage
2. Double down on the continuous monitoring story

---

## FINAL VERDICT

### 1. Scorecard

| Dimension | Score | One-Line Justification |
|---|---|---|
| Architecture & Quality | 4/10 | God files, dead deps, duplicate pages, no formatter |
| Performance & Efficiency | 5/10 | Good splitting but unbounded queries, unused memoisation, heavy bundle |
| Security & Vulnerability | 6/10 | DOMPurify good, but RLS gap, fake MFA endpoint, in-memory rate limits |
| UI/UX & Product Design | 6/10 | Premium dark mode, but inconsistent tokens, accessibility gaps |
| Functionality & Business Logic | 7/10 | Strong analysis engine, but half-built features and stub endpoints |
| Testing & Reliability | 3/10 | 0% component tests, E2E not in CI, connector untested |
| Documentation & Knowledge | 5/10 | Decent README, no API docs, no ADRs |
| Developer Experience & Tooling | 6/10 | CI exists, but no formatter or pre-commit hooks |
| Scalability & System Design | 4/10 | Monolith edge function, no caching, no job queue |
| Product Vision & Strategic Quality | 7/10 | Real value prop, clear differentiation, but feature sprawl |

**Weighted Overall: 49/100**

---

### 2. Critical Failures (must fix before shipping)

| # | Problem | Location | Fix | Effort |
|---|---------|----------|-----|--------|
| 1 | `gemini_usage` has no RLS | `supabase/migrations/` | Add RLS migration | 30 min |
| 2 | Fake MFA verify-identity endpoint | `api/index.ts:841–869` | Implement real TOTP or remove | 2–4 hours |
| 3 | In-memory rate limiting is non-functional at scale | `parse-config/index.ts:28–39` | Use DB-backed rate limiting | 2–3 hours |
| 4 | 0% component test coverage | All of `src/components/` | Add tests for critical journeys | 2–3 weeks |
| 5 | API monolith (2,440 lines) is a single point of failure | `supabase/functions/api/index.ts` | Extract shared code, then split | 1–2 weeks |
| 6 | God files (3,400+ lines) | `HealthCheck2.tsx`, `analyse-config.ts` | Decompose into sub-modules | 1–2 weeks |
| 7 | JWT verification disabled on edge functions | `deploy.yml`, `config.toml` | Re-enable with selective bypass | 2–3 hours |

---

### 3. Prioritised Improvement Roadmap

#### TIER 1 — Fix this week (blocking issues)

- [ ] Enable RLS on `gemini_usage` (30 min)
- [ ] Fix or remove the verify-identity stub endpoint (2 hrs)
- [ ] Add `.limit()` to all unbounded Supabase queries (3 hrs)
- [ ] Remove `console.log` from production code (15 min)
- [ ] Validate `managementIp` before URL construction (30 min)
- [ ] Add Prettier + lint-staged + husky (1 hr)

#### TIER 2 — Fix this month (significant improvements)

- [ ] Implement persistent rate limiting (3 hrs)
- [ ] Re-enable JWT verification with selective bypass (3 hrs)
- [ ] Add component tests for the core journey (1–2 weeks)
- [ ] Add E2E to CI pipeline (2 hrs)
- [ ] Split `HealthCheck2.tsx` into sub-components (3–5 days)
- [ ] Remove or adopt dead dependencies (react-hook-form, TanStack Query) (2 hrs)
- [ ] Consolidate colour tokens into CSS custom properties (1–2 days)
- [ ] Create unified loading/error/empty state components (1 day)
- [ ] Fix accessibility gaps (main landmarks, focus traps) (1 day)
- [ ] Delete duplicate `HealthCheck.tsx` or extract shared logic (2–3 days)

#### TIER 3 — Fix this quarter (polish and scale)

- [ ] Split `api/index.ts` into separate edge functions (1–2 weeks)
- [ ] Split `analyse-config.ts` into domain modules (1 week)
- [ ] Implement server-state caching (adopt TanStack Query properly) (1 week)
- [ ] Add background job queue for emails/reports (1 week)
- [ ] Add Gemini fallback model (2–3 days)
- [ ] Document all API routes (1 week)
- [ ] Create ADRs for key decisions (ongoing)
- [ ] Instrument feature usage and cut low-adoption features (ongoing)
- [ ] Remove one PDF library (consolidate pdfmake vs jspdf) (2–3 days)
- [ ] Add connector test suite (1 week)

---

### 4. The Brutal Truth

This is a genuinely useful product with a genuinely differentiated analysis engine, built at impressive velocity by what appears to be a very small team (likely one person). The core value — deterministic, evidence-based firewall security assessment with step-by-step remediation — is real and valuable. But the velocity came at a cost: the codebase has the structural discipline of a hackathon project that was never cleaned up. 3,400-line page components. A 2,440-line API monolith. Two parallel implementations of the main feature. Five PDF libraries. A form library installed and never used. A caching library installed and never used. Zero component tests. A fake MFA endpoint in production. In-memory rate limiting that evaporates on cold start. This is a product that works *today* for a small number of users on the golden path, but it is one bad deploy, one Supabase incident, or one determined attacker away from a serious problem. The single biggest thing holding it back is not any one bug — it's the accumulated technical debt from shipping features faster than the architecture can support them. The foundation needs to be hardened before anything else is built on top of it.

---

### 5. The Path to Exceptional

1. **Kill the god files.** Decompose every file over 500 lines. This single act would make the codebase navigable, testable, and maintainable. It's not glamorous but it's the prerequisite for everything else.

2. **Build a real test suite.** Not for coverage numbers — for confidence. Test the upload → analyse → remediate → export journey end-to-end. Test the analysis engine against malformed configs. Test the connector against unreachable firewalls. Make `npm test` something that actually tells you whether the product works.

3. **Split the API monolith and implement proper rate limiting.** This is the difference between "works for demos" and "works in production." The API should be multiple functions, rate limiting should be distributed, and the fake MFA endpoint should be real or gone.

4. **Adopt one strategy for each concern and commit.** One PDF library. One form library (or none). One data-fetching approach. One state management approach. Remove everything you aren't using. The codebase should read like a decision, not an exploration.

5. **Build the continuous monitoring story.** The connector agent + Supabase + drift detection is the path from "assessment tool" to "security posture platform." That's the difference between a tool someone uses once a quarter and a platform they rely on daily. That's the difference between a £50K deal and a £500K deal.
