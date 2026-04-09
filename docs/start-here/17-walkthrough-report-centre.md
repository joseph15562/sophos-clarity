# Walkthrough: Report Centre & Scheduled Reports

The Report Centre is the MSP's report library — every assessment report you've saved, across all customers, in one searchable, filterable archive with bulk actions, scheduled delivery, and email-send capability.

## Report Library

### What You See

Each row in the library represents a saved report:

| Column      | Detail                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| Customer    | Which customer the report belongs to                                                |
| Environment | Environment type (Production, Staging, etc.)                                        |
| Type        | Inferred from report content — Full Handover, Executive Summary, or Audit Checklist |
| Pages       | Estimated page count                                                                |
| Date        | When the report was saved                                                           |
| Status      | **Ready** (active) or **Archived**                                                  |

### Filters

- **Customer** — filter by customer name
- **Environment** — filter by environment type
- **Date range** — narrow to a specific period
- **Text search** — search across report content
- **Sort** — by date, customer, type

### Actions Per Report

| Action   | What it does                                                                |
| -------- | --------------------------------------------------------------------------- |
| Preview  | Loads the full HTML report in a preview pane                                |
| Download | Downloads as PDF (server-rendered with Headless Chromium)                   |
| Print    | Opens the browser print dialog with the rendered report                     |
| Share    | Generates a read-only share link with optional Word/PDF download            |
| Email    | Quick-send the report to a recipient — builds HTML and sends via Resend     |
| Delete   | Permanently removes the report                                              |
| Archive  | Moves to the Archives section (hidden from active library + client portals) |
| Restore  | Moves an archived report back to active                                     |

### Bulk Actions

Select multiple reports for:

- Bulk archive/restore
- ZIP download (all selected reports in a ZIP with `reports/` and `presentations/` folders)
- Bulk status change

### Archives Section

A collapsible section below the active library showing archived reports. Archived reports:

- Don't appear in Client Portals
- Don't count in active report totals
- Can be restored at any time

## Quick-Send Email

For saved reports, you can email directly from the Report Centre:

1. Click the **Send** icon on a report row
2. Enter the recipient email address
3. The report is rendered as HTML, attached, and sent via the email delivery pipeline (Resend-backed)
4. The `prepared_by` field is auto-populated from your profile

## Scheduled Reports

### Overview

Scheduled reports automatically generate and deliver reports to customer contacts on a recurring cadence — no manual intervention.

### Setup

1. Open **Management Panel** → **Settings** → **Scheduled Reports**
   (or navigate from the Report Centre's schedules panel)
2. Click **Create Schedule**

### Schedule Configuration

| Setting          | Options                                                               |
| ---------------- | --------------------------------------------------------------------- |
| Name             | Descriptive name (e.g., "Acme Monthly Posture Report")                |
| Frequency        | Weekly, Monthly, Quarterly                                            |
| Report type      | One-pager, Executive Summary, Compliance                              |
| Include sections | Score overview, Findings summary, Compliance status, Remediation plan |
| Recipients       | Email addresses for delivery                                          |
| Enabled          | Toggle on/off                                                         |

### Actions

| Action   | What it does                                                         |
| -------- | -------------------------------------------------------------------- |
| Send now | Immediately triggers the scheduled report pipeline for this schedule |
| Preview  | Generates and shows the report content without sending               |
| Edit     | Modify schedule settings                                             |
| Delete   | Removes the schedule                                                 |

### How It Works (Backend)

1. A Supabase Edge Function (`send-scheduled-reports`) runs on a cron schedule
2. It queries `scheduled_reports` where `enabled = true` and `next_due_at <= now`
3. For each due schedule, it inserts a job into the `job_outbox` table with an idempotency key (report ID + due date)
4. The job pipeline generates the report content and delivers via email
5. Duplicate prevention: the idempotency key ensures the same report isn't sent twice

## How MSPs Use the Report Centre

### Report Cadence Management

Set up scheduled reports for each customer to match your SLA:

- **Monthly** for standard-tier customers
- **Weekly** for premium customers or those in remediation
- **Quarterly** for stable, low-risk customers

### Customer Deliverables

When a customer asks for their latest report:

1. Search by customer name in the Report Centre
2. Click **Share** to generate a read-only link
3. Send the link — they can download PDF or Word from it

### Audit Trail

The Report Centre serves as your compliance evidence archive:

- Every report has a timestamp and customer association
- Archive old reports to keep the active library focused
- Use date range filters to pull reports for a specific audit period

### QBR Preparation

Before a Quarterly Business Review:

1. Filter by customer + last 90 days
2. Preview each report to identify talking points
3. Use bulk ZIP download to prepare an offline package
4. Reference score improvements between consecutive reports

## In-App Guided Tour

Click the **?** button → select "Report Centre" tour for a step-by-step walkthrough.
