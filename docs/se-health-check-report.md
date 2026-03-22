# SE Firewall Health Check Report

The SE Firewall Health Check is a structured, repeatable assessment tool for Sophos XGS / SFOS firewall configurations. It parses uploaded configuration exports (HTML or entities XML), runs deterministic checks against Sophos hardening guidance, and produces downloadable PDF and HTML reports.

## Report outputs

The system generates three downloadable artefacts from a single analysis session:

- **PDF report** (`se-health-check-pdfmake.ts`) — structured pdfmake document with branded cover, overview, scoring sections, and per-firewall findings.
- **HTML report** (`se-health-check-report-html.ts`) — self-contained HTML document with embedded CSS, suitable for browser viewing and printing.
- **Summary JSON** — machine-readable export of scores, findings, and session configuration for integration or archival.

A combined "Download PDF + HTML" button triggers both downloads simultaneously.

## PDF report structure

### Cover page

Navy background with Sophos wordmark, title "Sophos Firewall Health Check", and meta fields:

| Field | Source |
|-------|--------|
| Customer Name | User input on the Health Check page |
| Prepared For | Defaults to customer name if not set |
| Prepared By | SE user profile or manual entry |
| Serial Number | From Central-linked serial(s) on uploaded files |
| Date | Report generation timestamp |

A centered Sophos shield mark appears in the lower portion. Footer shows copyright and CONFIDENTIAL text on page 1 only.

### Overview page

Full-width navy header band with wordmark and "Firewall health check overview" title in teal. Body text explains the report structure: executive summary, provenance and limitations, assessment scope, and baseline/findings sections.

### Provenance and limitations

Generation timestamp (UTC and local), tool identity, and caveats about offline file-based analysis.

### Assessment scope and exclusions

Documents the assessment parameters that affect scoring:

- **DPI (SSL/TLS inspection) exclusions** — zones and networks excluded from DPI gap checks.
- **Active threat response (SE acknowledgement)** — MDR threat feeds, NDR Essentials, and DNS Protection toggles for features not present in exports.
- **Synchronized Security scope** — whether Security Heartbeat check was excluded (no Sophos endpoints).
- **Web filter compliance** — informational vs strict mode, and rule names excluded from missing-web-filter detection.

### Executive Summary (per firewall)

For each analysed firewall:

#### Sophos Licence Selection

Three-column card layout showing Standard Protection, Xstream Protection, and Individual Modules tiers. The selected tier is highlighted with an indigo accent. Active module names are listed below.

#### Sophos Best Practice Score

- **Circular gauge** — canvas-rendered PNG showing overall score (0–100) and letter grade (A–F), with grade-appropriate colours (green/amber/orange/red).
- **Summary counts** — Passed, Failed, Verify, and N/A totals displayed in coloured columns.
- **Per-check breakdown** — grouped by category (Device Hardening, Visibility & Monitoring, Encryption & Inspection, etc.) with coloured status dots (green = pass, red = fail, orange = verify, grey = N/A), check titles, detail text, and Sophos recommendations for failed checks.

Page breaks are inserted before "Visibility & Monitoring" and "Zero-Day Protection" categories to maintain clean pagination.

#### Finding counts by severity

Table showing counts across Critical, High, Medium, Low, and Info severity levels.

#### Priority next steps

Bulleted list of top 5 critical/high findings with remediation hints.

### Baseline and findings (per firewall)

- **Baseline checklist** — pass/fail table for each baseline requirement with detail text.
- **Findings table** — severity, title, configuration section, and detail for every finding. Starts on a new page.

## Typography

The PDF uses vendored Zalando Sans TTF fonts:

- **Zalando Sans Expanded** — headings (h2, h3, h4), cover title, category labels.
- **Zalando Sans** — body text, meta lines, table cells, check details.
- **Zalando Sans Bold** — cover meta labels, check titles, stat counts.

Font files are stored under `public/fonts/se-pdf/` and loaded via `loadSeHealthCheckPdfFonts()` which registers them in pdfmake's virtual file system.

## Table styling

All tables use `LAYOUT_TABLE_REPORT`: alternating white/light-grey rows, thin grey horizontal dividers, no vertical lines, 9pt bold header text.

## Scoring system

### Best Practice Score

31 checks across categories: Device Hardening, Visibility & Monitoring, Encryption & Inspection, Rule Hygiene, Network Protection, Active Threat Response, Synchronized Security, Web Protection, Zero-Day Protection, Central Orchestration, DNS Protection, and Resilience.

Each check is weighted and produces a status: pass, fail, warn (verify), or N/A. The overall score (0–100) maps to a letter grade: A (90+), B (75+), C (60+), D (40+), F (<40).

### Export gap acknowledgements

Some features are not included in HTML/XML configuration exports. The SE can toggle these to score the corresponding BP checks as pass:

- **MDR threat feeds** (`bp-mdr-feeds`)
- **NDR Essentials** (`bp-ndr`)
- **DNS Protection** (`bp-dns-protection`) — has its own dedicated section in the UI

### Licence tier scoring

Checks are scoped to the selected licence tier. Checks requiring modules not in the selected tier are marked N/A and excluded from scoring.

## Web UI components

### SophosBestPractice

Main scoring dashboard with gauge ring, summary counts, per-firewall tabs (for multi-firewall analysis), and expandable category accordions showing individual checks with manual override capability.

### SeThreatResponseAckBar

Toggle bar for MDR threat feeds and NDR Essentials export gap acknowledgements.

### SeDnsProtectionAckBar

Separate toggle for DNS Protection configuration verification, since DNS Protection config is not included in firewall exports.

### SeHeartbeatScopeBar

Toggle to exclude Security Heartbeat check when the customer has no Sophos endpoint deployment.

### HealthCheckDashboard

Per-firewall findings view with severity breakdown, JSON export, and PDF/HTML download buttons.

## Key files

| File | Purpose |
|------|---------|
| `src/lib/se-health-check-pdfmake.ts` | PDF document definition (pdfmake) |
| `src/lib/se-health-check-report-html.ts` | HTML report generation |
| `src/lib/sophos-licence.ts` | Licence tiers, modules, BP checks, scoring |
| `src/lib/se-health-check-bp.ts` | BP override management, threat response ack sets |
| `src/lib/se-health-check-snapshot.ts` | Session persistence for reopen/export from history |
| `src/lib/health-check-pdf-download.ts` | Download orchestration (PDF + HTML) |
| `src/components/SophosBestPractice.tsx` | BP score dashboard UI |
| `src/components/HealthCheckDashboard.tsx` | Findings dashboard UI |
| `src/components/SeThreatResponseAckBar.tsx` | MDR/NDR/DNS toggle bars |
| `src/pages/HealthCheck.tsx` | Main SE Health Check page |
| `public/fonts/se-pdf/` | Vendored Zalando Sans TTF fonts |
