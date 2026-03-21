---
name: Interactive Guided Tours
overview: Add 19 interactive guided tours using driver.js covering every major feature — organised into 6 categories in a help menu, context-aware based on what is on screen and whether the user is authenticated.
todos:
  - id: install
    content: Install driver.js dependency
    status: completed
  - id: data-attrs
    content: Add data-tour attributes to target elements across ~20 component files
    status: completed
  - id: tour-defs
    content: Create src/lib/guided-tours.ts with all 19 tour step definitions
    status: completed
  - id: theme-css
    content: Create src/styles/driver-theme.css with Sophos-branded popover styles
    status: completed
  - id: button
    content: Create src/components/GuidedTourButton.tsx with categorised dropdown menu
    status: completed
  - id: wire-up
    content: Mount GuidedTourButton in Index.tsx and import CSS in main.tsx
    status: completed
  - id: test
    content: Test tours in dark and light mode
    status: pending
isProject: false
---

# Interactive Guided Tours

## Approach

Use **driver.js** (`driver.js` v1.x) — lightweight (~5KB gzipped), zero-dependency, element highlighting with animated popovers. Matches the Sophos firewall tour UX. Works imperatively (no React wrapper). Popovers themed to match the Sophos dark/blue brand.

## All 19 Tours

### Category: Getting Started

#### 1. Getting Started

1. **Upload area** — "Drop your Sophos config HTML exports here, or click to browse."
2. **Connected Firewalls** — "Or load configs directly from your connected Sophos Central agents."
3. **Assessment Context** — "Set customer name, environment, and compliance frameworks."
4. **Generate Reports** — "Generate technical reports, executive briefs, and compliance packs."
5. **Management Panel** — "Access saved reports, config history, team settings, and integrations."
6. **Theme toggle** — "Switch between dark and light mode."

### Category: Analysis & Findings

#### 2. Dashboard Guide

1. **Priority Actions** — "Critical and high-severity findings requiring immediate attention."
2. **Stats bar** — "At-a-glance metrics: firewalls, rules, sections, and issues."
3. **Analysis tabs** — "Deep-dive into security, compliance, optimisation, and remediation."
4. **Inspection Posture** — "Web filtering, IPS, and app control coverage across WAN rules."
5. **Export buttons** — "Export findings as CSV risk register or Excel."
6. **AI Chat** — "Ask the AI assistant about your firewall configuration."

#### 3. Risk Score Explained

1. **Score dial** — "Overall risk score 0-100, based on weighted category analysis."
2. **Grade badge** — "Letter grade (A-F). A = 90+, B = 75+, C = 60+, D = 40+, F = below 40."
3. **Category breakdown** — "Rule Hygiene, Inspection Coverage, Access Control, Network Segmentation, Logging, Authentication."
4. **Score simulator** — "Simulate fixing findings to preview score improvements."
5. **Score trend** — "Track score changes over time in the Management Panel."

#### 4. Compliance Mapping

1. **Framework badges** — "Selected frameworks appear as tags. Findings are auto-mapped to controls."
2. **Framework selector** — "NIST 800-53, ISO 27001, CIS, PCI DSS, HIPAA, HITECH, Essential Eight, Cyber Essentials, and more."
3. **Compliance tab** — "Heatmap of control coverage, gaps, and readiness per framework."
4. **Sophos Best Practice** — "Checks against Sophos recommended configuration baseline."
5. **Custom frameworks** — "Build your own framework in Settings with custom controls."

#### 5. Config Comparison

1. **Compare tab** — "Select two firewall configs to compare side-by-side."
2. **Before/After selectors** — "Choose configs from your loaded firewalls."
3. **Compare button** — "Generate a diff showing added, removed, and modified items."
4. **Diff view** — "Green = additions, red = removals, amber = modifications."

#### 6. Remediation Workflow

1. **Remediation tab** — "Step-by-step playbooks to fix each finding on a Sophos XGS firewall."
2. **Remediation playbooks** — "Detailed instructions for each finding with severity and impact."
3. **Change approval** — "Submit remediation plans for approval: draft, pending, approved, or rejected."
4. **Progress tracking** — "Track remediation progress across findings."
5. **Remediation roadmap** — "View the prioritised roadmap of fixes."
6. **Bulk actions** — "Select multiple findings for bulk status updates."

#### 7. Baselines & What-If

1. **Baseline manager** — "Save a snapshot of your current config as a baseline."
2. **Compare to baseline** — "Compare your current analysis against a saved baseline to detect drift."
3. **What-If comparison** — "Model what-if scenarios to evaluate different config approaches."

#### 8. Geographic & Network Maps

1. **Geographic fleet map** — "View your firewalls' external IP addresses and geographic locations."
2. **Attack surface map** — "Visualise your network's attack surface based on firewall rules and exposed services."
3. **Geo attack map** — "World map of external IPs with CVE correlation."
4. **Network zone map** — "Zone-to-zone traffic flow and security level visualisation."

#### 9. Widget Customiser

1. **Customiser button** — "Toggle optional widgets on each analysis tab."
2. **Widget list** — "Enable or disable widgets like Peer Benchmark, Insurance Readiness, Evidence Collection, and more."
3. **Per-tab settings** — "Each tab has its own set of widgets you can show or hide."

### Category: Setup & Integration

#### 10. Connect to Sophos Central

1. **Management Panel button** — "Open the management panel to access settings."
2. **Sophos Central section** — "Connect your Sophos Central account here."
3. **Instructions** (standalone popover) — Sign in to central.sophos.com, go to API Credentials Management, create read-only credential named 'FireComply', copy Client ID and Secret.
4. **Client ID field** — "Paste your Client ID here."
5. **Client Secret field** — "Paste your Client Secret here."
6. **Connect button** — "Click to connect. Credentials are encrypted at rest."

#### 11. Set Up Connector Agent

1. **Management Panel button** — "Open the management panel."
2. **Connector section** — "Connector agents automatically pull firewall configs on schedule."
3. **Register button** — "Register a new agent to get an API key."
4. **Instructions** (standalone popover) — Register agent for API key, download connector for your OS, paste key and add firewall details, agent runs automatically.
5. **Download section** — "Download for Windows, macOS, or Linux."

### Category: Exports & Sharing

#### 12. How to Export

1. **Download All** — "Download all reports as a ZIP (PDF, Word, HTML)."
2. **Download PDF** — "Export the current report as a branded PDF."
3. **Download Word** — "Export as Word for editing."
4. **Share Report** — "Generate a shareable link with optional expiry and download permissions."
5. **Export Risk Register** — "CSV risk register for GRC tools."
6. **Export Excel** — "Full analysis as an Excel spreadsheet."

#### 13. Client Portal

1. **Management Panel button** — "Open the management panel."
2. **Client Portal section** — "Set up a branded portal for customers."
3. **Portal configurator** — "Choose what to show: scores, findings, reports, branding."
4. **Client View preview** — "Preview what your customer will see."
5. **Share link** — "Send the portal link for read-only access."

### Category: Team & Settings

#### 14. Management Panel Overview

1. **Dashboard tab** — "Tenant overview, score trends, licence expiry, assessments."
2. **Reports tab** — "Browse and load saved reports."
3. **History tab** — "Assessment history and config version changes."
4. **Settings tab** — "Central, connectors, team, alerts, webhooks, frameworks, and more."
5. **Activity Log** — "Full audit trail of all actions."

#### 15. Team & Security

1. **Team Management** — "Invite team members by email and assign roles."
2. **Roles** (standalone popover) — "Admin: full access. Engineer: assessments + agents. Member: view + generate. Viewer: read-only."
3. **MFA** — "Enable multi-factor authentication."
4. **Passkeys** — "Set up passkeys for passwordless sign-in."

#### 16. Alerts & Notifications

1. **Notification bell** — "In-app notifications appear here. Click to view and manage."
2. **Alert settings** — "Configure email alerts for critical findings, agent offline, config drift, and licence expiry."
3. **Webhook settings** — "Set up a webhook URL to push events to your PSA/RMM/ticketing system."
4. **Teams/Slack** (standalone popover) — "Connect Microsoft Teams or Slack for real-time alert notifications."

#### 17. Scheduling

1. **Assessment scheduler** — "Schedule recurring assessments per customer: 30, 60, or 90 day cycles."
2. **Overdue alerts** — "Get notified when an assessment is overdue."
3. **Scheduled reports** — "Automatically generate and send reports on a weekly, monthly, or quarterly basis."
4. **Report recipients** — "Choose which reports to send and to which recipients."

#### 18. Tenant Dashboard

1. **Customer list** — "View all customers with their latest scores and assessment dates."
2. **Score trends** — "Track score changes over time across your customer base."
3. **Licence expiry** — "Monitor Sophos licence expiry dates and get early warnings."
4. **Drill-down** — "Click a customer to see their detailed assessment history."

### Category: Tips

#### 19. Power User Tips

1. **Keyboard shortcuts button** — "Press ? to see all shortcuts."
2. **Key shortcuts** (standalone popover) — "Ctrl+G = generate all, Ctrl+S = save, 1-9 = switch reports, Ctrl+D = toggle drawer."
3. **Score simulator** — "Simulate fixing findings to see projected improvements."
4. **Attack surface map** — "Visualise your network's attack surface."
5. **Rule optimiser** — "Find redundant, shadowed, and overlapping rules."
6. **Remediation playbooks** — "Step-by-step fix guides for every finding."

## Implementation

### 1. Install driver.js

```bash
npm install driver.js
```

### 2. Add `data-tour` attributes (~20 component files)

Annotate key elements with `data-tour="step-id"`. Target files:

- [src/components/FileUpload.tsx](src/components/FileUpload.tsx) — `upload-zone`
- [src/components/UploadSection.tsx](src/components/UploadSection.tsx) — `step-upload`, `step-context`, `step-reports`
- [src/components/AgentFleetPanel.tsx](src/components/AgentFleetPanel.tsx) — `agent-fleet`
- [src/components/AppHeader.tsx](src/components/AppHeader.tsx) — `management-panel`, `theme-toggle`, `notification-bell`
- [src/components/AnalysisTabs.tsx](src/components/AnalysisTabs.tsx) — `analysis-tabs`, `priority-actions`, `stats-bar`, `export-buttons`, `compare-tab`, `widget-customiser`
- [src/components/CentralIntegration.tsx](src/components/CentralIntegration.tsx) — `central-section`, `central-client-id`, `central-client-secret`, `central-connect-btn`
- [src/components/AgentManager.tsx](src/components/AgentManager.tsx) — `connector-section`, `connector-register`, `connector-download`
- [src/components/ManagementDrawer.tsx](src/components/ManagementDrawer.tsx) — `drawer-tab-{id}`, `drawer-audit`, `drawer-portal`, `drawer-team`, `drawer-mfa`, `drawer-passkeys`, `drawer-alerts`, `drawer-webhooks`, `drawer-scheduler`, `drawer-scheduled-reports`, `drawer-custom-frameworks`
- [src/components/DocumentPreview.tsx](src/components/DocumentPreview.tsx) — `export-zip`, `export-pdf`, `export-word`, `share-report`
- [src/components/RiskScoreDashboard.tsx](src/components/RiskScoreDashboard.tsx) — `score-dial`, `score-grade`, `score-categories`
- [src/components/ScoreSimulator.tsx](src/components/ScoreSimulator.tsx) — `score-simulator`
- [src/components/ComplianceHeatmap.tsx](src/components/ComplianceHeatmap.tsx) — `compliance-heatmap`
- [src/components/RuleOptimiser.tsx](src/components/RuleOptimiser.tsx) — `rule-optimiser`
- [src/components/AttackSurfaceMap.tsx](src/components/AttackSurfaceMap.tsx) — `attack-surface`
- [src/components/GeographicFleetMap.tsx](src/components/GeographicFleetMap.tsx) — `fleet-map`
- [src/components/NetworkZoneMap.tsx](src/components/NetworkZoneMap.tsx) — `zone-map`
- [src/components/RemediationPlaybooks.tsx](src/components/RemediationPlaybooks.tsx) — `remediation-playbooks`
- [src/components/ChangeApproval.tsx](src/components/ChangeApproval.tsx) — `change-approval`
- [src/components/BaselineManager.tsx](src/components/BaselineManager.tsx) — `baseline-manager`
- [src/components/TenantDashboard.tsx](src/components/TenantDashboard.tsx) — `tenant-dashboard`, `tenant-list`, `tenant-drill-down`
- [src/components/NotificationCentre.tsx](src/components/NotificationCentre.tsx) — `notification-bell`

### 3. Create tour definitions

New file: `src/lib/guided-tours.ts`

Exports 19 functions. Tours that need the Management Panel accept `{ openDrawer, setDrawerTab }` callbacks. Steps whose target element is absent are filtered at runtime. Standalone popover steps (instructions, role explanations) use `element: undefined` with `popover.align: "center"`.

### 4. Create tour trigger UI

New file: `src/components/GuidedTourButton.tsx`

Floating `HelpCircle` button in bottom-right corner. Opens a Radix `DropdownMenu` with sections:

- **Getting Started** — always visible
- **Analysis & Findings** — visible when `hasFiles` (tours 2-9)
- **Setup & Integration** — visible when `!isGuest` (tours 10-11)
- **Exports & Sharing** — tour 12 visible when `hasReports`, tour 13 when `!isGuest`
- **Team & Settings** — visible when `!isGuest` (tours 14-18)
- **Tips** — always visible (tour 19)

Each section is a `DropdownMenuGroup` with a `DropdownMenuLabel` header and `DropdownMenuSeparator`.

### 5. Theme the popovers

New file: `src/styles/driver-theme.css`

- Dark navy bg (`#001A47`), blue accent border (`#2006F7`), white text
- Step counter: "Stage 1 of 3" style
- Progress dots
- Light mode: white bg, dark text, same blue accent
- Smooth transitions, rounded corners matching app design

Import in [src/main.tsx](src/main.tsx).

### 6. Wire up in Index.tsx

In [src/pages/Index.tsx](src/pages/Index.tsx) (~L869):

- `<GuidedTourButton hasFiles={hasFiles} hasReports={hasReports} isGuest={isGuest} openDrawer={...} setDrawerTab={...} />`
- Expose `setActiveTab` from ManagementDrawer via callback prop

## File Changes Summary

- **New files** (3): `src/lib/guided-tours.ts`, `src/components/GuidedTourButton.tsx`, `src/styles/driver-theme.css`
- **Modified files** (~22): ~20 components for `data-tour` attributes, `Index.tsx` for button mount, `main.tsx` for CSS import
- **Dependency**: `driver.js`

