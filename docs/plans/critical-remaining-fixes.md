# Critical Remaining Fixes: Test Coverage, API Split, God File Decomposition

Items 4, 5, and 6 from the war-room audit. Items 1, 2, 3, 7 are already shipped (see `docs/plans/critical-tactical-fixes.md`).

---

## Execution order and rationale

```
Phase 0  Test infrastructure           (1 day)
Phase 1  analyse-config.ts decompose   (3-5 days)   -- pure functions, existing tests catch regressions
Phase 2  Component tests Wave 1        (1 week)      -- critical journeys only
Phase 3  HealthCheck2.tsx decompose    (1 week)      -- enabled by Wave 1 tests
Phase 4  Component tests Wave 2        (1-2 weeks)   -- broad coverage
Phase 5  API monolith split            (1-2 weeks)   -- independent of UI work
Phase 6  Component tests Wave 3        (1 week)      -- remaining + integration
```

Phases 1 and 5 have no dependency on each other and can run in parallel if two people are available. Phase 3 depends on Phase 2 (tests protect the refactor). Phase 4/6 are incremental coverage that can interleave with other work.

---

## Phase 0: Component test infrastructure (1 day)

### 0a. Create shared test utilities

**New file: `src/test/test-utils.tsx`**

```tsx
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ReactElement } from "react";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
```

**New file: `src/test/mocks/supabase.ts`**

Mock factory for `@/integrations/supabase/client` — returns a chainable builder (`from().select().eq()...`) that resolves to configurable fixture data. Pattern: each test calls `mockSupabase({ table: data })` before rendering.

### 0b. Expand vitest coverage config

In [vitest.config.ts](vitest.config.ts), widen `coverage.include`:

```diff
  coverage: {
    provider: "v8",
    reporter: ["text", "html"],
-   include: ["src/lib/**"],
+   include: ["src/lib/**", "src/components/**", "src/hooks/**", "src/pages/**"],
  },
```

### 0c. Install @testing-library/user-event

Already have `@testing-library/react` and `@testing-library/jest-dom`. Add:

```
npm install -D @testing-library/user-event
```

---

## Phase 1: Decompose `analyse-config.ts` (3-5 days)

**Current state:** 3,152 lines in [src/lib/analyse-config.ts](src/lib/analyse-config.ts). Already extracted: `analysis/types.ts`, `analysis/helpers.ts`, `analysis/domains/nat.ts`.

**Strategy:** Extract domain analysers into `src/lib/analysis/domains/*.ts` following the existing `nat.ts` pattern. Keep `analyse-config.ts` as a barrel re-export so the 30+ consumer imports don't change.

### 1a. Extract rule predicates and section utilities

**New file: `src/lib/analysis/rule-predicates.ts`** (~120 lines)
- `isWanRule`, `isWebFilterRule`, `isLoggingEnabled`, `isIpsEnabled`, `isAppControlEnabled`
- `ruleSignature`, duplicate detection helpers
- Currently at lines 36-154 of `analyse-config.ts`

**New file: `src/lib/analysis/section-meta.ts`** (~115 lines)
- `findFirewallRulesTable`, `findOtpSection`
- `countRows`, `countInterfaceRows`, `extractHostname`, `extractManagementIp`
- Currently at lines 160-175 and 338-451

### 1b. Extract SSL/TLS inspection module

**New file: `src/lib/analysis/ssl-tls-inspection.ts`** (~160 lines)
- `parseSslTlsRules`, `findUncoveredZones`, `findUncoveredNetworks`
- Exempt regex patterns
- Currently at lines 177-337
- Produces `SslTlsRule[]` and `InspectionPosture` (types already in `analysis/types.ts`)

### 1c. Extract threat status analyser

**New file: `src/lib/analysis/threat-status-findings.ts`** (~90 lines)
- `analyseThreatStatus` function
- Currently at lines 942-1030
- Takes `ThreatStatus` input (different from `ExtractedSections`), clean boundary

### 1d. Extract extended domain analysers

Each follows the `(sections, findings, nextId, ...) => nextId` pattern. Group by thematic area into `src/lib/analysis/domains/`:

| New file | Content (current line range) | ~Lines |
|----------|------------------------------|--------|
| `domains/atp-services.ts` | ATP, MDR, NDR, heartbeat, threat response | ~200 |
| `domains/web-filter.ts` | Web filter deep dive, DPI web-filter gaps | ~150 |
| `domains/ips-av.ts` | IPS policies, AV/anti-spam analysis | ~120 |
| `domains/admin-hardening.ts` | Admin profiles, MFA/OTP, backup, notification, auth | ~250 |
| `domains/vpn-network.ts` | VPN, DoS, RED, SNMP, DNS, wireless, logging | ~350 |
| `domains/rules-waf.ts` | Rule ordering, user groups, WAF, app filter | ~200 |
| `domains/infra.ts` | Certificates, hotspots, interfaces, firmware EOL, licence | ~250 |
| `domains/ha.ts` | HA analysis | ~55 |

### 1e. Slim down the barrel

After extraction, `analyse-config.ts` becomes ~200-300 lines:
- Type re-exports from `./analysis/types`
- Import all domain analysers
- `analyseConfig` orchestrator (~80 lines of wiring)
- `analyseMultiConfig` wrapper (~20 lines)

### 1f. Validate with existing tests

Run `npm test` after each extraction. The 14 existing lib tests (especially `analyse-config.test.ts`, `risk-score.test.ts`, `compliance-map.test.ts`, `policy-baselines.test.ts`) validate that the refactor preserves behavior. Add targeted unit tests for each new domain file.

---

## Phase 2: Component tests Wave 1 — critical journeys (1 week)

Priority: test the components every user session touches. ~30 test files.

### 2a. Auth flow (highest priority)

| Component | Test focus |
|-----------|-----------|
| `AuthFlow.tsx` | Loading states, guest pass-through, MFA gate, org setup gate |
| `AuthGate.tsx` | Sign-in/sign-up form, skip/guest button |
| `MfaEnrollment.tsx` | QR display, code input, enrollment submit |
| `MfaVerification.tsx` | Code input, verify, error states |
| `OrgSetup.tsx` | Org creation form, validation |
| `PasskeyManager.tsx` | List passkeys, register, delete |

### 2b. File upload and analysis entry

| Component | Test focus |
|-----------|-----------|
| `FileUpload.tsx` | Drag-drop, file validation, multiple files, size limits |
| `UploadSection.tsx` | Upload flow, progress, error states |
| `CentralIntegration.tsx` | Credential form, connect/disconnect, tenant selection |

### 2c. Analysis display

| Component | Test focus |
|-----------|-----------|
| `AnalysisTabs.tsx` | Tab switching, finding counts, empty states |
| `HealthCheckDashboard2.tsx` | Score rendering, finding cards, severity distribution |
| `RiskScoreDashboard.tsx` | Score display, gauge, category breakdown |
| `DocumentPreview.tsx` | Report rendering, section navigation |
| `ExtractionSummary.tsx` | Stats display, section counts |

### 2d. App shell

| Component | Test focus |
|-----------|-----------|
| `ErrorBoundary.tsx` | Catches errors, shows fallback |
| `PageSkeleton.tsx` | Renders loading state |
| `EmptyState.tsx` | Renders message and action |

---

## Phase 3: Decompose `HealthCheck2.tsx` (1 week)

**Current state:** 3,412 lines in [src/pages/HealthCheck2.tsx](src/pages/HealthCheck2.tsx). Three components: `HealthCheckInner` (3,063 lines), `HealthCheck` (wrapper), `CompleteProfileGate`.

### 3a. Extract types and pure helpers

**New file: `src/pages/health-check/types.ts`**
- `ActiveStep`, `EphemeralCentralCreds`, `GuestTenantRow`, `GuestFirewallLicenseApiRow`

**New file: `src/pages/health-check/guest-central-api.ts`**
- `callGuestCentral`, `mapGuestFirewallLicencesToBpRows`, `guestFirewallMatchValueForFile`, `CENTRAL_MATCH_NONE`

### 3b. Extract custom hooks (biggest impact)

Each hook encapsulates a cohesive slice of `HealthCheckInner`'s ~60 `useState` calls:

| New hook file | State it owns | ~Lines |
|---------------|--------------|--------|
| `hooks/use-health-check-analysis.ts` | `files`, `analysisResults`, `activeStep`, parse/analyse effects | ~150 |
| `hooks/use-health-check-central.ts` | `centralCreds`, `centralValidated`, tenant/firewall lists, connect/disconnect | ~200 |
| `hooks/use-health-check-persistence.ts` | `savedCheckId`, save/restore, snapshot builders | ~150 |
| `hooks/use-health-check-export.ts` | `pdfBusy`, `sendingReport`, PDF/HTML/ZIP/email handlers | ~150 |
| `hooks/use-health-check-sharing.ts` | Share token CRUD, follow-up date, recheck search | ~100 |
| `hooks/use-health-check-config-upload.ts` | All `configUpload*` state + handlers + polling effect | ~200 |

### 3c. Extract sub-page components

| New component file | Content | ~Lines |
|-------------------|---------|--------|
| `health-check/CompleteProfileGate.tsx` | Already isolated logically (lines 3339-3412) | ~75 |
| `health-check/HealthCheckLanding.tsx` | Landing + analyzing step UI (3-column cards) | ~200 |
| `health-check/HealthCheckResults.tsx` | Results header, customer fields, Central reconnect, dashboards | ~400 |
| `health-check/HealthCheckDialogs.tsx` | Share, recheck, config-upload, Central help dialogs | ~300 |

### 3d. Slim down HealthCheckInner

After extraction, `HealthCheckInner` becomes a ~300-line orchestrator:
- Imports and calls each hook
- Passes props to landing/results/dialogs sub-components
- Manages `activeStep` transitions between them

### 3e. Test the extracted hooks

Each hook gets a dedicated test file using `renderHook` from `@testing-library/react`. The Supabase mock from Phase 0 handles DB calls. This is far more testable than testing the 3,400-line monolith.

---

## Phase 4: Component tests Wave 2 — broad coverage (1-2 weeks)

### 4a. Report and export components

`ReportBuilder`, `ReportCards`, `SavedReportsLibrary`, `ExportCentre`, `ScheduledReportSettings`, `ReportTemplateSettings`, `ReportUpsellStrip`

### 4b. Dashboard widgets and visualisations

`CategoryScoreBars`, `ComplianceHeatmap`, `ScoreSimulator`, `ScoreTrendChart`, `SEScoreTrendChart`, `RiskDistribution`, `PriorityMatrix`, `CategoryTrends`, `FindingHeatmapTime`, `FindingsByAge`, `CompliancePostureRing`, `FrameworkCoverageBars`, `security-dashboards/*` (9 files)

### 4c. SE / team management

`TeamDashboard`, `TeamSwitcher`, `SEAuthGate`, `SEHealthCheckHistory2`, `SeHealthCheckManagementDrawer2`, `InviteStaff`, `BrandingSetup`

### 4d. Config upload customer flow

`ConfigHistory`, `ConfigDiff`, `CentralEnrichment`

### 4e. Agent fleet and Central

`AgentFleetPanel`, `FleetComparison`, `FirewallLinker`, `FirewallLinkPicker`, `FirmwareTracker`, `FirmwareEolWarnings`

---

## Phase 5: Split API monolith (1-2 weeks)

**Current state:** 2,473 lines in [supabase/functions/api/index.ts](supabase/functions/api/index.ts). All routes in one `serve()`. No `_shared/` directory.

### 5a. Create shared utilities

**New directory: `supabase/functions/_shared/`**

| New file | Extracted from | Content |
|----------|---------------|---------|
| `_shared/cors.ts` | Lines 25-44 | `getCorsHeaders`, `ALLOWED_ORIGINS` |
| `_shared/json.ts` | Lines 50-55 | `json()` response helper |
| `_shared/supabase.ts` | Lines 46-65 | `adminClient()`, `userClient()` |
| `_shared/auth.ts` | Lines 67-102 | `generateApiKey`, `authenticateAgent`, `getOrgMembership`, `authenticateSE` (381-402) |
| `_shared/crypto.ts` | Lines 13-23, 148-178 | `hmacHash`, `hmacVerify`, `centralDeriveKey`, `centralEncrypt`, `centralDecrypt` |
| `_shared/email.ts` | Lines 121-379 | `sendConfigUploadEmail`, all `build*EmailHtml` helpers |
| `_shared/sophos-central.ts` | Lines 182-304 | `sophosGetToken`, `sophosWhoAmI`, `sophosFetchAllPages`, `sophosFetchTenants`, `sophosFetchFirewalls` |

These are also usable by `parse-config`, `sophos-central`, and other edge functions — deduplicating CORS and client creation.

### 5b. Extract route modules (largest first)

Each module exports a single handler function: `(req, segments, corsHeaders) => Response | null`. Returns `null` if the route doesn't match, letting the main router try the next handler.

| New file | Route prefix | Current lines | ~Size |
|----------|-------------|---------------|-------|
| `api/routes/config-upload.ts` | `config-upload-request(s)`, `config-upload/:token/*` | 1839-2317 | ~480 |
| `api/routes/se-teams.ts` | `se-teams/*` | 1345-1697 | ~355 |
| `api/routes/passkey.ts` | `passkey/*` | 907-1070 | ~165 |
| `api/routes/health-checks.ts` | `health-checks/*` | 1699-1837 | ~140 |
| `api/routes/agent.ts` | `agent/*` + handlers | 418-748, 794-905 | ~445 |
| `api/routes/admin.ts` | `admin/*`, `auth/mfa-recovery` | 1072-1212 | ~140 |
| `api/routes/assessments.ts` | `assessments` | 1214-1287 | ~75 |
| `api/routes/shared.ts` | `shared/:token`, `shared-health-check/:token` | 1289-1343 | ~55 |
| `api/routes/firewalls.ts` | `firewalls` | 2319-2396 | ~80 |
| `api/routes/send-report.ts` | `send-report` | 2398-2466 | ~70 |

### 5c. Slim main router

After extraction, `api/index.ts` becomes ~80-100 lines:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { json } from "../_shared/json.ts";
import { handleAgent } from "./routes/agent.ts";
import { handlePasskey } from "./routes/passkey.ts";
// ... etc

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  // ... size check, URL parse ...

  const response =
    await handleAgent(req, segments, corsHeaders) ??
    await handlePasskey(req, segments, corsHeaders) ??
    await handleAdmin(req, segments, corsHeaders) ??
    // ... etc
    json({ error: "Not found" }, 404);

  return response;
});
```

### 5d. Update config.toml and deploy scripts

No changes needed — all routes still deploy as the single `api` function. The split is **internal** (code organization), not a new Supabase function. This avoids URL changes, CORS changes, and client-side routing updates.

Future: if routes need independent scaling, promote a route module to its own edge function entry point and add it to `config.toml` + deploy scripts.

### 5e. Validate

- Manual smoke test of each route group after extraction
- Extend `e2e/smoke.spec.ts` with API-level tests (or add a new `e2e/api.spec.ts`)
- Verify `supabase functions serve` works locally with the new file structure

---

## Phase 6: Component tests Wave 3 — comprehensive (1 week)

### 6a. Remaining components

All components not covered in Wave 1 or 2. Target: every component under `src/components/` has at least one test file covering:
- Renders without crashing
- Key props produce expected output
- User interactions trigger expected callbacks

### 6b. Hook integration tests

Test the extracted `useHealthCheck*` hooks from Phase 3 with `renderHook`, verifying state transitions and Supabase interactions.

### 6c. Expand E2E

Add Playwright tests for:
- Authenticated health-check flow (upload, analyse, view results)
- Config upload customer journey (receive link, upload XML, SE reviews)
- SE team management (create team, invite, switch)

---

## Success metrics

| Metric | Current | Target |
|--------|---------|--------|
| Component test files | 0 | 160+ |
| Vitest coverage (components) | 0% | >60% |
| `analyse-config.ts` lines | 3,152 | ~250 (barrel) |
| `HealthCheck2.tsx` lines | 3,412 | ~400 (orchestrator) |
| `api/index.ts` lines | 2,473 | ~100 (router) |
| Largest single file | 3,412 | <500 |
| `_shared/` modules | 0 | 7 |
| Domain analyser files | 1 (`nat.ts`) | 10+ |

---

## Risk notes

- **analyse-config barrel re-export**: 30+ files import from `@/lib/analyse-config`. Keeping it as a barrel avoids a mass import rewrite. Long-term, consumers should import from `@/lib/analysis/*` directly.
- **API split is internal only**: No new Supabase functions, no URL changes, no client updates. This is purely code organization within the existing `api` function.
- **HealthCheck2 hooks share state**: Some hooks need to pass data to each other (e.g., analysis results feed into export). Use a context or pass values between hooks in the orchestrator.
- **Connector divergence**: `firecomply-connector/src/analysis/analyse-config.ts` is a separate simplified copy. Phase 1 does not touch it. Alignment is a future task.
