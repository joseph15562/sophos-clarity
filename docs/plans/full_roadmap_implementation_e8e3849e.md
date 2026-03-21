---
name: Full Roadmap Implementation
overview: Complete implementation plan covering all items from the functional review, code review, and compliance hardening feedback. Organised into 6 phases from quick wins through to major new features, designed to be worked through sequentially.
todos:
  - id: phase-1a
    content: "Phase 1A: Product framing -- disclaimers, rename Compliance Evidence Pack, limitations section, risk score framing, framework caveats"
    status: completed
  - id: phase-1b
    content: "Phase 1B: Create ErrorBoundary component and wrap tab contents, chat panel, and drawer"
    status: completed
  - id: phase-1c
    content: "Phase 1C: Parser resilience -- try/catch around extractSections, input validation for Sophos markers"
    status: completed
  - id: phase-1d
    content: "Phase 1D: API resilience -- timeout, safe JSON parse, retry with backoff in callCentral"
    status: completed
  - id: phase-1e
    content: "Phase 1E: Accessibility -- aria-labels on icon buttons, role=img on SVG charts"
    status: completed
  - id: phase-1f
    content: "Phase 1F: Dependency cleanup -- move @types to devDeps, delete example.test.ts"
    status: completed
  - id: phase-2a
    content: "Phase 2A: Add confidence and evidence fields to Finding interface and assign throughout analyse-config.ts"
    status: completed
  - id: phase-2b
    content: "Phase 2B: Compliance evidence linking -- clickable findings in heatmap cells, per-framework compliance scores"
    status: completed
  - id: phase-2c
    content: "Phase 2C: Complete audit trail -- add logAudit calls for all 12 event types"
    status: completed
  - id: phase-2d
    content: "Phase 2D: Data governance -- How We Handle Your Data section, Delete All Data button, AI data flow docs"
    status: completed
  - id: phase-2e
    content: "Phase 2E: Methodology documentation -- How Scoring Works help modal"
    status: completed
  - id: phase-3a
    content: "Phase 3A: Enable strictNullChecks and fix type errors"
    status: completed
  - id: phase-3b
    content: "Phase 3B: Add test coverage for risk-score, compliance-map, sophos-licence, parser edge cases"
    status: completed
  - id: phase-3c
    content: "Phase 3C: Split SecurityDashboards.tsx into separate files, extract StatCard"
    status: completed
  - id: phase-3d
    content: "Phase 3D: Replace silent catch blocks with console.warn, surface Supabase failures via toast"
    status: completed
  - id: phase-4a
    content: "Phase 4A: Top 3 Priority Actions card on Overview, summary row on Security Analysis"
    status: completed
  - id: phase-4b
    content: "Phase 4B: Compliance heatmap CSV export, Gaps Only filter"
    status: completed
  - id: phase-4c
    content: "Phase 4C: Config Diff -- side-by-side scores and findings delta"
    status: completed
  - id: phase-4d
    content: "Phase 4D: AI Chat -- contextual suggestions, explain-this-finding button, one-click summary"
    status: completed
  - id: phase-4e
    content: "Phase 4E: Zone Traffic Flow simplified/problems-only view toggle"
    status: completed
  - id: phase-4f
    content: "Phase 4F: Persistent remediation tracking with Supabase table, score projection per playbook"
    status: completed
  - id: phase-4g
    content: "Phase 4G: Attack Surface change detection (highlight new exposures)"
    status: completed
  - id: phase-4h
    content: "Phase 4H: Executive one-pager export and branded cover page"
    status: completed
  - id: phase-4i
    content: "Phase 4I: MSP Dashboard score trend sparklines"
    status: completed
  - id: phase-5a
    content: "Phase 5A: Findings history and regression detection with finding_snapshots table"
    status: completed
  - id: phase-5b
    content: "Phase 5B: Risk register export (Excel/CSV)"
    status: completed
  - id: phase-5c
    content: "Phase 5C: Fleet-wide estate heatmap with outlier detection"
    status: completed
  - id: phase-5d
    content: "Phase 5D: Customer-facing shared report portal with time-limited URLs"
    status: completed
  - id: phase-5e
    content: "Phase 5E: Email/webhook alerting system"
    status: completed
  - id: phase-6a
    content: "Phase 6A: Scheduled assessments and score trends"
    status: completed
  - id: phase-6b
    content: "Phase 6B: Cyber insurance readiness module"
    status: completed
  - id: phase-6c
    content: "Phase 6C: Policy baseline templates"
    status: completed
  - id: phase-6d
    content: "Phase 6D: REST API for third-party integrations"
    status: completed
  - id: phase-6e
    content: "Phase 6E: Attack Surface geo-IP and CVE correlation"
    status: cancelled
  - id: phase-6f
    content: "Phase 6F: Offline/air-gapped mode"
    status: completed
  - id: phase-6g
    content: "Phase 6G: Change approval workflow"
    status: completed
  - id: phase-6h
    content: "Phase 6H: AI Chat conversation persistence"
    status: completed
isProject: false
---

# Sophos FireComply Full Roadmap Implementation

This plan covers every item from the functional review (36 items), code review (7 areas), and compliance hardening (5 areas). Organised into 6 phases, each building on the previous.

---

## Phase 1: Quick Wins and Foundations (Day 1-2)

Low-effort, high-impact items that can ship immediately.

### 1A. Product Framing and Disclaimers

- Add a global advisory disclaimer banner to the dashboard in [src/pages/Index.tsx](src/pages/Index.tsx) (below the tab bar): *"FireComply provides automated security analysis based on configuration data. Results should be validated by a qualified security professional. Compliance mappings are indicative and do not constitute a formal audit."*
- Rename "Compliance Evidence Pack" to "Compliance Readiness Report" in [src/components/ReportCards.tsx](src/components/ReportCards.tsx), [src/hooks/use-report-generation.ts](src/hooks/use-report-generation.ts), and the parse-config edge function system prompt
- Add a "Limitations" section auto-appended to AI-generated reports: what was analysed (firewall config only), what was NOT (endpoint, email, identity, cloud, physical), and that the assessment is point-in-time
- Frame risk score as indicative: add subtitle text to `RiskScoreDashboard` -- "Firewall configuration security posture. Does not represent overall organisational risk."
- Add framework-specific caveats to [src/components/ComplianceHeatmap.tsx](src/components/ComplianceHeatmap.tsx): "Covers X of Y controls. A full audit requires evidence beyond firewall configuration."

### 1B. Error Boundaries

- Create a reusable `ErrorBoundary` component in `src/components/ErrorBoundary.tsx` with a "Something went wrong" fallback and retry button
- Wrap each `TabsContent` in [src/pages/Index.tsx](src/pages/Index.tsx) with `ErrorBoundary`
- Wrap the lazy-loaded `AIChatPanel` and `ManagementDrawer` with boundaries

### 1C. Parser Resilience

- Wrap `extractSections(f.content)` at [src/pages/Index.tsx line 113](src/pages/Index.tsx) in try/catch; show a toast per file that fails: "Could not parse [filename] -- it may not be a Sophos Config Viewer export"
- Add input validation in [src/lib/extract-sections.ts](src/lib/extract-sections.ts): check for known Sophos sidebar markers before parsing; reject with a clear message if missing

### 1D. API Resilience

- Add a 30s timeout via `AbortController` to `callCentral` in [src/lib/sophos-central.ts line 5](src/lib/sophos-central.ts)
- Wrap `res.json()` on line 19 in try/catch to handle non-JSON responses
- Add retry with backoff for 429/5xx in `callCentral` (1 retry after 2s)

### 1E. Accessibility Quick Wins

- Add `aria-label` to icon-only buttons in [src/components/AIChatPanel.tsx](src/components/AIChatPanel.tsx) (close, clear, send)
- Add `role="img"` and `aria-label` to custom SVG charts in [src/components/PriorityMatrix.tsx](src/components/PriorityMatrix.tsx) and [src/components/RiskScoreDashboard.tsx](src/components/RiskScoreDashboard.tsx)

### 1F. Dependency Cleanup

- Move `@types/dompurify` and `@types/file-saver` from `dependencies` to `devDependencies` in [package.json](package.json)
- Delete [src/test/example.test.ts](src/test/example.test.ts)

---

## Phase 2: Compliance Hardening (Day 3-4)

Address the compliance feedback around determinism, confidence, evidence, privacy, and audit completeness.

### 2A. Finding Confidence Levels

- Extend the `Finding` interface in [src/lib/analyse-config.ts line 56](src/lib/analyse-config.ts) with `confidence: "high" | "medium" | "low"` and `evidence?: string`
- Assign `confidence: "high"` to parser-derived findings (rule-specific: "web filter disabled on rule X")
- Assign `confidence: "medium"` to inferred findings (e.g. "no SSL/TLS inspection" when section may be missing)
- Add `evidence` field with specific config references: "Rule 'Allow_All_Traffic' (row 7) has Service=ANY"
- Surface confidence as a subtle badge on finding cards in [src/components/EstateOverview.tsx](src/components/EstateOverview.tsx)

### 2B. Compliance Evidence Linking

- Update `ControlMapping` in [src/lib/compliance-map.ts line 5](src/lib/compliance-map.ts) -- `relatedFindings` already exists but is finding IDs. Make these clickable in [src/components/ComplianceHeatmap.tsx](src/components/ComplianceHeatmap.tsx) so clicking a cell shows the specific findings that drove the status
- Add per-framework compliance scores: `summary.pass / (summary.pass + summary.partial + summary.fail) * 100` displayed as a percentage badge per framework column header

### 2C. Complete Audit Trail

- Currently only 5 of 12 `AuditAction` types are logged. Add `logAudit` calls for:
  - `auth.login` in [src/hooks/use-auth.ts](src/hooks/use-auth.ts) (onAuthStateChange SIGNED_IN)
  - `auth.logout` in [src/hooks/use-auth.ts](src/hooks/use-auth.ts) (signOut callback)
  - `central.linked` in [src/components/CentralIntegration.tsx](src/components/CentralIntegration.tsx) (connect success)
  - `central.synced` in [src/hooks/use-central.ts](src/hooks/use-central.ts) (refreshTenants/refreshFirewalls success)
  - `team.invited` in [src/components/InviteStaff.tsx](src/components/InviteStaff.tsx)
  - `team.removed` -- add call where team members are removed
  - `report.deleted` in [src/components/SavedReportsLibrary.tsx](src/components/SavedReportsLibrary.tsx)

### 2D. Data Governance

- Add a "How we handle your data" section in the Management Drawer Settings tab ([src/components/ManagementDrawer.tsx](src/components/ManagementDrawer.tsx)): data residency, AI data flow, anonymisation explanation
- Add a "Delete all my data" button in Settings that calls cascading deletes on `assessments`, `saved_reports`, `audit_log`, `central_credentials`, `central_tenants`, `central_firewalls` for the org
- Document AI data flow: "Config anonymised (IPs, names replaced) -> Google Gemini -> report text. No raw config stored."

### 2E. Methodology Documentation

- Add a "How scoring works" help modal accessible from `RiskScoreDashboard` and `SophosBestPractice`: explains 8 categories, severity logic, compliance mapping approach
- Can be a static markdown rendered in a dialog

---

## Phase 3: Code Quality and Resilience (Day 5-7)

### 3A. TypeScript Strictness

- Enable `strictNullChecks: true` in [tsconfig.app.json](tsconfig.app.json) and fix resulting type errors (estimated 1-2 hours)
- Enable `noUnusedLocals: true` and `noUnusedParameters: true`

### 3B. Test Coverage

- Add `coverage: { provider: "v8", reporter: ["text", "html"] }` to vitest config
- Add tests for [src/lib/risk-score.ts](src/lib/risk-score.ts): score calculation, grade assignment, edge cases
- Add tests for [src/lib/compliance-map.ts](src/lib/compliance-map.ts): control checks, framework mapping
- Add tests for [src/lib/sophos-licence.ts](src/lib/sophos-licence.ts): best practice scoring
- Add parser edge case fixtures: empty config, no rules, malformed HTML, non-Sophos HTML
- Target: 60% coverage on `src/lib/`

### 3C. File Splitting

- Split [src/components/SecurityDashboards.tsx](src/components/SecurityDashboards.tsx) (1012 lines) into `src/components/security-dashboards/` with one file per component (`SeverityBreakdown.tsx`, `SecurityFeatureCoverage.tsx`, `ZoneTrafficFlow.tsx`, `TopFindings.tsx`, `RuleHealthOverview.tsx`, `FindingsBySection.tsx`)
- Extract `StatCard` from [src/components/EstateOverview.tsx](src/components/EstateOverview.tsx) to `src/components/ui/StatCard.tsx`

### 3D. Silent Error Handling

- Replace bare `catch { }` blocks with `catch { console.warn(...) }` in development across `use-central.ts`, `AppHeader.tsx`, `SetupWizard.tsx`, `CentralEnrichment.tsx`
- Surface Supabase save failures to the user via toast: "Couldn't save to cloud -- saved locally as backup"

---

## Phase 4: Feature Improvements to Existing Screens (Day 8-12)

### 4A. Overview Tab Improvements

- **Top 3 Priority Actions card**: Pull the top 3 "Quick Wins" (high impact, low effort) from the Priority Matrix data and display as a card above EstateOverview with action titles and one-click "Show me" that navigates to the finding
- **Security Analysis summary row**: Add 4 stat cards at the top of the Security Analysis tab (Score, Critical Findings, Coverage %, Rules Analysed) before the existing widgets

### 4B. Compliance Improvements

- **Heatmap CSV export**: Add an "Export CSV" button to [src/components/ComplianceHeatmap.tsx](src/components/ComplianceHeatmap.tsx) that exports the control x framework matrix as a spreadsheet
- **Gaps Only filter**: Add a toggle that hides Pass/N/A controls, showing only Partial and Fail
- **Per-framework score**: Show percentage passing as a badge on each framework column header (ties into Phase 2B work)

### 4C. Config Diff Improvements

- **Side-by-side scores**: Show risk scores and grades for both configs at the top of [src/components/ConfigDiff.tsx](src/components/ConfigDiff.tsx)
- **Findings delta**: Below the score comparison, show: new findings, fixed findings, and unchanged findings between the two configs

### 4D. AI Chat Improvements

- **Contextual suggestions**: In [src/components/AIChatPanel.tsx](src/components/AIChatPanel.tsx), read the current `analysisTab` and show tab-specific suggested questions
- **"Explain this finding" button**: Add a button on each finding card in `EstateOverview.tsx` that opens the AI chat pre-populated with "Explain finding: [title] and how to fix it on a Sophos XGS"
- **One-click executive summary**: Add a "Generate Summary" button that calls the AI with a short prompt to produce a 3-paragraph plain-English summary

### 4E. Zone Traffic Flow

- **Simplified view toggle**: Add a "Problems only" toggle to [src/components/SecurityDashboards.tsx](src/components/SecurityDashboards.tsx) `ZoneTrafficFlow` that filters to only show flows missing WF/IPS

### 4F. Remediation Improvements

- **Persistent tracking**: Add a Supabase table `remediation_status` (org_id, assessment_id, playbook_id, completed_by, completed_at). Save "Mark as done" state to cloud.
- **Score projection link**: On each playbook card, show what the score would be if this playbook's findings were resolved (reuse ScoreSimulator logic)

### 4G. Attack Surface Improvements

- **Change detection**: When comparing two configs, highlight new DNAT/port-forwarding exposures in red on the attack surface map

### 4H. Reports

- **Executive one-pager**: Add a "One-Page Summary" export option that generates a single-page PDF with: score, grade, top 5 risks, and recommended next steps
- **Branded cover page**: Add a cover page to DOCX/PDF exports with MSP logo (from branding), customer name, date, and the disclaimer text

### 4I. MSP Dashboard

- **Score trend sparklines**: On the tenant dashboard customer rows, show a mini sparkline of historical scores (requires assessment history data)

---

## Phase 5: New Features -- Medium Effort (Week 2-3)

### 5A. Findings History and Regression Detection

- Create a new Supabase table `finding_snapshots` (org_id, firewall_hash, findings_json, score, created_at)
- When a config is analysed, save findings snapshot keyed by config hash/hostname
- On re-assessment, diff current findings against previous snapshot:
  - **New**: findings in current but not previous
  - **Fixed**: findings in previous but not current
  - **Regressed**: findings that were fixed in a previous assessment but are back
- Display as a "Changes since last assessment" card on the Overview tab

### 5B. Risk Register Export

- Add a "Export Risk Register" button that generates an Excel/CSV with columns: Risk ID, Description, Severity, Likelihood, Impact, Current Controls, Recommended Controls, Owner (blank), Due Date (blank), Status
- Map finding severities to likelihood/impact ratings
- Available from the Overview tab and Remediation tab

### 5C. Fleet-Wide Estate Heatmap

- Add a new component in the MSP Dashboard (Management Drawer) showing all firewalls across all customers in a grid, colour-coded by grade
- Outlier detection: aggregate findings across estate, surface common issues ("5 of 12 firewalls have admin console on WAN")

### 5D. Customer-Facing Report Portal

- Create a new Supabase table `shared_reports` (id, report_id, share_token, expires_at, created_by)
- "Share Report" button generates a time-limited URL (7-day default)
- New public route `/shared/:token` renders the report read-only with no auth
- Supabase edge function validates token and expiry

### 5E. Email/Webhook Alerting

- Create a Supabase table `alert_rules` (org_id, event_type, channel, config)
- Event types: licence_expiry_warning, score_drop, new_critical_finding, central_disconnected
- Channels: email (via Supabase edge function + Resend/SendGrid), webhook (POST to URL)
- Settings UI in Management Drawer

---

## Phase 6: New Features -- Large Effort (Week 4+)

### 6A. Scheduled Assessments

- Requires a mechanism to re-ingest configs periodically. Two approaches:
  - **Push**: MSP uploads new config manually but gets prompted ("It's been 30 days since last assessment")
  - **Pull**: If Sophos Central ever exposes config export API, automate retrieval
- Add assessment scheduling UI: set frequency per customer, track due dates
- Score trend charts with historical data

### 6B. Cyber Insurance Readiness

- New module mapping findings to common insurance questionnaire questions
- Questions: MFA enabled?, Firewall monitored 24/7?, SSL inspection active?, IPS enabled?, Admin access restricted?
- Readiness score (% of questions answerable with "yes")
- Export as a pre-filled insurance questionnaire PDF

### 6C. Policy Baseline Templates

- Allow MSPs to define a "gold standard" config template (which controls must be enabled, score thresholds per category)
- Score each firewall against the template
- Show delta between current config and the template
- Pre-built templates: "Sophos Best Practice", "Cyber Essentials Minimum", "PCI DSS Baseline"

### 6D. REST API

- Supabase edge functions exposing:
  - `GET /api/assessments` -- list assessments for an org
  - `GET /api/assessments/:id` -- get assessment detail with scores and findings
  - `GET /api/firewalls` -- list analysed firewalls with current scores
- API key auth (stored in `central_credentials` or new table)
- Documented with OpenAPI spec

### 6E. Attack Surface Geo-IP and CVE Correlation

- Use external IP addresses from Central to pin services on a world map (Leaflet or Mapbox)
- For known exposed services (RDP, SSH, HTTP), query a public CVE feed and show relevant recent CVEs

### 6F. Offline/Air-Gapped Mode

- Add a "Local Mode" toggle that disables Supabase auth, AI reports, and Central integration
- All analysis runs client-side (already does)
- Reports use pre-built templates instead of AI
- Everything saved to IndexedDB only

### 6G. Change Approval Workflow

- Technician creates a remediation plan from playbooks
- Plan is saved and assigned to a manager/client for approval
- Approval/rejection logged in audit trail
- Post-approval, re-assessment validates changes

### 6H. AI Chat Persistence and Conversation History

- Save chat messages to Supabase keyed by assessment
- Load previous conversations when reopening an assessment
- Ties into the saved reports/assessment system

