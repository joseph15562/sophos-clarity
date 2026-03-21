---
name: Zone Traffic Flow Redesign
overview: Redesign the Zone Traffic Flow widget from a confusing bar chart into a clear, interactive network segmentation view that shows *what* traffic is allowed between zones, *how* it's protected, and *where* gaps exist.
todos:
  - id: flow-data-model
    content: Extend ZoneFlow interface with appControl, ruleNames, services; update parsing loop
    status: completed
  - id: zone-summary
    content: Replace zone badge wall with categorised zone summary strip (WAN/LAN/DMZ/VPN/Guest/Other)
    status: completed
  - id: flow-table
    content: "Replace gradient bars with sortable flow table: risk-sorted, protection icons, expandable rows"
    status: completed
  - id: insights-footer
    content: Add auto-generated insight badges summarising security gaps and coverage
    status: completed
isProject: false
---

# Zone Traffic Flow Redesign

## Problem

The current widget dumps all zone names as badges and shows flow counts as bars, but it doesn't communicate:

- **What does each flow mean?** (which rules allow this traffic)
- **Is it a problem?** (is there a security gap)
- **What should I do about it?** (which flows need attention)

## Redesigned Layout

The widget will have three clear sections:

### 1. Zone Summary Strip (replaces the badge wall)

A compact row of zone **categories** with counts, not individual zones:


| Category | Zones | Rules |
| -------- | ----- | ----- |


Zones are classified by type (WAN, LAN, DMZ, VPN, Guest, Other). Clicking a category filters the flows below. This collapses 17+ individual badges into 4-6 meaningful groups.

### 2. Flow Table (replaces the bars)

Replace gradient bars with a clean, scannable table of flows. Each row shows:

- **Source -> Dest** zone labels (full names, no abbreviation)
- **Rules** count
- **Protection icons**: small shield-style indicators for Web Filter, IPS, and App Control coverage (filled = all rules covered, half = partial, empty = none)
- **Coverage %**: a single number showing what % of rules in this flow have all three protections

Rows are **sorted by risk** (unprotected WAN-facing flows first), not just by count. Flows to/from WAN with no protection get a subtle red left-border to draw attention.

Clicking a flow row expands it to show the individual rule names in that flow, with their services and protection status.

### 3. Quick Insights (new)

A small footer section with 2-3 auto-generated insight badges:

- "4 WAN flows missing web filtering" (if applicable)
- "3 internal-only flows (no WAN exposure)"
- "All VPN flows have IPS"

These give an at-a-glance security narrative.

## Data Model Changes

Extend the `ZoneFlow` interface in [SecurityDashboards.tsx](src/components/SecurityDashboards.tsx) to also capture:

- `hasAppControl: number` (already parsed in analyse-config)
- `action: string` (Accept/Drop — to distinguish allow vs deny rules)
- `ruleNames: string[]` (for the expandable detail)
- `services: string[]` (for the expandable detail)

All data is already available in the parsed firewall rule rows.

## File Changes

All changes are in a single file: [src/components/SecurityDashboards.tsx](src/components/SecurityDashboards.tsx), specifically the `ZoneTrafficFlow` component (lines 129-297).

No new dependencies or files needed.