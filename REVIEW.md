# Sophos FireComply — Functional Review & Feature Roadmap

> **Date:** 5 March 2026
> **Purpose:** Summarised review of current functionality, improvement ideas, and new feature suggestions. Annotate the **Action** column with your decisions (✅ Do, ⏳ Later, ❌ Skip) and add notes.

---

## Current Feature Summary

| Area | What It Does Today |
|------|--------------------|
| **Upload & Parsing** | Drag-and-drop Sophos Config Viewer HTML files. Multi-firewall support. Client-side parsing of rules, NAT, SSL/TLS, interfaces, zones, admin settings, and 40+ config sections. |
| **Deterministic Analysis** | 30+ security checks across rules, SSL/TLS, admin access, MFA, NAT, web filter, IPS, virus scanning, and device hardening. Findings rated Critical → Info. |
| **Risk Scoring** | 0–100 score across 8 categories (Web Filter, IPS, App Control, Auth, Logging, Rule Hygiene, Admin, Anti-Malware). Letter grade A–F. |
| **AI Reports** | Per-firewall reports, executive summary (2+ firewalls), and compliance evidence pack. AI-generated via streaming. Export as PDF, DOCX, PPTX, ZIP. |
| **Compliance Mapping** | 19 frameworks (NCSC, CE/CE+, ISO 27001, PCI DSS, NIST, HIPAA, NIS2, GDPR, etc.). Heatmap grid with Pass/Partial/Fail per control. |
| **Best Practice Checks** | 30+ Sophos-specific checks tied to documentation. Licence-tier aware (Standard, XStream, Individual). Auto-detect via Central. |
| **Score Simulator** | 8 what-if toggles (enable WF, IPS, App Control, SSL, logging, MFA, replace ANY, restrict admin). Projected score overlaid on donut and radar charts. |
| **Rule Optimiser** | Finds duplicate, shadowed, and mergeable rules. |
| **Consistency Checker** | Compares 2+ firewalls for policy alignment (DPI, coverage %, score spread, admin exposure). |
| **Attack Surface Map** | DNAT/port-forwarding exposure map. Risk-rated (Critical → Low). Cross-references IPS/WF/logging coverage. |
| **Config Diff** | Section and row-level diff between two config exports. Added/removed/modified views. |
| **Remediation Playbooks** | 25+ step-by-step guides with Sophos UI paths, doc links, estimated time, and verification steps. |
| **Central Integration** | OAuth connection to Sophos Central. Pulls tenants, firewalls, licences, alerts, MDR feed. Link configs to Central firewalls for enrichment. |
| **MSP Dashboard** | Multi-tenant customer list with scores, findings, last assessed date. Search, sort, at-risk count. |
| **Licence Monitor** | Firewall licence expiry tracking from Central Licensing API. Export CSV. |
| **AI Chat** | Floating assistant with assessment context. Suggested prompts. Streaming markdown responses. |
| **Reports Library** | Save and reload report packages (cloud or local). |
| **Assessment History** | Save/load pre-AI assessments with rename and delete. |
| **Setup Wizard** | 8-step onboarding with mock UI previews for each feature. |
| **Keyboard Shortcuts** | Shortcuts for common actions. Modal reference. |
| **Notifications** | In-app notification centre with read/dismiss/clear. |

---

## Improvements to Existing Features

| # | Area | Suggestion | Action | Notes |
|---|------|-----------|--------|-------|
| 1 | **Overview Tab** | Add a "Top 3 Priority Actions" card that surfaces the highest-impact, lowest-effort items from the Priority Matrix — give the user a clear "what to do next". | | |
| 2 | **Overview Tab** | Show a score trend chart when the same firewall has been assessed before (even just "last time → now"). | | |
| 3 | **Security Analysis** | Add a summary row at the top with the 4 key numbers (Score, Critical Findings, Coverage %, Rules Analysed) before the detailed widgets. | | |
| 4 | **Zone Traffic Flow** | Add a "simplified view" toggle that shows only the problem flows (missing WF/IPS) rather than all flows. | | |
| 5 | **Compliance Heatmap** | Add export to CSV/Excel — MSPs need to attach this to tender responses and audit evidence. | | |
| 6 | **Compliance Heatmap** | Add a "Gaps Only" filter that hides passing controls and shows only Partial/Fail. | | |
| 7 | **Compliance** | Add a compliance score per framework (% of controls passing) rather than just the heatmap. | | |
| 8 | **Config Diff** | Add side-by-side risk scores and grades for the two configs. | | |
| 9 | **Config Diff** | Add a findings delta — "Config A has 12 findings, Config B has 8. Here are the 4 that were fixed." | | |
| 10 | **Config Diff** | Timeline view — when the same firewall has 3+ assessments, show a timeline of changes. | | |
| 11 | **AI Chat** | Contextual suggested questions per tab (compliance questions on Compliance tab, analysis questions on Security Analysis tab). | | |
| 12 | **AI Chat** | "Explain this finding" button on every finding card — opens chat pre-populated with the question. | | |
| 13 | **AI Chat** | One-click "Generate executive summary" button for a plain-English summary separate from the full report. | | |
| 14 | **AI Chat** | Persist conversation history with the assessment so you can resume later. | | |
| 15 | **Remediation** | Persist "Mark as done" state — save which playbooks were completed, by whom, and when. | | |
| 16 | **Remediation** | Link playbooks to Score Simulator — "Complete these 3 and your score goes from D → B." | | |
| 17 | **Reports** | Customer-facing read-only portal — shareable time-limited URL for clients to view their report without logging in. | | |
| 18 | **Reports** | Standalone executive one-pager — single page with score, grade, top 5 risks, trend, and next steps for C-suite. | | |
| 19 | **Reports** | Branded PDF cover page with MSP logo, customer name, and assessment date. | | |
| 20 | **Attack Surface** | Highlight new exposures since last assessment in red. | | |
| 21 | **MSP Dashboard** | Score trend sparklines per customer (requires assessment history). | | |

---

## New Features to Consider

| # | Feature | Description | Impact | Effort | Action | Notes |
|---|---------|-------------|--------|--------|--------|-------|
| 22 | **Scheduled Assessments** | Recurring assessments (weekly/monthly). Track score trends over time. Alert when score drops or new critical findings appear. | High | Medium | | |
| 23 | **Findings History & Regression** | Diff between current and previous assessment findings. Show new, fixed, and regressed findings. | High | Medium | | |
| 24 | **Fleet-Wide Estate Heatmap** | All firewalls in a grid, colour-coded by score/grade. Outlier detection ("3 of 12 firewalls have admin on WAN"). | High | Medium | | |
| 25 | **Email / Webhook Alerting** | Notify on licence expiry, score drops, new critical findings, Central disconnection. Push to Slack, Teams, or PSA tools. | High | Medium | | |
| 26 | **Assign Remediation Tasks** | Assign playbooks to team members. Track completion. Ties into existing team/invite feature. | Medium | Medium | | |
| 27 | **Re-Assessment Validation** | After remediation, re-upload config and auto-highlight what improved vs what's still outstanding. | High | Medium | | |
| 28 | **Risk Register Export** | Export findings as a formal risk register (Excel/CSV) with Risk ID, Description, Likelihood, Impact, Controls, Owner, Due Date, Status. | Medium | Low | | |
| 29 | **Compliance Score Per Framework** | Percentage of controls passing per framework. Track over time. | Medium | Low | | |
| 30 | **Cyber Insurance Readiness** | Map findings to common insurance questionnaire questions ("Do you have MFA?", "Is your firewall monitored 24/7?"). Readiness score. | Medium | Medium | | |
| 31 | **Policy Baseline Templates** | Define a "gold standard" config template. Score each firewall against it. MSPs create templates per customer tier (Basic/Standard/Premium). | Medium | Medium | | |
| 32 | **Attack Surface Geo-IP** | World map with exposed services pinned to locations (using external IPs from Central). | Medium | High | | |
| 33 | **CVE Correlation** | For known exposed services (RDP, HTTP, etc.), show relevant recent CVEs from a public feed. | Medium | High | | |
| 34 | **REST API** | Expose assessment results as an API for PSA/RMM dashboards, ticketing, and BI tools (Power BI, Grafana). | Medium | High | | |
| 35 | **Change Approval Workflow** | Technician proposes changes from playbooks → Manager/client approves → Changes logged → Post-change validation. | Low | High | | |
| 36 | **Offline / Air-Gapped Mode** | No Supabase auth, no AI reports, all analysis client-side, local storage only. For government/defence customers. | Niche | Medium | | |

---

## Suggested Priority Order

### Do Next
- **#22** Scheduled assessments + score trends (transforms from point-in-time to ongoing monitoring)
- **#15** Persistent remediation tracking (low effort, high stickiness)
- **#23** Findings history & regression detection (key for re-assessments)

### Soon
- **#17** Customer-facing report portal
- **#24** Fleet-wide estate heatmap
- **#25** Email/webhook alerting
- **#1** "Top 3 Priority Actions" on Overview
- **#28** Risk register export

### Quick Wins
- **#5** Compliance heatmap CSV export
- **#6** Compliance "Gaps Only" filter
- **#12** "Explain this finding" button → AI chat
- **#9** Config diff with findings delta
- **#8** Side-by-side scores in Config Diff

### Plan
- **#30** Cyber insurance readiness score
- **#31** Policy baseline templates
- **#32** Attack surface geo-IP
- **#34** REST API

### Later
- **#35** Change approval workflow
- **#36** Offline mode

---

## How to Use This Document

1. Review each row and fill in the **Action** column (✅ ⏳ ❌)
2. Add your **Notes** — priorities, constraints, customer requests
3. Feed the annotated version back and we'll build a plan for the items you choose



Sophos FireComply — Functional Review & Feature Ideas
What the App Does Well
You've built a genuinely comprehensive firewall assessment platform. The core loop — upload HTML config, get deterministic analysis, AI reports, compliance mapping, and remediation — is solid and differentiated. The Sophos Central integration, MSP multi-tenant dashboard, and the breadth of 30+ best practice checks put this well beyond a simple audit tool. The Score Simulator with projected overlay is a clever sales/remediation hook.

Features to Improve
1. Scheduled / Automated Assessments
Right now, everything is manual: upload a file, run analysis, save. For an MSP tool, you want recurring assessments. Since you already have Central integration with firewall serials, you could:

Schedule automatic re-assessments (weekly/monthly) by pulling config exports via Central API (if Sophos supports it) or prompting the MSP to re-upload
Track score trends over time — a sparkline per customer showing improvement or regression
Send email alerts when a firewall's score drops below a threshold or a new critical finding appears
This turns FireComply from a point-in-time tool into ongoing monitoring.

2. Customer-Facing Reports / Portal
You generate great reports, but they're only accessible inside the app. Consider:

A read-only customer portal where MSPs can share a report link with their client (no login needed, time-limited URL)
A branded PDF cover page with the MSP's logo, customer name, and assessment date — you have branding setup but the reports could be more polished
Executive summary as a standalone one-pager — many MSPs need a single page to hand to a C-suite that shows: score, grade, top 5 risks, trend, and next steps
3. Remediation Tracking & Workflow
You have 25+ playbooks, which is excellent, but the "Mark as done" is ephemeral — it's just local state. Consider:

Persistent remediation tracking — save which playbooks have been completed, by whom, when
Assign remediation tasks to team members (ties into your existing team/invite feature)
Before/after score projection — "If you complete these 3 playbooks, your score goes from D to B" (you already have the Score Simulator logic, just wire it to specific playbooks)
Re-assessment validation — after remediation, re-upload the config and automatically highlight what improved vs what's still outstanding
4. Findings History & Regression Detection
When an MSP re-assesses the same firewall, there's no way to see:

Which findings are new since last assessment
Which findings were fixed
Which findings regressed (were fixed then came back)
A diff between the current and previous assessment's findings would be extremely valuable — you already have diff-config.ts for raw config, extend this concept to findings.

5. Dashboard Improvements
Overview Tab:

The Overview tab shows stats and findings but doesn't give a clear "what should I do next?" call to action. Add a "Top 3 Priority Actions" card at the top that surfaces the highest-impact, lowest-effort items from the Priority Matrix
Score trend chart — when the same firewall has been assessed multiple times, show the score over time (even just 2 data points: "last assessment vs now")
Security Analysis Tab:

The tab has 7+ widgets which is a lot of scrolling. Consider a summary row at the top with the 4 most important numbers (Score, Critical Findings, Coverage %, Rules Analysed) before the detailed widgets
Zone Traffic Flow is powerful but dense — add a "simplified view" toggle that shows just the problem flows (missing web filter/IPS) rather than all flows
Compliance Tab:

The heatmap is excellent but static. Add export to CSV/Excel of the compliance matrix — MSPs often need to attach this to tender responses or audit evidence packs
Add a "Gaps Only" filter that hides passing controls and shows only Partial/Fail
Consider a compliance score per framework (% of controls passing) rather than just the overall heatmap
6. Multi-Firewall Estate View
When an MSP has 10+ firewalls across customers, they need:

A fleet-wide risk heatmap — all firewalls in a grid, colour-coded by score/grade
Outlier detection — "3 of your 12 firewalls have admin console exposed on WAN" (aggregate findings across estate)
Policy templates — "Apply this baseline policy to all firewalls" or at least "here's the delta between your best-configured firewall and the rest"
7. Attack Surface Map Enhancements
The current attack surface map shows DNAT/port forwarding exposure, which is great. Add:

Geo-IP visualisation — if you have external IPs from Central, show a world map with exposed services pinned to locations
CVE correlation — for known services (e.g. RDP, HTTP), show relevant recent CVEs from a public feed
Change detection — highlight new exposures since last assessment in red
8. AI Chat Improvements
The AI chat is useful but limited:

Contextual suggestions per tab — when on the Compliance tab, suggest compliance-specific questions; when on Security Analysis, suggest analysis questions
"Generate executive summary" button — one-click AI-generated plain English summary of the assessment, separate from the full report
"Explain this finding" — clickable from any finding card, opens chat pre-populated with "Explain finding X and how to fix it on a Sophos XGS"
Conversation persistence — save chat history with the assessment so you can come back to it
9. Config Comparison Improvements
The diff tool compares raw config sections. Add:

Score comparison — side-by-side risk scores and grades for the two configs
Findings delta — "Config A has 12 findings, Config B has 8. Here are the 4 that were fixed"
Timeline view — when the same firewall has 3+ assessments, show a timeline of changes rather than just A vs B
10. Alerting & Notifications
The notification centre exists but appears to only show in-app events. Add:

Email notifications for: licence expiry warnings, score drops, new critical findings, Central disconnection
Webhook integration — push events to Slack, Teams, or a PSA/ticketing tool (ConnectWise, Autotask, HaloPSA)
SLA tracking — "Critical findings must be remediated within 7 days" with countdown timers
New Features to Consider
11. Firewall Policy Baseline Templates
Define a "gold standard" configuration template (e.g. Sophos XGS Best Practice Baseline) and score each firewall against it. Show percentage compliance with the template. MSPs could create their own templates for different customer tiers (Basic, Standard, Premium).

12. Change Approval Workflow
Before remediation changes are applied to a firewall, an approval step:

Technician proposes changes (from playbooks)
Manager/client approves
Changes are logged in the audit trail
Post-change assessment validates
13. Risk Register Export
Export findings as a formal risk register (Excel/CSV) with: Risk ID, Description, Likelihood, Impact, Current Controls, Recommended Controls, Owner, Due Date, Status. This is what compliance auditors and insurers want.

14. Cyber Insurance Integration
Many SMBs need cyber insurance. Add a "Cyber Insurance Readiness" score that maps your findings to common insurance questionnaire questions (e.g. "Do you have MFA enabled?", "Is your firewall monitored 24/7?", "Do you have SSL inspection?"). This gives MSPs a selling point.

15. API for Third-Party Integration
Expose the assessment results as a REST API so MSPs can:

Pull scores into their PSA/RMM dashboards
Feed findings into ticketing systems
Integrate with reporting tools (Power BI, Grafana)
16. Offline / Air-Gapped Mode
Some government/defence customers can't use cloud services. An offline mode where:

No Supabase auth required
No AI reports (or local LLM)
All analysis runs client-side (it already does)
Reports saved locally
You already have local storage fallbacks — formalise this as a mode.

Priority Ranking
#    Feature    Impact    Effort    Priority
1    Scheduled assessments + score trends    High    Medium    Do Next
2    Remediation tracking with persistence    High    Low    Do Next
4    Findings history & regression detection    High    Medium    Do Next
3    Customer-facing report portal/links    High    Medium    Soon
5    Dashboard "what to do next" summary    Medium    Low    Soon
6    Fleet-wide estate heatmap    High    Medium    Soon
10    Email/webhook alerting    High    Medium    Soon
13    Risk register export    Medium    Low    Soon
5    Compliance CSV export + per-framework score    Medium    Low    Quick Win
8    AI chat contextual suggestions + "explain finding"    Medium    Low    Quick Win
9    Config diff with findings delta    Medium    Low    Quick Win
14    Cyber insurance readiness score    Medium    Medium    Plan
11    Policy baseline templates    Medium    Medium    Plan
7    Attack surface geo-IP + CVE correlation    Medium    High    Plan
15    REST API for integrations    Medium    High    Plan
12    Change approval workflow    Low    High    Later
16    Offline/air-gapped mode    Niche    Medium    Later
The app is already strong in breadth. The biggest gap is the time dimension — everything is a snapshot. Adding assessment history, score trends, regression detection, and persistent remediation tracking would transform it from an assessment tool into an ongoing security posture management platform. That's the difference between a one-off sale and recurring revenue for MSPs.

code review

Sophos FireComply - Full Application Review
Architecture
What's Good
Clear data pipeline: HTML parsing (extract-sections.ts) -> analysis (analyse-config.ts) -> presentation (components). No circular dependencies between layers.
Well-typed interfaces throughout (AnalysisResult, ExtractedSections, Finding, RiskScoreResult).
Good use of lazy() / Suspense for code splitting heavy components.
Auth via Supabase with proper RLS design; secrets encrypted at rest in the edge function.
Custom hooks (useFirewallAnalysis, useReportGeneration, useAutoSave) encapsulate domain logic cleanly.
What Needs Work
Area    Issue    Priority
God component    Index.tsx (969 lines, 18+ useState calls) orchestrates everything    High
Monolith files    SecurityDashboards.tsx (1012 lines, 6 components), analyse-config.ts (1272 lines)    High
State management    Pure prop drilling; no shared context for files, analysisResults, branding    Medium
No error boundaries    A single uncaught error in any component crashes the entire app    High
Testing
Current State
3 real test files, 1 placeholder (example.test.ts just asserts true === true)
Only extract-sections, analyse-config, and diff-config have tests
0 component tests despite having @testing-library/react installed
0 hook tests
No coverage reporting configured
Recommendations
Add coverage to vitest.config.ts (coverage: { provider: 'v8', reporter: ['text', 'html'] })
Delete or replace example.test.ts
Add tests for critical paths: risk-score.ts, sophos-licence.ts, rule-optimiser.ts, compliance-map.ts
Add component tests for EstateOverview, FileUpload, AuthGate
Add hook tests for use-auth, use-central, use-firewall-analysis
Target: at least 60% coverage on src/lib/ as a starting point
TypeScript Strictness
Current Config (tsconfig.app.json)
"strict": false,
"noImplicitAny": false,
"noUnusedLocals": false,
"noUnusedParameters": false,
"strictNullChecks": false
This is essentially the loosest possible TypeScript config. You're getting type-checking at the most superficial level.

Recommendations
Enable strict: true incrementally - start with strictNullChecks (the highest-value flag). This alone will catch null/undefined bugs at compile time.
Enable noUnusedLocals and noUnusedParameters to catch dead code.
There are only 4 as any casts in the codebase (all in DocumentPreview.tsx and use-session-persistence.ts) — this is actually very good and means strict mode won't require many changes.
Error Handling
Silent Catches (30+ instances)
Errors are swallowed across the codebase with catch { }, catch { /* ignore */ }, or catch { /* best-effort */ }:

File    Count    Example
use-central.ts    9    catch { setGroups([]) }, catch { /* ignore */ }
Index.tsx    6    catch { /* best-effort */ } in Central enrichment
AppHeader.tsx    3    catch { } in status refresh
SetupWizard.tsx    3    catch { } on Central API calls
CentralEnrichment.tsx    3    .catch(() => setStatus(null))
stream-ai.ts    4    .catch(() => ({ error: "Request failed" }))
Others    10+    BrandingSetup, SophosBestPractice, SavedReportsLibrary, etc.
No Error Boundaries
Zero ErrorBoundary components. A render error in any component (e.g. bad data shape from API) takes down the entire app with a white screen.

Recommendations
Add a top-level <ErrorBoundary> around the app with a "Something went wrong" fallback
Add granular error boundaries around each tab's content (so one broken tab doesn't kill the others)
Replace silent catches with at minimum console.warn in development, or a lightweight error reporting service
Add structured error types instead of raw string messages
Security
What's Good
No hardcoded secrets
Sophos Central credentials encrypted with AES-256-GCM at rest
DOMPurify used for all innerHTML/dangerouslySetInnerHTML usage
Auth tokens passed via Supabase session, not stored in localStorage manually
Concerns
Issue    Location    Risk
AI chat uses anon key, not session token    stream-ai.ts line 54    Medium - edge function must enforce auth independently
res.json() called without try/catch    sophos-central.ts line 19    Low - non-JSON response crashes the call
No CSP headers configured    N/A    Low - XSS mitigation already handled by DOMPurify
noFallthroughCasesInSwitch: false    tsconfig.app.json    Low - could mask logic bugs
Recommendations
Verify the parse-config edge function checks the user's session token, not just the anon key
Wrap res.json() in a try/catch in callCentral
Add Content-Security-Policy headers via Vite config or hosting platform
Performance
No React.memo Anywhere
Zero usage across 127 source files. Heavy components that receive stable props (e.g. SecurityFeatureCoverage, ZoneTrafficFlow, PriorityMatrix, SophosBestPractice) will re-render every time Index.tsx state changes (which is often, given 18 state variables).

Lazy Loading
Good use of lazy() for 10+ heavy components (ConfigDiff, RemediationPlaybooks, ComplianceHeatmap, AIChatPanel, ScoreSimulator, AttackSurfaceMap, etc.).

Potential Render Storms
Index.tsx has 18 useState calls. Any state change re-renders the entire tree.
analysisResults is recomputed via useMemo in useFirewallAnalysis, but the objects it returns are new references each time files changes.
Tab content that isn't visible is unmounted (good — Radix Tabs default), but switching tabs triggers full mount/computation.
Recommendations
Wrap expensive dashboard components in React.memo
Consider extracting analysisResults into a context to avoid re-renders from unrelated state changes in Index.tsx
Profile with React DevTools Profiler to identify the worst offenders
For ScoreSimulator: the useEffect that calls onProjectedChange fires on every toggle — consider debouncing
Accessibility
What's Good
shadcn/ui components provide built-in ARIA roles (dialogs, popovers, tabs, tooltips)
Keyboard shortcuts implemented (use-keyboard-shortcuts.ts)
AppHeader has proper aria-label on icon buttons
What's Missing
Issue    Files
Icon-only buttons without aria-label    AIChatPanel.tsx (close, clear, send buttons)
No skip-to-content link    Index.tsx
No focus trap on AI chat panel    AIChatPanel.tsx
Decorative images use alt="" but no aria-hidden    20+ instances
Custom SVG charts have no accessible text    PriorityMatrix.tsx, RiskScoreDashboard.tsx
Colour alone conveys meaning    Severity badges, stat cards, risk scores
Recommendations
Add aria-label to all icon-only buttons
Add a skip-to-main-content link at the top of the page
Add focus trapping to the AI chat panel when open
Add role="img" and aria-label to custom SVG charts
Ensure colour-coded elements also have text labels or patterns for colour-blind users
Code Quality
Console Statements
Only 2 console.error calls in the entire codebase — both appropriate (404 page, retry logging). Clean.

eslint-disable Comments
5 instances of eslint-disable-next-line react-hooks/exhaustive-deps:

BrandingSetup.tsx (lines 162, 209)
FirewallLinker.tsx (lines 57, 84)
Index.tsx (lines 104, 210)
CentralIntegration.tsx (line 59)
LicenceExpiryWidget.tsx (line 48 — recently fixed)
Each should be reviewed — the usual pattern is a useEffect that intentionally omits a dep to run only once, but this can cause stale closure bugs.

UI Duplication
Repeated patterns that should be extracted:

Stat cards: 4+ variations of rounded-lg px-2.5 py-2 text-center with different colours in EstateOverview, SecurityDashboards, LicenceExpiryWidget
Section headers: Icon + title + subtitle pattern repeated 10+ times
Banner cards: rounded-xl border ... px-5 py-4 flex in Index.tsx lines 334-338, 467-477
Long Tailwind class strings: The same data-[state=active]:border-[#2006F7] dark:data-[state=active]:border-[#00EDFF] was repeated 7 times before the tabs.tsx refactor
API Layer
Missing Resilience
Feature    sophos-central.ts    stream-ai.ts
Timeout    None    60s / 150s
Retry    None    2x with backoff (in hook)
Rate limiting    None    None
Safe JSON parse    No    No
Structured errors    No (raw strings)    No
Edge Function (sophos-central/index.ts)
fetchAllPages has no rate limiting — could hit Sophos API limits with large tenants
No caching of Sophos auth tokens (re-authenticates every request)
MDR threat feed silently returns empty on failure; other modes don't
Recommendations
Add a 30s timeout to callCentral via AbortController
Add retry with backoff for 429/5xx responses
Cache the Sophos OAuth token (it's valid for 1 hour) to reduce auth calls
Add rate limiting or request queuing in the edge function
Dependencies
What's Good
Modern stack: React 18, Vite 5, TypeScript 5.8, Tailwind 3
No deprecated or abandoned packages
Clean separation: Radix for headless UI, Recharts for charts, docx/pptxgenjs for exports
Notes
@types/dompurify and @types/file-saver are in dependencies — should be in devDependencies
18 Radix UI packages — consider if all are actually used (audit with npx depcheck)
react-day-picker and input-otp may not be actively used
Run npm audit regularly
File Organisation
Recommended Splits
Current File    Lines    Recommendation
Index.tsx    969    Extract UploadSection, AnalysisTabs, ReportSection, useAppState hook
SecurityDashboards.tsx    1012    Split into security-dashboards/ folder with one file per component
analyse-config.ts    1272    Split into analysis/inspection-posture.ts, analysis/findings.ts, analysis/ssl-rules.ts
SetupWizard.tsx    947    Split into setup/ folder with step components
EstateOverview.tsx    573    Extract StatCard to ui/StatCard.tsx for reuse
Quick Wins (do these first)
Add an ErrorBoundary — prevents white-screen crashes (30 min)
Move @types/* to devDependencies — cleaner package.json (5 min)
Enable strictNullChecks in tsconfig — catches the most bugs per effort (1-2 hours to fix type errors)
Add timeout to callCentral — prevents hung requests (15 min)
Add aria-label to icon-only buttons — quick accessibility win (30 min)
Delete example.test.ts and add coverage config (5 min)
Wrap res.json() in try/catch in sophos-central.ts (5 min)


1. Parser Reliability
The concern: If your parser silently misses data or crashes on unexpected HTML, every downstream result (findings, scores, compliance) is wrong — and the user won't know.

Current state:

extractSections has no try/catch — a malformed HTML file can crash the app
No input validation before parsing (file could be non-HTML, a different Sophos product, or a different export version)
Only 1 test fixture (basic-firewall.html) — no tests for malformed HTML, empty tables, missing sections, or different Sophos firmware versions
The "Extraction Coverage" bar shows 152 of 152 sections but doesn't indicate data quality within those sections
What to improve:

Wrap extractSections in a try/catch in Index.tsx and show a clear error if parsing fails ("This file couldn't be parsed — it may not be a Sophos Config Viewer export")
Validate the input before parsing — check for expected markers (the Sophos Config Viewer sidebar, known section IDs) and reject files that aren't valid exports with a clear message
Add a parser confidence score — report how many expected sections were found vs expected. Surface this prominently: "78% of expected sections parsed — some analysis may be incomplete"
Test edge cases — add fixtures for: empty config, config with no rules, config with only NAT rules, config from a different firmware version, completely malformed HTML, a non-Sophos HTML file
Version detection — detect the Sophos firmware/export version and warn if it's untested ("This export appears to be from SFOS v19 — FireComply has been validated against v20/v21")
2. Determinism of Findings
The concern: If you're positioning findings as authoritative compliance evidence, they need to be provably repeatable, auditable, and transparent about limitations.

Current state:

Findings are fully deterministic — same input always produces same output (good)
Severities are mostly hardcoded, with two dynamic exceptions based on percentages (IPS and App Control coverage)
No confidence level or certainty indicator on any finding
No provenance — findings don't reference which specific config data triggered them
The compliance heatmap shows Pass/Partial/Fail but doesn't explain why or link to the evidence
What to improve:

Add a confidence field to findings — "confidence": "high" | "medium" | "low". Parser-derived findings (e.g. "web filter disabled on rule X") are high confidence. Inferred findings (e.g. "no SSL/TLS inspection detected" when the section might just be missing) should be medium/low
Add evidence/provenance to findings — each finding should reference the exact config data that triggered it: "Rule 'Allow_All_Traffic' (row 7 in Firewall Rules) has Service=ANY"
Make severity assignment transparent — document the severity logic somewhere the user can see. A "How findings are scored" help section
Compliance status should link to evidence — the heatmap cells should show exactly which findings/checks drove the Pass/Partial/Fail status, not just the status itself. You have evidence in the control checks but it's just a text string — make it reference specific findings
Flag parser-dependent findings — if a finding depends on a section that had low extraction quality, flag it: "This finding may be incomplete — the SSL/TLS section could not be fully parsed"
3. Privacy / Data Governance
The concern: You're handling firewall configurations — the most sensitive network data a customer has. The feedback is asking whether you've done enough to govern this.

Current state:

Config data is anonymised before being sent to AI (IPs, customer names, labels replaced) — this is good
Raw config never leaves the browser — only anonymised sections go to the AI, and only summaries go to Supabase — this is good
No data retention policy — saved reports and assessments live in Supabase indefinitely
No data processing agreement (DPA) or privacy policy visible in the app
No way for a customer to request deletion of all their data
The AI uses Google Gemini — config data (even anonymised) goes to Google's servers
No mention of where data is processed geographically (EU/US/etc.)
Audit trail is incomplete — 7 of 12 defined audit events are never logged
What to improve:

Add a visible privacy policy / data handling statement in the app — not just the landing page text. A dedicated "How we handle your data" section in Settings or a modal accessible from the header
Document the AI data flow explicitly — "Your config data is anonymised (IPs, names replaced) and sent to Google Gemini for report generation. No raw config data is stored on our servers. Anonymised data is not retained by the AI provider beyond the request."
Add data retention controls — allow orgs to set auto-deletion (e.g. "delete assessments older than 12 months"). Add a "Delete all my data" button for GDPR right-to-erasure
Complete the audit trail — log all 12 defined events, especially auth.login, auth.logout, central.linked, team.invited, report.deleted. For compliance-conscious customers, this is table stakes
Add data residency information — which Supabase region? Which Google Cloud region for Gemini? Display this in Settings
Consider a "no-AI mode" — some customers (government, defence) can't send any data externally. Let them use deterministic analysis + pre-built report templates without the AI, producing a less polished but fully offline report
Add a DPA template — MSPs working with regulated clients need a Data Processing Agreement. Even a downloadable template helps
4. Operational Resilience
The concern: What happens when things go wrong? Can the app degrade gracefully?

Current state:

No React Error Boundaries — a single render error white-screens the entire app
Parser failures propagate with no catch — a bad file crashes everything
Supabase failures are silently swallowed — saved reports return [], no user feedback
AI has good resilience: 2 retries with backoff, partial output preservation, timeout handling
No health check or status page
No offline/degraded mode
What to improve:

Add Error Boundaries — at minimum around each tab's content so one broken tab doesn't kill the app. Show "This section encountered an error — your data is safe" with a retry button
Wrap parser in try/catch — show a specific error for each file that fails to parse rather than crashing
Surface Supabase failures to the user — instead of silent empty arrays, show a toast: "Couldn't save to cloud — data saved locally as backup"
Add a local-first fallback — if Supabase is unreachable, auto-save to IndexedDB and sync when connection returns
Add a health indicator — small status dot (like the Central connection dot) showing: "All systems operational" / "Cloud storage unavailable" / "AI service degraded"
Rate limit the Sophos Central API calls — fetchAllPages has no rate limiting, which could hit Sophos API limits for large MSPs with many tenants
5. Product Framing
The concern: The app sometimes frames itself as authoritative ("audit-ready", "compliance evidence pack") when it should frame itself as advisory.

Current state:

The AI report system prompt uses language like "audit-ready" and "suitable for compliance" (in the parse-config edge function)
"Compliance Evidence Pack" implies the output IS the evidence, rather than a tool to help gather evidence
The compliance heatmap shows Pass/Fail without caveats about the mapping being indicative
There's good privacy framing ("Data Privacy Protected", "Data Anonymised") but no advisory disclaimer on the analysis itself
"Deterministic Findings" is used, which is accurate and good — but there's no caveat that deterministic doesn't mean complete
What to improve:

Add a global disclaimer — visible on the dashboard and in every report: "FireComply provides automated security analysis based on configuration data. Results should be validated by a qualified security professional. Compliance mappings are indicative and do not constitute a formal audit."
Rename "Compliance Evidence Pack" to something less authoritative — "Compliance Readiness Report" or "Compliance Gap Analysis"
Add framework-specific caveats — "This mapping covers X of Y controls from ISO 27001 Annex A. A full ISO 27001 audit requires additional evidence beyond firewall configuration."
Add a "Limitations" section to reports — auto-generated text that says: what was analysed (firewall config only), what was NOT analysed (endpoint, email, identity, cloud, physical security), and that the assessment is point-in-time
Frame the risk score as indicative — "This score reflects your firewall configuration security posture. It does not represent your overall organisational security posture."
Add methodology documentation — a "How it works" page or PDF that explains: what the parser checks, how scores are calculated, how compliance is mapped, and what the AI does vs doesn't do. This is what auditors and procurement teams will ask for
Summary: Priority Actions
Priority    Action    Effort
Now    Add advisory disclaimer to dashboard, reports, and compliance heatmap    Low
Now    Rename "Compliance Evidence Pack" → "Compliance Readiness Report"    Low
Now    Wrap parser in try/catch with user-facing error messages    Low
Now    Add Error Boundaries around tab content    Low
Soon    Add confidence levels to findings    Medium
Soon    Complete the audit trail (all 12 events)    Medium
Soon    Add data retention controls and "delete my data"    Medium
Soon    Add evidence/provenance linking on findings and compliance cells    Medium
Soon    Document AI data flow and data residency in-app    Low
Plan    Parser edge case tests (5+ new fixtures)    Medium
Plan    Compliance and risk-score unit tests    Medium
Plan    Methodology documentation (how scoring works)    Medium
Plan    "No-AI" offline mode for sensitive environments    High
The core message from that feedback is: the analysis engine is solid, but the packaging needs to make clear what it is and what it isn't. The technical foundations (deterministic findings, anonymisation, client-side parsing) are genuinely good — the gap is in transparency, resilience, and framing.
