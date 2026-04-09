# Walkthrough: Fleet Command

Fleet Command is your operational view of every firewall across every customer. Think of it as your network operations centre for Sophos firewall posture.

## What You See

### Stats Row

The top strip shows portfolio-wide KPIs at a glance:

| Stat              | What it shows                                           |
| ----------------- | ------------------------------------------------------- |
| Total firewalls   | Count of all devices in your fleet                      |
| Average score     | Mean best-practice score across the fleet + fleet grade |
| Critical findings | Total critical-severity findings across all devices     |
| Licence alerts    | Count of offline + stale devices needing attention      |
| Customer sites    | Distinct customer/tenant groups                         |

### Fleet List (Primary Tab)

Firewalls are grouped by customer (Sophos Central tenant or Connector Agent customer bucket). Each group header shows:

- Customer name
- Firewall count
- Average score for that customer

Each firewall row shows:

- Hostname
- Score (0–100) and grade (A–F)
- Status — **Online**, **Offline**, **Stale**, **Suspended**
- Source — **Central** (from Sophos Central API), **Agent** (from Connector), or **Both**
- Model and firmware version
- Serial number
- Last assessed date
- Config link status (linked to a manual upload or not)
- Critical findings count (badge on row)
- Latest report link (if a saved report exists for this firewall)

### Map Tab

A world map view with pins for every firewall. Pins are positioned using:

1. GPS coordinates you set per firewall (most precise)
2. Sophos Central geo-location data (fallback)
3. Country centroid with a small offset (last resort)

Hover over a pin to see the firewall hostname, customer, score, and status. Useful for demonstrating geographic coverage in QBRs.

## Filters and Search

### Search

Type in the search bar (or press `/` to focus) to filter by hostname, customer name, model, or tenant. The search is debounced and applies instantly.

### Grade Chips

Filter by grade: **All**, **A**, **B**, **C**, **D**, **F**. Quick way to find underperforming firewalls.

### Status Filter

Filter by device status: All, Online, Offline, Suspended, Stale.

### Config Link Filter

- **All** — show everything
- **Linked** — only firewalls with a config upload linked
- **Unlinked** — firewalls discovered via Central but not yet assessed

### Spotlight Filters

- **Needs attention** — devices with critical findings or offline/stale/suspended status
- **Weak scores (C–F)** — devices below grade B

### Sort Options

Sort the fleet by hostname, customer+hostname, score (ascending or descending), or last assessed date.

### Export

Click **Export CSV** to download the filtered fleet as a spreadsheet.

## Firewall Detail Panel

Click any firewall row to expand the detail panel:

### Compliance Context

Set per-firewall jurisdiction for accurate compliance mapping:

- **Country** — the country this firewall operates in
- **US state** — if US, the specific state for state-level regulations
- **Map coordinates** — optional lat/lng for precise map pin placement
- Click **Save firewall location** to persist

These settings can be set at the customer level (customer defaults) or overridden per firewall. HA peers automatically stay in sync.

### Actions

| Action          | What it does                                                    |
| --------------- | --------------------------------------------------------------- |
| View Assessment | Opens the Assess workbench scoped to this firewall and customer |
| Latest Report   | Opens the most recent saved report for this firewall            |
| View in Central | Opens this firewall in Sophos Central (when Central-connected)  |

### Drag-and-Drop Upload

You can drag and drop a config file (HTML or XML) directly onto a firewall card. This runs the analysis, updates the score in Fleet Command, and saves a score snapshot for history.

## Customer Group Features

### Compliance Defaults

Each customer group header has a **compliance bar** where you set:

- Default country for all firewalls in this group
- Default sector/environment type

Individual firewalls can override these defaults.

### Expand/Collapse

Toggle individual customer groups or use the expand/collapse all button to manage the view.

## How MSPs Use Fleet Command

### Morning Check

1. Open Fleet Command
2. Click **Needs attention** spotlight → see devices with criticals or offline status
3. Address any alerts or stale assessments
4. Check **Weak scores** → plan remediation conversations

### Pre-QBR Preparation

1. Search for the customer name
2. Review scores across all their firewalls
3. Click into any flagged device to review findings
4. Use the map to show geographic coverage
5. Export CSV for supplementary QBR data

### New Customer Discovery

When you connect Sophos Central, firewalls appear in Fleet Command even if you haven't assessed them yet. Use the **Unlinked** config link filter to see firewalls awaiting their first assessment.

## In-App Guided Tour

Click the **?** button in the top bar → select "Fleet Command" tour for a step-by-step overlay walkthrough.
