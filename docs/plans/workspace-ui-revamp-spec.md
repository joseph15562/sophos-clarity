---
name: Workspace UI revamp
overview: "Mission control ships first at /dashboard (not /); later optional promotion to home. Plus Fleet map, Customers, Reports, Insights, Drift, API, Updates. Cursor mirror ~/.cursor/plans/workspace-ui-revamp-spec.plan.md."
todos:
  - id: mission-control
    content: "Mission control at NEW route /dashboard (+ nav); keep / as Assess until explicit migration"
    status: pending
  - id: customers-fleet-map
    content: "Customers revamp (avatars, gauge, table toggle, modal) + Fleet second tab SVG map"
    status: pending
  - id: reports-library
    content: "Reports — stats header, filters, rich table, full-screen preview, sidebar generate, bulk bar"
    status: pending
  - id: insights-analytics
    content: "Insights — hero, time pills, threat/compliance heatmap, scatter + drawer, recommendations"
    status: pending
  - id: drift-diff
    content: "Drift — dual upload, VS, summary badges, diff explorer, risk panel, timeline"
    status: pending
  - id: api-hub
    content: "API page — health KPIs, keys table reveal/revoke, usage charts, recent requests"
    status: pending
  - id: updates-changelog
    content: "Updates/Changelog — threat feed, platform changelog, firmware table"
    status: pending
isProject: false
---

# Workspace UI revamp — feature spec (consolidated)

**Status:** Active specification (implementation not started by this document).  
**Note:** The older “MSP UI redesign” Cursor plan was **discarded**; this file replaces it as the source of truth for the scope below.

### Routing / naming (locked for v1)

- **Mission control** is the MSP **command-centre dashboard** (this spec’s PAGE 1). It is **not** Sophos Central (`/central/*`).
- **Phase A (initial ship):** Add Mission Control as a **new page** at **`/dashboard`** (path can be renamed in implementation if you prefer e.g. `/mission-control`, but avoid colliding with `/central`). Add a **primary nav item** (e.g. “Mission control” or “Overview”) pointing to it. **Do not** move or replace **`/`** (Assess) yet — bookmarks and deep links stay stable.
- **Phase B (later, optional):** When ready, promote Mission Control to the **main landing** (e.g. move to `/` and relocate Assess to `/assess`) with a deliberate migration + link sweep. Document that cutover in changelog when done.

---

## PAGE 1 — Mission control (command centre dashboard)

**Goal:** Full-width grid, mission-control feel — **ship first at `/dashboard`**; treat as the eventual “first screen” once you complete Phase B above.

**Route (v1):** `/dashboard`

### Hero strip (top)

Four large KPI tiles in a row, each with:

- Animated number (count-up on mount)
- Trend arrow
- Sparkline

KPIs:

1. **Total Customers** — e.g. 47 (+3 this month) — sparkline of new customers over 90 days
2. **Fleet Devices** — e.g. 1,284 — sparkline of device count
3. **Critical Alerts** — e.g. 12 — pulsing red badge, sparkline of alert frequency
4. **Compliance Score** — e.g. 87% — green ring progress gauge, trend arrow

### Main content grid (below hero)

**Left ~2/3**

- **Threat Activity** — Recharts `AreaChart`, gradient fill, last 30 days, three overlapping series: Blocked Threats / IPS Triggers / Web Filter Hits
- **Recent Alerts** — table with severity badges (CRITICAL / HIGH / MEDIUM / LOW), customer name, device, timestamp, **[Investigate]** per row

**Right ~1/3**

- **Top Customers by Risk** — vertical bar chart, ranked by alert count
- **Fleet Health** — donut: Online / Offline / Warning / Unknown + legend
- **Quick Actions** — four large icon buttons: **[New Assessment]** **[Generate Report]** **[Add Customer]** **[Run Playbook]**

### Bottom strip

- **Recent Documents** — up to five recent generated reports as horizontal cards: customer name, date, page count, **[Download]** **[View]**

---

## Fleet (`/command`) — map tab

- **Second tab** switches to a **world map** view: customer locations as **glowing dots**, **sized by fleet count**.
- Implementation: **simple SVG world map** with plotted coordinate markers (no heavy map SDK required for v1).

---

## Customers (`/customers`)

### Card grid (default)

Each customer card:

- **Logo placeholder:** initials avatar, **background colour from name hash**
- Customer name + **industry** badge
- **Risk score** — small circular gauge, colour-coded
- **Stats row:** Devices | Open Alerts | Last Report
- **Status badge:** Active / Onboarding / Churned
- **Bottom actions:** **[View]** **[New Assessment]** **[Manage]**
- **Card border:** glow **amber/red** when risk score **> 70** (confirm scale: higher = worse vs better; align with existing score model)

### List view toggle

- Switch between **card grid** and a **dense table** view (same underlying data).

### Add Customer — floating modal (not full page)

- Customer name
- Primary contact email
- Environment dropdown
- Country dropdown
- Logo upload
- **[Create Customer]**

---

## Reports (`/reports`)

Document library: generation, management, delivery.

### Stats header

Four KPIs: **Total Reports** | **Generated This Month** | **Pending** | **Delivered**

### Filter bar

- Date range picker
- Customer dropdown
- Environment filter
- Search

### Reports table (primary surface)

| # | Customer | Environment | Type | Pages | Risk Score | Generated | Status | Actions |

- **Type** badge: Full Handover / Executive Summary / Audit Checklist — **distinct colours**
- **Status** badge: Draft / Ready / Delivered / Archived
- **Risk score** — coloured pill (red / amber / green)
- **Actions:** **[View]** **[Download PDF]** **[Download .md]** **[Email]** **[Archive]**
- **[View]** → **full-screen modal**: rendered document preview, scrollable, **floating toolbar**: Download / Print / Share / Close

### Generate new report — right sidebar (persistent)

- Customer selector dropdown
- Report type — **three large pill buttons**
- Upload zone for config file
- **[Generate Now]** — prominent primary CTA (blue glow treatment)

### Bulk actions

- Row **checkboxes**; when any selected, **bottom action bar**:
  - **[Download Selected as ZIP]**
  - **[Mark as Delivered]**
  - **[Archive Selected]**

---

## Insights (`/insights`) — PAGE 6

Analytics / “so what?” page.

### Hero

- Full-width banner title: **Security Intelligence**
- Subtitle: _Trends, patterns, and actionable insights across your entire customer base_

### Time range

- Pill buttons: **7D | 30D | 90D | 12M | Custom**

### Section 1 — Threat landscape (top half)

- Large **AreaChart**: total threats blocked per day (filled, gradient)
- **Stacked BarChart**: threat categories — Malware / Phishing / IPS / Web
- Side panel: **Top Threat Types** — ranked list + horizontal progress bars

### Section 2 — Compliance trends

- **LineChart**: multiple series — one line per framework (e.g. GDPR, HIPAA, NIST, PCI-DSS), average compliance score over time
- **Heatmap calendar** (GitHub-style contribution grid): report generation activity

### Section 3 — Customer risk matrix

- Recharts **ScatterChart**:
  - X: number of devices
  - Y: risk score
  - Dot = customer; **size** ∝ alert count; **colour** = environment type
  - Tooltip: customer name, score, top finding
  - **Click dot** → open **customer detail drawer**

### Section 4 — Recommendations engine

- Panel: _Based on your fleet data, we recommend…_
- **Five action cards**, each with:
  - Priority badge
  - Customer name
  - Recommendation text
  - Effort: Low / Med / High
  - **[Create Playbook]** **[Dismiss]**

---

## Drift (`/drift`) — PAGE 7

Configuration drift / delta intelligence.

### Header + explainer

- Banner: **Drift Detection — Compare firewall configurations and identify changes instantly**

### Upload panel

- **Left:** Baseline config + **date picker** (config date)
- **Right:** Current config + **date picker**
- **Between:** VS badge / arrow
- **[Compare Configs]** — full width below both

### Results (after compare)

**Summary strip:** four badges — Added Rules | Removed Rules | Modified Rules | Unchanged

**Diff explorer**

- Vertical list of **changed sections**, expandable
- Header per section, e.g. “Firewall Rules” + change count badge
- Expanded: **side-by-side diff**
  - Green = added
  - Red = removed
  - Amber = modified (old vs new)
  - Unchanged collapsed + **[Show N unchanged]** toggle

**Change risk analysis**

- Panel: AI-style **Change Risk Analysis**
  - Overall risk badge for the change set
  - Callouts per rule change
  - **[Generate Change Report]** → PDF of diff only

**Drift history timeline**

- Bottom: horizontal scrollable timeline of past comparisons for a **selected customer**, marker per comparison

---

## API (`/api`) — revamp

API management + documentation hub.

### Top — API health strip

Three KPIs:

- **API Status:** OPERATIONAL — green **pulsing** dot
- **Requests Today:** e.g. 2,847
- **Avg Response Time:** e.g. 142ms

### API Keys panel

Table:

| Name | Key (masked `sk-…xxxx`) | Created | Last Used | Permissions | Actions |

- **[Reveal]** — unmask after **confirmation modal**
- **[Revoke]** — red, **confirmation**
- **[Create New Key]** → modal: name, permission scopes, expiry

### Usage analytics

- **LineChart:** API calls per hour (last 24h)
- **BarChart:** calls by endpoint (top 10)
- **Table:** recent requests — endpoint, method, status code, latency

_(Wire KPIs/charts to real metrics when available; otherwise structured mock + clear “demo data” only if product requires honesty.)_

---

## Updates (`/changelog`) — PAGE 11

Split layout, two columns.

### Left — Threat intelligence feed

- Title: **Latest Threats** + **live pulsing** indicator
- Vertical cards:
  - Severity (CRITICAL / HIGH / MEDIUM)
  - CVE if applicable
  - Threat name (bold)
  - Affected products badge
  - Short description
  - Published date
  - **[View Advisory]**
- **Filter tabs:** All | Critical | Firewall | Endpoint | Network

### Right — Platform updates (“What’s New”)

- Version tag (e.g. v2.4.1), release date
- Categories with **visual labels** (prefer coloured dots / labels in UI; avoid ambiguous emoji in product copy per house style)
  - New Features | Improvements | Bug Fixes
- Bullets per category
- **[Release Notes]** link

### Bottom — Sophos firmware updates

Table:

| Model | Current Version | Latest Version | Released | Status | Notes |

- Status: Up to Date / Update Available / Critical Update — colour-coded
- Update Available → amber + **[View Change Log]**

---

## Cross-cutting implementation notes

- **Tables:** sortable + filterable where specified (consider TanStack Table + shadcn `Table`).
- **Animations:** CSS / Tailwind + Recharts; respect `prefers-reduced-motion`.
- **Data:** combine real org data (Supabase / Central) with structured mocks for gaps so layouts are never empty placeholders.
- **Changelog:** when shipping user-visible Updates page changes, update in-app [`ChangelogPage.tsx`](src/pages/ChangelogPage.tsx) per project rule.

---

## Suggested implementation order (optional)

1. Mission control at **`/dashboard`** + nav entry (leave `/` as Assess)
2. Customers (cards, table toggle, modal, map tab on Fleet)
3. Reports (table, sidebar generate, bulk bar, preview modal)
4. Insights (sections 1–4)
5. Drift (upload, diff UI, timeline, risk panel)
6. API (health, keys UI, usage)
7. Updates / Changelog split layout + firmware table

---

_Document created from user-provided spec; typos in source (`---r`) omitted._
