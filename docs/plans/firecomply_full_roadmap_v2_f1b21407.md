---
name: FireComply Full Roadmap v2
overview: A massive features-focused roadmap for Sophos FireComply covering MSP dashboards, 15+ new widgets, enhanced client portal with self-service, fleet management, bulk operations, reporting upgrades, compliance tools, PSA/ITSM integrations, Sophos Central dashboard mirroring, analysis engine expansion, and advanced MSP workflows.
todos:
  - id: tenant-health-dashboard
    content: "Tenant Health Dashboard (A1-A7): MSP landing page with fleet KPIs, risk heatmap, declining-score alerts, SLA breach summary, most common findings, agent status timeline, fleet export, NOC mode"
    status: completed
  - id: new-widgets-overview
    content: "Overview Tab Widgets (B1-B10): Score dial gauge, findings-by-age, remediation velocity, SLA gauge, alert feed, quick actions, assessment countdown, risk summary cards, finding severity trend, score delta banner"
    status: completed
  - id: new-widgets-security
    content: "Security Tab Widgets (B11-B22): Coverage matrix, category trends, risk distribution, rule efficiency, category score bars, finding heatmap, encryption overview, protocol distribution treemap, admin exposure map, VPN security summary, network zone security map, service usage chart"
    status: completed
  - id: new-widgets-compliance
    content: "Compliance Tab Widgets (B23-B28): Compliance posture ring, framework coverage bars, compliance gap analysis, control-to-finding table, compliance score comparison, compliance timeline"
    status: completed
  - id: new-widgets-optimisation
    content: "Optimisation Tab Widgets (B29-B33): Policy complexity score, unused object detection, rule consolidation opportunities, config size metrics, rule overlap visualiser"
    status: completed
  - id: new-widgets-tools
    content: "Tools Tab Widgets (B34-B38): Cost-of-risk estimator, geographic fleet map, export centre, what-if comparison, security investment ROI calculator"
    status: completed
  - id: new-widgets-remediation
    content: "Remediation Tab Widgets (B39-B43): Remediation roadmap timeline, fix effort breakdown, impact-vs-effort bubble chart, remediation progress tracker, finding dependency graph"
    status: completed
  - id: client-portal
    content: "White-Label Client Portal (C1-C8): Dedicated /portal route, full branding, assessment history, compliance status, findings summary, downloadable reports, client self-service, comment/feedback, request assessment, satisfaction survey"
    status: completed
  - id: fleet-comparison
    content: "Fleet Comparison (D1-D5): Side-by-side firewall comparison, category score diff, finding delta, config divergence, baseline template, fleet standardisation score"
    status: completed
  - id: bulk-operations
    content: "Bulk Operations (E1-E5): Multi-select findings, bulk mark-done/accept-risk/export, bulk report generation, bulk remediation assignment, bulk assessment scheduling"
    status: completed
  - id: reporting-upgrades
    content: "Reporting Upgrades (F1-F8): Charts in PDF/Word, executive dashboard PDF, report comparison, interactive report builder, scheduled report UI, board-level report, technical deep-dive, compliance evidence pack"
    status: completed
  - id: compliance-tools
    content: "Compliance Tools (G1-G5): Custom compliance frameworks, evidence collection, compliance calendar, attestation workflow, regulatory change tracker"
    status: completed
  - id: dashboard-enhancements
    content: "Existing Dashboard Enhancements (H1-H6): Responsive ScoreTrendChart, severity by firewall, enhanced PeerBenchmark, licence expiry alerts, findings drill-down, CategoryScoreBars"
    status: completed
  - id: msp-workflows
    content: "MSP Workflows (I1-I7): Client onboarding wizard, technician assignment, ticket escalation, approval chains, SLA management, client tagging/grouping, activity audit timeline"
    status: completed
  - id: integrations
    content: "Integrations (J1-J7): ConnectWise Manage, Datto Autotask, Jira, ServiceNow, Slack, Microsoft Teams, email digest"
    status: completed
  - id: sophos-features
    content: "Sophos-Specific Features (K2, K4, K8): Threat feed timeline, MDR integration status, firmware upgrade tracker"
    status: completed
  - id: analysis-engine-v2
    content: "Analysis Engine v2 (L2, L6, L7, L8): Certificates, hotspots, application filter policies, interface/VLAN security"
    status: completed
isProject: false
---

# Sophos FireComply -- Full Roadmap v2 (Complete Feature Expansion)

All previous roadmap items (A1-F3) are complete. This roadmap is the full expansion: MSP features, dashboards, widgets, reporting, integrations, Sophos-specific capabilities, analysis depth, and MSP workflows.

---

## A. Tenant Health Dashboard (MSP Command Centre)

Upgrade `TenantDashboard.tsx` into a full MSP command centre and make it the primary landing page.

### A1. Fleet KPI Summary Bar

- **Current**: 4 stats (Customers, Firewalls, Avg Score, At Risk).
- **Add**: Total findings, SLA breaches, agents offline, assessments this week, average days since last assessment, total rules analysed. Use `StatCard` grid.
- **File**: [src/components/TenantDashboard.tsx](src/components/TenantDashboard.tsx)

### A2. Risk Heatmap (Upgraded Fleet Health Map)

- **Current**: Tiny 5x5px tiles.
- **Upgrade**: Larger interactive tiles grouped by customer. Grade letter inside each tile. Hover shows firewall name + score. Click drills down. Zoom controls and legend. Groupable by customer, site, or region.

### A3. Declining Score Alerts

- **Add**: "Declining Firewalls" section flagging any firewall with 5+ point drop. Show delta, sparkline, previous vs current. Link to that firewall's analysis.

### A4. Most Common Findings Across Fleet

- **Add**: "Top 10 Findings" fleet-wide. Show finding title, severity, affected count (e.g. "8 of 12 firewalls"). Expandable to reveal which firewalls. Click finding to view details.

### A5. Fleet Dashboard Export

- **Add**: "Export Fleet Report" (PDF/CSV). Covers all tenant scores, top findings, SLA status, declining firewalls, agent health.

### A6. Agent Status Timeline

- **Add**: Timeline widget showing agent check-ins, failures, and missed heartbeats over the last 7 days. Each agent as a row, time as x-axis, colour-coded dots (green = heartbeat, red = missed, blue = assessment submitted).

### A7. NOC Mode (Full-Screen Dashboard)

- **Add**: "NOC Mode" button that opens a distraction-free full-screen view of fleet health, rotating between risk heatmap, declining firewalls, and SLA status. Auto-refreshes every 60 seconds. Dark theme optimised.

---

## B. New Dashboard Widgets (43 new components across all tabs)

All widgets work from deterministic analysis data -- no AI needed. Each is a self-contained component in `src/components/`.

---

### Overview Tab (B1-B10)

Currently has: PriorityActions, FindingsChanges, EstateOverview, CentralEnrichment, risk register export. Adding 10 widgets.

#### B1. Score Dial Gauge

- `ScoreDialGauge.tsx`
- Large circular speedometer-style gauge (0-100) with grade letter in centre. Needle animated on load. Colour gradient: red -> amber -> green. Below: "Your firewall scores X/100 (Grade B)". When multi-firewall: shows aggregate with mini dials per firewall.
- **Style**: Gauge/dial

#### B2. Findings by Age

- `FindingsByAge.tsx`
- Horizontal stacked bar: < 7 days (blue), 7-30 days (amber), 30-90 days (orange), > 90 days (red). Click a band to filter the findings list. Shows count per band. "5 findings older than 90 days need attention."
- **Style**: Stacked bar chart

#### B3. Remediation Velocity

- `RemediationVelocity.tsx`
- Area chart: findings resolved per week over the last 8 weeks. Gradient fill. Trend arrow (improving/declining). Summary: "Avg 3.2 findings/week". Dotted line showing target velocity.
- **Style**: Area chart with trend

#### B4. SLA Compliance Gauge

- `SlaComplianceGauge.tsx`
- Circular gauge (0-100%): findings resolved within SLA. Inner ring by severity (critical/high/medium/low). Summary: "3 breached, 12 on track, 5 resolved within SLA". Click opens detail drawer.
- **Style**: Circular gauge

#### B5. Alert Feed

- `AlertFeed.tsx`
- Scrollable real-time event feed: score changes, new findings, resolved findings, agent failures, licence expiry warnings. Each entry: icon + timestamp + message. Filter pills: All, Findings, Agents, Licences. Max 50 items. Auto-refresh.
- **Style**: Timeline/activity feed

#### B6. Quick Action Cards

- `QuickActions.tsx`
- Row of action cards: "Generate Report", "Export Risk Register", "Export Findings CSV", "Compare Configs", "View Remediation". Each card: icon + label + description. One-click triggers action.
- **Style**: Stat cards with actions

#### B7. Assessment Countdown

- `AssessmentCountdown.tsx`
- Per-firewall countdown: days until next scheduled assessment. Colour-coded: green (> 7d), amber (3-7d), red (overdue). "Run Now" button. Shows last assessment date.
- **Style**: Stat cards with countdown

#### B8. Risk Summary Cards

- `RiskSummaryCards.tsx`
- 6-card grid: Overall Score (gauge), Critical Findings (count), High Findings (count), Coverage % (bar), Rules Analysed (count), Sections Parsed (count). Each card with trend arrow vs previous assessment. Colour-coded by threshold.
- **Style**: Stat cards with trend arrows

#### ~~B9. Finding Severity Trend~~ — REMOVED (finding_snapshots doesn't store severities)

#### B10. Score Delta Banner

- `ScoreDeltaBanner.tsx`
- Full-width banner at top: "Score improved by +12 points since last assessment" (green up arrow) or "Score dropped by -8 points" (red down arrow). Shows before/after scores and grade change. Disappears if no previous assessment.
- **Style**: Banner with comparison

---

### Security Tab (B11-B22)

Currently has: 4 stat cards, RiskScoreDashboard, RuleHealthOverview, SecurityFeatureCoverage, SeverityBreakdown, FindingsBySection, ZoneTrafficFlow, TopFindings, PriorityMatrix. Adding 12 widgets.

#### B11. Firewall Coverage Matrix

- `CoverageMatrix.tsx`
- Heatmap table: firewalls as rows, security features as columns (Web Filter, IPS, App Control, SSL/TLS, ATP, DoS, Logging, MFA). Green = enabled, amber = partial, red = missing. Hover shows detail. Row click drills to that firewall.
- **Style**: Heatmap/matrix

#### B12. Category Trend Sparklines

- `CategoryTrends.tsx`
- All 9 risk categories listed vertically with: category name, current score, sparkline (last 5 assessments), trend arrow. Click a category to scroll to its findings below. Compact, information-dense.
- **Style**: Sparkline table

#### B13. Risk Distribution Histogram

- `RiskDistribution.tsx`
- Histogram: firewall scores grouped into bins (0-20, 20-40, 40-60, 60-80, 80-100). Shows where the fleet clusters. Overlay: your firewall highlighted. Good for seeing outliers.
- **Style**: Bar chart/histogram

#### B14. Category Score Bars

- `CategoryScoreBars.tsx`
- Horizontal bar chart of all 9 risk categories. Full-width bars with score percentage. Colour-coded: red < 40, amber 40-75, green > 75. Click a bar to filter findings to that category. Grade letter at end of each bar.
- **Style**: Horizontal bar chart

#### B15. Finding Heatmap by Day

- `FindingHeatmapTime.tsx`
- GitHub-style contribution grid: findings detected per day over the last 90 days. Rows = days of week, columns = weeks. Darker green = more findings resolved, darker red = more new findings. Hover shows date, count, and titles.
- **Style**: Heatmap grid

#### B16. Encryption Strength Overview

- `EncryptionOverview.tsx`
- Visual summary of encryption across the config: VPN ciphers (AES-256 vs weaker), SSL/TLS versions, DH groups, certificate key lengths. Donut chart: % strong vs weak vs missing. Table below with details. Flags any DES, 3DES, RC4, SHA-1.
- **Style**: Donut chart + table

#### B17. Protocol Distribution Treemap

- `ProtocolDistribution.tsx`
- Treemap showing services/protocols used across all rules. Larger rectangles = more rules using that service. Colour: green = secured (with IPS + web filter), amber = partially secured, red = unsecured. Hover shows rule count and security coverage.
- **Style**: Treemap

#### B18. Admin Access Exposure Map

- `AdminExposureMap.tsx`
- Visual showing which management services (HTTPS admin, SSH, SNMP, API) are accessible from which zones. Zone circles connected to service icons. Red connections = exposed to WAN/untrusted. Green = internal only. Based on Local Service ACL findings.
- **Style**: Network diagram/map

#### B19. VPN Security Summary

- `VpnSecuritySummary.tsx`
- Dashboard card: total VPN tunnels (IPSec + SSL), active vs inactive, security grade per tunnel (based on cipher strength, PFS, DH group). Mini bar chart of cipher distribution. Flags: weak tunnels, PSK authentication, missing PFS.
- **Style**: Stat card + mini charts

#### B20. Network Zone Security Map

- `NetworkZoneMap.tsx`
- Interactive diagram of all firewall zones (LAN, WAN, DMZ, Guest, VPN, etc.) as circles. Lines between zones represent rules. Line thickness = rule count. Colour = security level (green = filtered, red = broad ANY-ANY). Click a zone to see its rules and findings.
- **Style**: Network topology diagram

#### B21. Service Usage Chart

- `ServiceUsage.tsx`
- Bar chart: most-used services across all rules (HTTP, HTTPS, DNS, SMTP, RDP, SSH, etc.). Shows count of rules per service. Highlight services without IPS coverage. "RDP is used in 5 rules but only 2 have IPS enabled."
- **Style**: Horizontal bar chart

#### B22. Rule Action Distribution

- `RuleActionDistribution.tsx`
- Donut chart: Accept vs Drop vs Reject rules. Breakout by zone pair (WAN->LAN, LAN->WAN, etc.). Shows percentage. "78% of WAN-to-LAN rules are Accept." Table below showing action by zone pair.
- **Style**: Donut chart + table

---

### Compliance Tab (B23-B28)

Currently has: ComplianceHeatmap, SophosBestPractice, PeerBenchmark, InsuranceReadiness. Adding 6 widgets.

#### B23. Compliance Posture Ring

- `CompliancePostureRing.tsx`
- Large donut chart per selected framework: % pass (green), % partial (amber), % fail (red). Dropdown to switch framework. Centre shows: "72% Compliant". Below: counts of pass/partial/fail controls.
- **Style**: Donut chart

#### B24. Framework Coverage Bars

- `FrameworkCoverageBars.tsx`
- All selected frameworks as horizontal bars. Each bar shows pass % (green fill). Bars sorted by coverage descending. "Cyber Essentials: 85%, GDPR: 72%, PCI DSS: 58%". Click a bar to jump to that framework in the heatmap.
- **Style**: Horizontal bar chart

#### B25. Compliance Gap Analysis

- `ComplianceGapAnalysis.tsx`
- Table: failed/partial controls across all frameworks. Columns: Control ID, Control Name, Framework, Status, Linked Findings, Remediation Effort. Sortable by severity. "12 controls need attention across 3 frameworks." Export to CSV.
- **Style**: Interactive table

#### B26. Control-to-Finding Mapping Table

- `ControlFindingMap.tsx`
- Expandable table: each compliance control as a row, expand to see which findings map to it. Shows: control status (pass/fail/partial), finding titles, severities. Grouped by framework. Filter by status.
- **Style**: Expandable table

#### ~~B27. Compliance Score Comparison~~ — REMOVED (no historical compliance scores stored)

#### ~~B28. Compliance Timeline~~ — REMOVED (no historical compliance scores stored)

---

### Optimisation Tab (B29-B33)

Currently has: RuleOptimiser, ConsistencyChecker. Adding 5 widgets.

#### B29. Policy Complexity Score

- `PolicyComplexity.tsx`
- Single-number gauge: complexity score (0-100). Factors: total rules, rule depth (nested groups), overlapping rules, disabled rules %, ANY usage. "Complexity: 67/100 (Moderate)". Recommendations: "Consolidate 8 overlapping rules to reduce complexity by 15%."
- **Style**: Gauge + recommendations

#### B30. Unused Object Detection

- `UnusedObjects.tsx`
- Lists: network objects, service objects, and host groups that are defined but not referenced in any rule. "14 unused network objects found." Each item shows name, type, and "Safe to remove?" indicator. Bulk select for cleanup report.
- **Style**: Interactive table with bulk actions

#### B31. Rule Consolidation Opportunities

- `RuleConsolidation.tsx`
- Cards showing groups of rules that could be merged: same source, same destination, different services (or vice versa). "Rules 5, 8, 12 could be merged into 1 rule." Shows before/after rule count. Estimated complexity reduction percentage.
- **Style**: Cards with before/after comparison

#### B32. Config Size Metrics

- `ConfigSizeMetrics.tsx`
- Stats: total sections, total rows, total objects, config complexity score. Comparison: "Your config is larger than 70% of similar deployments." Treemap showing which config sections are largest (Firewall Rules, NAT, Objects, etc.).
- **Style**: Stat cards + treemap

#### B33. Rule Overlap Visualiser

- `RuleOverlapVis.tsx`
- Venn-diagram-style or matrix showing which rules overlap with which. Click an overlap to see the two rules side by side. Shows: source overlap, destination overlap, service overlap. Colour intensity = degree of overlap.
- **Style**: Matrix/Venn diagram

---

### Tools Tab (B34-B38)

Currently has: RiskScoreDashboard (projected), ScoreSimulator, AttackSurfaceMap. Adding 5 widgets.

#### B34. Cost of Risk Estimator

- `CostOfRiskEstimator.tsx`
- Estimates potential breach cost based on findings. Inputs: industry, company size, data sensitivity. Shows: "Estimated annual risk exposure: $45,000-$120,000." Breakdown by finding severity. "Resolving 3 critical findings could reduce exposure by $35,000." Based on Ponemon/IBM breach cost data.
- **Style**: Calculator with stat cards

#### B35. Geographic Fleet Map

- `GeographicFleetMap.tsx`
- World map with pins at firewall locations (from external IP geolocation via `geo-cve.ts`). Pin colour by grade (green/amber/red). Click pin to see firewall details (score, findings, firmware). Cluster nearby firewalls. Zoom controls.
- **Style**: Map

#### B36. Export Centre

- `ExportCentre.tsx`
- One-stop panel for all export options: Risk Register (CSV/Excel), Findings (CSV/PDF), Compliance Report (PDF), Executive Summary (PDF), Full Technical Report (PDF), Config Snapshot (JSON). Each with format selector and "Download" button. Batch export option.
- **Style**: Card grid with actions

#### B37. What-If Comparison

- `WhatIfComparison.tsx`
- Side-by-side: current config analysis vs simulated "what if" scenario. Pick findings to resolve from a checklist. Left column shows current scores, right shows projected scores with those findings removed. Delta indicators per category.
- **Style**: Before/after comparison

#### B38. Security Investment ROI Calculator

- `SecurityRoiCalculator.tsx`
- Input: hours to remediate (per finding or bulk), hourly rate, potential breach cost. Output: ROI of remediation. "Investing 40 hours ($4,000) in remediation reduces estimated risk exposure by $80,000. ROI: 20x." Chart showing diminishing returns curve.
- **Style**: Calculator with chart

---

### Remediation Tab (B39-B43)

Currently has: RemediationPlaybooks, ChangeApproval. Adding 5 widgets.

#### B39. Remediation Roadmap Timeline

- `RemediationRoadmap.tsx`
- Horizontal timeline (Gantt-style): findings ordered by priority (critical first). Each bar shows estimated remediation time. SLA deadline markers. Colour by severity. Drag to reorder priority. "Week 1: 3 critical fixes. Week 2: 5 high fixes."
- **Style**: Gantt/timeline chart

#### B40. Fix Effort Breakdown

- `FixEffortBreakdown.tsx`
- Donut chart: total estimated remediation hours broken down by severity. "Critical: 8 hrs, High: 12 hrs, Medium: 6 hrs, Low: 4 hrs. Total: 30 hrs." Below: per-finding effort table (from playbook `estimatedMinutes`).
- **Style**: Donut chart + table

#### B41. Impact vs Effort Bubble Chart

- `ImpactEffortBubble.tsx`
- Scatter plot: X = effort (estimated minutes), Y = score impact (points gained). Bubble size = severity. Colour = severity. Quadrants: "Quick wins" (low effort, high impact), "Strategic" (high effort, high impact), etc. Similar to PriorityMatrix but with actual effort data from playbooks.
- **Style**: Bubble/scatter chart

#### B42. Remediation Progress Tracker

- `RemediationProgress.tsx`
- Horizontal progress bars per category: "Web Filtering: 3 of 5 fixed", "IPS: 1 of 3 fixed", etc. Overall bar at top. Percentage complete. Estimated hours remaining. Shows velocity: "At current pace, all findings will be resolved in 3 weeks."
- **Style**: Progress bars with stats

#### ~~B43. Finding Dependency Graph~~ — REMOVED (no dependency model exists between findings)

---

## C. White-Label Client Portal (Full Self-Service)

### C1. Dedicated Portal Route

- `/portal/:tenantId` route in `src/App.tsx`. Lightweight layout. `src/pages/ClientPortal.tsx`.

### C2. Full Branding

- MSP logo, custom accent colour, company name. Custom favicon and page title. Dark/light theme inherits MSP preference.

### C3. Assessment History and Score Trends

- Full assessment table with pagination. Score trend chart with category drill-down. Date range filter. Export history as CSV.

### C4. Findings Summary with Severity Breakdown

- Latest findings grouped by severity. Finding title, section, remediation status. Read-only. Severity filter toggles.

### C5. Downloadable Reports

- List of all generated reports. Download PDF/Word. Share link generation.

### C6. Client Self-Service: Request Assessment

- "Request Assessment" button. Sends notification to the MSP admin. Shows status: "Requested", "In Progress", "Complete". Stored in `assessment_requests` table.

### C7. Client Comments and Feedback

- Per-finding comment thread. Client can add notes like "We have a business justification for this" or "Please prioritise this". MSP admin sees comments in their view. Stored per-org-per-finding.

### C8. Client Satisfaction Survey

- After each assessment, optional 1-5 star rating and text feedback. "How satisfied are you with this assessment?" Results visible in MSP dashboard. Helps MSPs track service quality.

---

## D. Fleet Comparison and Standardisation

### D1. Side-by-Side Firewall Comparison

- `src/components/FleetComparison.tsx`. Two dropdowns to pick firewalls. Dual-column layout: scores, grades, category scores.

### D2. Category Score Diff

- Delta indicators per category. Highlight where one firewall is significantly weaker.

### D3. Finding Delta

- "Only in Firewall A" and "Only in Firewall B" lists. Configuration inconsistency detection.

### D4. Baseline Template

- Create a "golden config" baseline from a well-configured firewall. Compare other firewalls against the baseline. Show compliance percentage. "Firewall X is 85% aligned with your baseline".
- `src/lib/config-baseline.ts`, `src/components/BaselineManager.tsx`

### D5. Fleet Standardisation Score

- Aggregate metric showing how consistent configs are across the fleet. 100% = all firewalls match. Shows which categories have the most variance. "IPS policies vary across 6 firewalls".

---

## E. Bulk Operations

### E1. Multi-Select in Findings Lists

- Checkbox column in RemediationPlaybooks, FindingsBySection, TopFindings. "Select all" header checkbox. Selected count badge.

### E2. Bulk Actions Toolbar

- Sticky bottom bar when items selected: "Mark X as done", "Accept risk for X", "Export X (CSV)", "Assign to technician", "Clear selection".

### E3. Bulk Report Generation

- "Generate reports for all firewalls" button. Sequential generation with progress bar. ZIP download when complete.

### E4. Bulk Remediation Assignment

- Assign selected findings to a team member (dropdown of org members). Assignee receives notification. Finding shows assignee badge. Filter by "Assigned to me".

### E5. Bulk Assessment Scheduling

- Select multiple firewalls from the fleet list. "Schedule assessment for all selected" -- pick frequency and time. Applies to all connector agents managing those firewalls.

---

## F. Reporting Upgrades (8 report types)

### F1. Charts in PDF and Word Exports

- Render radar chart, category bars, severity breakdown as SVG/PNG. Embed in PDF HTML and Word docx.
- **Files**: `src/lib/report-export.ts`, `src/components/DocumentPreview.tsx`

### F2. Executive Dashboard PDF

- Cover page -> Score gauge -> Category bars -> Top 5 findings -> Compliance summary -> Remediation progress -> Score trend -> Confidentiality footer.

### F3. Report Comparison View

- `src/components/ReportComparison.tsx`. Select two assessments. Shows score delta, new/resolved/unchanged findings. Category-level changes.

### F4. Interactive Report Builder

- `src/components/ReportBuilder.tsx`. Checkbox sidebar of sections. Live preview. Save as template. Generate PDF with selected sections.

### F5. Scheduled Report UI

- Full UI: report type, frequency, recipients, next run. Preview. Enable/disable toggle.

### F6. Board-Level Report

- Non-technical PDF for board/C-suite: risk summary in business terms, trend over 12 months, peer comparison, top 3 recommendations, investment needed. No technical jargon. Traffic-light indicators.
- `generateBoardReport()` in `report-export.ts`

### F7. Technical Deep-Dive Report

- Per-firewall exhaustive PDF: every finding with full detail, remediation steps, evidence, Sophos console paths, before/after config snippets. Appendix with raw analysis data. For hands-on engineers.
- `generateTechnicalDeepDive()` in `report-export.ts`

### F8. Compliance Evidence Pack

- Per-framework ZIP: cover letter, control mapping table, pass/fail evidence per control, finding details for failed controls, remediation plan for gaps. Ready to hand to an auditor.
- `generateCompliancePack()` in `report-export.ts`

---

## G. Compliance Tools

### G1. Custom Compliance Framework Builder

- `src/components/CustomFrameworkBuilder.tsx`. Create framework (name, description). Add controls. Map findings to controls. Appears in ComplianceHeatmap.
- **Modify**: `src/lib/compliance-map.ts` to accept custom frameworks.

### G2. Evidence Collection Panel

- `src/components/EvidenceCollection.tsx`. Per-control: status, matched findings, "Attach Evidence" (note, URL, file ref). Stored per-org.
- **Tab**: Compliance

### G3. Compliance Calendar

- `src/components/ComplianceCalendar.tsx`. Calendar: assessment due dates, framework review deadlines, cert expiry, licence renewal. Month/week toggle. Urgency colour-coding.
- **Tab**: Compliance or ManagementDrawer Dashboard

### G4. Attestation Workflow

- `src/components/AttestationWorkflow.tsx`. Per-framework: "I attest that these controls have been reviewed as of [date]". Digital signature (name + date). Attestation history. Export attestation certificate PDF.
- **Tab**: Compliance

### G5. Regulatory Change Tracker

- `src/components/RegulatoryTracker.tsx`. Shows recent changes to supported frameworks (CE, GDPR, PCI DSS, etc.). Static content updated periodically. "New PCI DSS v4.0.1 requirements affect X controls". Links to official docs.
- **Tab**: Compliance

---

## H. Existing Dashboard Enhancements

### H1. Responsive ScoreTrendChart with Category Drill-Down

- Make responsive (100% width). Add category selector dropdown. Date range filter. "Export as PNG" button.
- **File**: `src/components/ScoreTrendChart.tsx`

### H2. Severity Breakdown by Firewall

- Toggle: "All Firewalls" vs per-firewall. Grouped bar chart when multi-firewall.
- **File**: `src/components/security-dashboards/SeverityBreakdown.tsx`

### H3. Enhanced PeerBenchmark with Sector Selector

- Sector dropdown. Percentile position ("Top 25% of healthcare"). "vs previous assessment" overlay.
- **File**: `src/components/PeerBenchmark.tsx`

### H4. Licence Expiry Notifications

- Banner alert when licence < 30 days. "Notify me" toggle. "Renew via Sophos Central" link.
- **File**: `src/components/LicenceExpiryWidget.tsx`

### H5. Findings Changes Drill-Down

- Click finding title to scroll to it. Severity badge. "Export changes" CSV button.
- **File**: `src/components/FindingsChanges.tsx`

### H6. Repurposed CategoryScoreBars

- Horizontal bar chart of all 9 categories. Colour by grade. Click to filter findings.
- **File**: `src/components/security-dashboards/CategoryScoreBars.tsx`

---

## I. MSP Workflows

### I1. Client Onboarding Wizard

- `src/components/ClientOnboarding.tsx`. Step-by-step: create tenant -> invite client contact -> register agent -> link Central -> run first assessment -> generate baseline report. Progress tracker. Saves onboarding state.

### I2. Technician Assignment

- Assign findings and firewalls to specific team members. "Assigned to" field on findings. Filter: "My assignments". Workload view: findings per technician.
- **Modify**: `RemediationPlaybooks.tsx`, `FindingsBySection`

### I3. Ticket Escalation Rules

- `src/components/EscalationRules.tsx`. Define rules: "If critical finding is not resolved within SLA, escalate to [manager]". "If score drops below 50, create urgent ticket". Configurable per severity and per customer.

### I4. Approval Chains for Remediation

- Upgrade `ChangeApproval.tsx`. Multi-step approval: Technician proposes -> Team Lead reviews -> Client approves -> Execute. Status badges: Draft, Pending Review, Approved, Rejected, Completed. Email notifications at each step.

### I5. SLA Management Console

- `src/components/SlaManagement.tsx`. Define SLA tiers per customer (Gold: 24hr critical, Silver: 48hr, Bronze: 7 day). Dashboard showing SLA performance per customer. Breach count, average resolution time, SLA compliance trend.

### I6. Client Tagging and Grouping

- Add tags to customers/tenants: "Enterprise", "SMB", "Healthcare", "High Priority", "Pilot". Filter fleet dashboard by tags. Group KPIs by tag. Drag-and-drop tag management.

### I7. Activity Audit Timeline

- `src/components/ActivityTimeline.tsx`. Chronological feed of all actions: who ran what assessment, who generated what report, who approved what remediation, who invited what user. Filterable by user, action type, date. Uses existing `audit_log` table.

---

## J. Integrations

### J1. ConnectWise Manage

- `src/lib/connectwise.ts`, `src/components/ConnectWiseIntegration.tsx`.
- OAuth setup in ManagementDrawer Settings. Auto-create tickets for critical/high findings. Map severity to priority. Sync ticket status back (closed = resolved). Map customers to CW companies.

### J2. Datto Autotask

- `src/lib/autotask.ts`, `src/components/AutotaskIntegration.tsx`.
- API key setup. Similar ticket creation as ConnectWise. Map to Autotask accounts and ticket categories.

### J3. Jira

- `src/lib/jira.ts`, `src/components/JiraIntegration.tsx`.
- OAuth or API token. Create issues in a configured project. Map severity to priority. Attach finding details and remediation steps. Sync status.

### J4. ServiceNow

- `src/lib/servicenow.ts`, `src/components/ServiceNowIntegration.tsx`.
- Instance URL + OAuth. Create incidents. Map to assignment groups and categories. Attach risk score data.

### J5. Slack

- `src/lib/slack-notify.ts`. Incoming webhook URL. Format: rich block message with score, findings count, trend arrow. Channel per customer or single channel. Triggered on: assessment complete, score drop, SLA breach.

### J6. Microsoft Teams

- `src/lib/teams-notify.ts`. Power Automate webhook or Graph API. Adaptive Card format. Same triggers as Slack.

### J7. Email Digest

- `src/components/EmailDigestSettings.tsx`. Weekly or monthly email summary: fleet health, top findings, score changes, SLA status, upcoming licence expiries. Configurable recipients. HTML email template.

---

## K. Sophos-Specific Features (3 items -- blocked items removed)

Removed: K1 Central Dashboard Mirror (endpoint counts not in API), K3 Endpoint-to-Firewall Correlation (no endpoint data), K5 Firewall Health Telemetry (not exposed by Central API), K6 Central Alert Rules Mirror (can't fetch alert rules), K7 Live Config Pull (no config export API).

### K2. Threat Feed Timeline

- `src/components/ThreatFeedTimeline.tsx`. Show Sophos X-Ops threat intelligence events: recent CVEs affecting Sophos products, threat advisories, campaign alerts. Pull from Central alerts API. Scrollable timeline with severity indicators.
- **Tab**: Security

### K4. MDR Integration Status

- `src/components/MdrStatus.tsx`. Show MDR (Managed Detection and Response) status derived from firewall config sections (MDR agent presence, heartbeat protocol settings). Indicates whether MDR is configured on each firewall.
- **Tab**: Overview

### K8. Firmware Upgrade Tracker

- `src/components/FirmwareTracker.tsx`. Show current firmware for each firewall (from Central firewalls API data already fetched). Compare against latest available version. Flag: "5 firewalls on v20.0 -- v21.0 MR3 is available". Link to Sophos release notes. Track upgrade history.
- **Tab**: Overview or Settings

---

## L. Analysis Engine v2 (4 items -- blocked items removed)

Removed: L1 SD-WAN (no HTML section), L3 DHCP Security (no HTML section), L4 DNS-over-HTTPS/TLS (no HTML section), L5 Log Retention (no HTML section).

### L2. Certificate Management Analysis

- `analyseCertificates()`. Flag RSA < 2048-bit, SHA-1, expiring within 30/60/90 days, untrusted CAs. Certificate section confirmed present in HTML export.

### L6. Hotspot and Captive Portal Analysis

- `analyseHotspots()`. Flag open hotspots, no captive portal, no terms acceptance, HTTP-only portals. Hotspot section confirmed present in HTML export.

### L7. Application Filter Policy Analysis

- `analyseAppFilterPolicies()`. Flag policies allowing high-risk categories: file sharing, remote access, crypto mining, anonymisers. App Filter section confirmed present in HTML export.

### L8. Interface and VLAN Security

- `analyseInterfaceSecurity()`. Flag interfaces without zone assignment, VLANs without inter-VLAN filtering, trunk ports with native VLAN misconfig. Interface/VLAN sections confirmed present in HTML export.

---

**All files referenced**: `src/lib/analyse-config.ts`, `src/components/TenantDashboard.tsx`, `src/components/AnalysisTabs.tsx`, `src/components/ManagementDrawer.tsx`, `src/components/RemediationPlaybooks.tsx`, `src/components/DocumentPreview.tsx`, `src/lib/report-export.ts`, `src/lib/compliance-map.ts`, `src/components/ScoreTrendChart.tsx`, `src/components/PeerBenchmark.tsx`, `src/components/LicenceExpiryWidget.tsx`, `src/components/FindingsChanges.tsx`, `src/components/security-dashboards/CategoryScoreBars.tsx`, `src/components/security-dashboards/SeverityBreakdown.tsx`, `src/App.tsx`, `src/components/ChangeApproval.tsx`, `src/components/ClientPortalView.tsx`, `src/components/UploadSection.tsx`
