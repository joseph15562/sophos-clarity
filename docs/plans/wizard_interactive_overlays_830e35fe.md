---
name: Wizard Interactive Overlays
overview: Replace the static text/card walkthrough steps in the setup wizard with clickable feature buttons that open overlay modals showing mock previews of the actual UI panels (risk gauge, radar chart, report viewer, management drawer, etc.).
todos:
  - id: overlay-component
    content: Build FeatureOverlay wrapper and mock UI components (gauge, radar, severity bar, compliance grid, report viewer, etc.)
    status: completed
  - id: pre-ai-overlays
    content: Replace guide-pre-ai step with 4 clickable buttons that open mock overlays
    status: completed
  - id: ai-report-overlays
    content: Replace guide-ai-reports step with 3 clickable buttons that open mock overlays
    status: completed
  - id: management-overlays
    content: Enhance guide-management step with 4 clickable buttons that open mock overlays
    status: completed
isProject: false
---

# Wizard Interactive Overlays

## Approach

In the `guide-pre-ai`, `guide-ai-reports`, and `guide-management` wizard steps, replace the current `GuideStep` cards with **clickable feature buttons**. Clicking a button opens a **full-overlay modal** inside the wizard containing a mock-up of that feature's real UI — styled identically to the actual dashboard panels but with sample data.

## What each overlay shows

### Pre-AI Assessment step — 4 clickable buttons:

- **Risk Score & Grade** — Mock gauge ring (e.g. 54 / Grade D), radar chart outline, category percentages
- **Findings & Severity** — Mock severity breakdown bar (critical/high/medium/low with sample counts)
- **Inspection Posture** — Mock config health stats (33 total, 13 WAN, 2 disabled...) and feature coverage grid (IPS, web filter, app control percentages)
- **Compliance Mapping** — Mock compliance heatmap grid showing framework rows with pass/fail/na cells

### AI Reports step — 3 clickable buttons:

- **Individual Firewall Report** — Mock report viewer with markdown-style content, tab bar, export buttons
- **Executive Summary** — Mock executive report with key metrics cards and recommendation list
- **Compliance Report** — Mock framework-mapped report with control table

### Management Panel step — 4 clickable buttons (already has a good layout, enhance with overlays):

- **Dashboard** — Mock tenant dashboard with customer score cards
- **Reports** — Mock saved reports table
- **History** — Mock assessment trend chart
- **Settings** — Mock settings panel with Central API / Team / Audit sections

## Implementation

All changes go in a single file: `[src/components/SetupWizard.tsx](src/components/SetupWizard.tsx)`

- Add a `FeatureOverlay` component: a modal inside the wizard that renders a mock preview with a title, description, and close button
- Add mock UI components: `MockGauge`, `MockRadar`, `MockSeverityBar`, `MockComplianceGrid`, `MockReportViewer`, etc. — these are lightweight SVG/CSS-only approximations using the same Sophos colour palette
- Replace the `GuideStep` numbered cards with clickable button cards that set `activeOverlay` state
- When `activeOverlay` is set, render the overlay on top of the wizard content
- Keep the existing step navigation (back/next/skip) unchanged

