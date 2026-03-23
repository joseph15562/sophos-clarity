---
name: Health check enhancements v2
overview: "Next round of FireComply health check enhancements: score trending by serial number, firmware/EOL warnings from Central data, quarterly follow-up reminders, team dashboard (operational not competitive), and additional quality-of-life improvements."
todos:
  - id: score-trending
    content: Build score trending chart matched by firewall serial number, querying past se_health_checks for the same serial(s)
    status: completed
  - id: firmware-eol
    content: Add firmware status and EOL warnings using Central API model/firmwareVersion data + static lifecycle lookup
    status: completed
  - id: followup-reminders
    content: Add quarterly/6-month follow-up reminders with DB columns, cron email job, and UI for scheduling
    status: completed
  - id: team-dashboard
    content: Build operational team dashboard with activity stats, common findings, score distribution
    status: completed
  - id: finding-notes
    content: Let SEs annotate individual findings with context notes that persist across checks
    status: completed
  - id: kb-links
    content: Add Sophos KB article links and how-to-fix guidance per best practice finding
    status: completed
  - id: recheck-link
    content: One-click re-check button that pre-fills a new upload request from previous customer data
    status: completed
  - id: csv-export
    content: Add CSV/Excel export of findings for customer remediation tracking
    status: completed
isProject: false
---

# Health Check Enhancements v2

## 1. Score Trending (by firewall serial number)

Track and visualise how a customer's health check score changes over time, matched by the firewall's serial number since that's the unique identifier across checks.

### How it works

- The `se_health_checks.summary_json.snapshot.files` array already stores `serialNumber` per firewall
- When the SE loads a saved check or views history, query past checks that share the same serial number(s)
- Display a simple sparkline or line chart showing score over time (date on X, score on Y)
- Since we said 1 firewall per customer, the serial number is effectively the customer identifier for trending

### Data

No new tables needed. Query existing `se_health_checks` rows filtering by:

- Same `se_user_id` (or same team)
- `summary_json->snapshot->files` containing a matching serial number
- Order by `checked_at`

### UI

- Add a "Score History" section in the report area (below the score gauge) when prior checks exist
- Show a small line chart (use recharts, already common in React projects) with date labels
- Below the chart, show a table: Date | Score | Grade | Delta (e.g. "+12 points")
- If no prior checks for this serial, show nothing (no empty state clutter)

### Frontend location

- [src/pages/HealthCheck2.tsx](src/pages/HealthCheck2.tsx) — new `ScoreTrendChart` component rendered when `files[0].serialNumber` has matches in history
- New component: `src/components/ScoreTrendChart.tsx`

---

## 2. Firmware & EOL Warnings

When the SE has Central data connected (either via customer upload or direct SE connection), show firmware and lifecycle advisories.

### Central API data available

The Sophos Central API already returns per firewall:

- `firmwareVersion` (e.g. "20.0.2.616")
- `model` (e.g. "XGS 136")

The `sophos_check_firmware_upgrade` Central API can check if an upgrade is available for a specific firewall.

### What to show

- **Firmware status**: Current version vs latest available. Flag as "Up to date", "Update available", or "Major version behind"
- **Model lifecycle**: Maintain a static JSON lookup of Sophos firewall EOL dates (sourced from Sophos lifecycle page). Flag models that are EOL, approaching EOL (within 12 months), or end of extended support
- The lifecycle data is public: [Sophos Lifecycle Policy](https://support.sophos.com/support/s/article/KB-000034136)

### Implementation

- Add a static `src/data/sophos-firewall-lifecycle.json` with model -> EOL date mappings (manually maintained, easy to update)
- In the health check UI, when Central data is loaded and firewalls are available, show a "Firmware & Lifecycle" card:
  - Current firmware version
  - "Update available" badge if `firmwareVersion` is older than latest known GA
  - EOL warning banner if model is EOL or approaching EOL
- Include firmware/EOL findings in the report output

### Note on Central MCP

The Central MCP confirms `sophos_get_firewall` returns firmware version and model. The `sophos_check_firmware_upgrade` endpoint can check for available upgrades. These are already proxied through the Edge Function for customer uploads — the same data is available.

---

## 3. Quarterly/6-Month Follow-Up Reminders

After completing a health check, the SE can set a follow-up reminder to re-engage the customer for their next health check.

### How it works

- After saving a health check, show a "Schedule follow-up" option
- Presets: 3 months (quarterly) or 6 months
- Stores the reminder date and sends the SE an email when it's due
- Email says: "Time to re-check {customer_name} — last health check was on {date}, score was {grade} ({score}%)"
- Include a deep link back to FireComply with the customer name pre-filled

### Database

```sql
ALTER TABLE public.se_health_checks
  ADD COLUMN IF NOT EXISTS followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_sent boolean DEFAULT false;
```

### Backend

- Add a scheduled cron (Supabase pg_cron or Edge Function cron) that runs daily
- Query `se_health_checks WHERE followup_at <= now() AND followup_sent = false`
- Send reminder email to the SE using the existing `buildSophosEmailHtml` template
- Mark `followup_sent = true`

### Frontend

- After save, show two buttons: "Follow up in 3 months" / "Follow up in 6 months"
- If a follow-up is already set, show "Follow-up scheduled for {date}" with option to cancel
- In history view, show a small calendar icon on rows with upcoming follow-ups

---

## 4. Team Dashboard (Operational)

A team-level overview showing operational stats — not a competition, but visibility into team activity and common patterns to help managers and SEs learn from each other.

### What to show

- **Activity summary**: Total health checks this month/quarter, checks by team member
- **Average customer score**: What's the typical score across all customers the team has checked
- **Most common failing checks**: Top 10 best practice checks that customers fail most often — helps the team know what to focus training on
- **Score distribution**: How many customers are A/B/C/D/F — a pie or bar chart
- **Recent activity feed**: Last 10 health checks across the team (who, customer, score, when)

### Data source

All data comes from existing `se_health_checks` rows filtered by `team_id`. The `summary_json.scores` and `summary_json.topFindings` fields provide the detail.

### UI

- New tab or section accessible from the main page when a team is selected
- Toggle between "My checks" and "Team overview"
- Charts using a lightweight library (recharts)
- No names on the activity feed beyond "Created by {name}" — it's operational awareness, not ranking

### Frontend location

- New component: `src/components/TeamDashboard.tsx`
- Rendered in a new tab alongside the existing "My reports" / "Team" / "All teams" toggle

---

## 5. Additional Enhancements

### 5a. Finding Notes / Annotations

Let the SE add a note to individual findings explaining context (e.g. "customer can't enable this due to legacy VPN client"). Notes persist across checks for the same customer/serial and carry forward into the next health check.

- Store in `se_health_checks.summary_json` as a `findingNotes: Record<findingId, string>` field
- Show a small "Add note" icon next to each finding in the report
- Notes appear in the PDF/HTML report as "SE Note: ..."

### 5b. Remediation Guides (KB Links)

Link each best practice finding to the relevant Sophos KB article or admin console path.

- Add a static `src/data/sophos-bp-kb-links.json` mapping finding IDs to KB URLs and short "how to fix" steps
- Show a "How to fix" expandable section under each finding
- Include the Sophos admin console navigation path (e.g. "Protect > Rules and policies > SSL/TLS inspection")

### 5c. Re-Check Link

Send a customer a fresh upload request for a follow-up health check, pulling their details from a previous check. Since reports can be months old, the SE needs a way to search for the customer rather than scrolling through history.

- Add a "Request re-check" button in the upload request area (not buried in old history)
- Opens a **search bar** that queries saved health checks by customer name (fuzzy/partial match)
- Search hits `se_health_checks` filtered by the SE's team, returning: customer name, last check date, score, grade
- SE picks the customer from the search results
- Pre-fills the upload request dialog with the customer's name and email (pulled from the matched check's snapshot)
- The new upload request is automatically tied to the same serial number / customer for trending continuity
- If the customer has had multiple checks, show the most recent one with a "Last checked: {date} — Score: {grade}" label

### 5d. CSV/Excel Finding Export

Export findings as a simple spreadsheet for customers who want to track remediation in their own tools.

- "Export findings CSV" button alongside existing exports
- Columns: Finding, Category, Severity, Status, Recommendation, KB Link
- Simple CSV generation (no library needed)

