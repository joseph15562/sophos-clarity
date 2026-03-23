---
name: Salesforce CRM integration
overview: Plan for integrating Sophos FireComply health check results with Salesforce, logging health checks as activities against customer opportunities. Blocked on API access — this is a future roadmap item.
todos:
  - id: sf-api-access
    content: Obtain Salesforce Connected App credentials and API access from Sophos Salesforce admin (BLOCKER)
    status: pending
  - id: sf-db-migration
    content: Add salesforce_task_id, salesforce_account_id, salesforce_logged_at columns to se_health_checks
    status: pending
  - id: sf-backend-oauth
    content: Implement Salesforce OAuth2 token exchange and caching in the Edge Function
    status: pending
  - id: sf-backend-routes
    content: Add POST /api/salesforce/log-activity and GET /api/salesforce/search-accounts routes
    status: pending
  - id: sf-frontend-ui
    content: Add 'Log to Salesforce' button, account search dialog, and 'Logged' badge to both HealthCheck pages
    status: pending
  - id: sf-history-badge
    content: Show Salesforce icon on history rows that have been logged to CRM
    status: pending
isProject: false
---

# Salesforce CRM Integration

## Status: ROADMAP (blocked on Salesforce API access)

This plan documents the full architecture for pushing FireComply health check data into Salesforce as activities logged against customer opportunities. It is not yet actionable because Sophos Salesforce API access has not been granted. Once access is available, this plan can be executed.

---

## Goal

When an SE completes and saves a health check, optionally push a summary into Salesforce as a **Task** or **Event** (activity) linked to the customer's **Opportunity** or **Account**, so the health check is visible in the CRM timeline alongside other sales activities.

---

## Prerequisites (must be resolved before building)

- **Salesforce Connected App** — A Sophos Salesforce admin must create a Connected App with OAuth2 (JWT Bearer or Web Server flow) scoped to the relevant org
- **API credentials** — Client ID, Client Secret (or certificate for JWT flow), and the Salesforce instance URL
- **Permission set** — The connected app must have permission to read Accounts/Opportunities and create Tasks
- **Field mapping** — Confirm which Salesforce object to attach to (Opportunity vs Account) and whether a custom object (e.g. `Health_Check__c`) is preferred over a standard Task
- **Data governance** — Confirm what data can be sent to Salesforce (scores, findings, customer name) and what must stay in FireComply only

---

## Architecture

```
SE clicks "Log to Salesforce" in FireComply
        |
        v
Frontend sends POST /api/salesforce/log-activity
  (JWT auth, health check ID)
        |
        v
Supabase Edge Function (api/index.ts)
  1. Authenticate SE (existing authenticateSE)
  2. Load health check data from se_health_checks
  3. Exchange Salesforce OAuth token (cached, refreshed as needed)
  4. Search Salesforce for Account/Opportunity by customer name
     - GET /services/data/vXX.0/query?q=SELECT Id FROM Account WHERE Name LIKE '%{customer}%'
  5. Create Task linked to the matched record
     - POST /services/data/vXX.0/sobjects/Task
  6. Store salesforce_task_id back on se_health_checks row
        |
        v
Frontend shows "Logged to Salesforce" badge
```

---

## Database changes

Add columns to `se_health_checks`:

```sql
ALTER TABLE public.se_health_checks
  ADD COLUMN IF NOT EXISTS salesforce_task_id text,
  ADD COLUMN IF NOT EXISTS salesforce_account_id text,
  ADD COLUMN IF NOT EXISTS salesforce_logged_at timestamptz;
```

---

## Backend: new routes in `supabase/functions/api/index.ts`

### `POST /api/salesforce/log-activity`

- **Auth**: JWT (SE must be authenticated)
- **Body**: `{ health_check_id, account_search_term?, opportunity_id? }`
- **Flow**:
  1. Load health check from DB, verify SE owns it
  2. Get Salesforce access token (OAuth2 client credentials or JWT bearer, token cached in memory with TTL)
  3. If `opportunity_id` provided, use it directly; otherwise search by `account_search_term` or `customer_name`
  4. Create a Salesforce Task:
    - `Subject`: "Sophos Firewall Health Check — {customer_name}"
    - `Description`: Score summary, grade, top findings, link back to FireComply
    - `Status`: "Completed"
    - `Priority`: "Normal"
    - `WhatId`: Opportunity or Account ID
    - `ActivityDate`: health check date
  5. Update `se_health_checks` with `salesforce_task_id`, `salesforce_account_id`, `salesforce_logged_at`

### `GET /api/salesforce/search-accounts?q={term}`

- Search Salesforce Accounts/Opportunities by name for the SE to pick the right one
- Returns `[{ id, name, type }]`

---

## Frontend changes

### In [src/pages/HealthCheck2.tsx](src/pages/HealthCheck2.tsx) and [src/pages/HealthCheck.tsx](src/pages/HealthCheck.tsx)

- Add a "Log to Salesforce" button in the Save & Export section (next to the other export buttons)
- Only visible when `savedCheckId` is set (health check has been saved)
- On click, open a small dialog:
  - Auto-search Salesforce for the customer name
  - Show matching Accounts/Opportunities in a dropdown
  - SE picks the right one and confirms
  - Show "Logged to Salesforce" badge with timestamp after success
- If already logged (`salesforce_task_id` exists), show a "View in Salesforce" link instead

### In [src/components/SEHealthCheckHistory.tsx](src/components/SEHealthCheckHistory.tsx)

- Show a small Salesforce icon/badge on history rows that have been logged to CRM

---

## Environment variables needed

```
SALESFORCE_CLIENT_ID=...
SALESFORCE_CLIENT_SECRET=...
SALESFORCE_INSTANCE_URL=https://sophos.my.salesforce.com
SALESFORCE_API_VERSION=v59.0
```

Store in Supabase Edge Function secrets (`supabase secrets set`).

---

## Security considerations

- Salesforce credentials stored as Supabase secrets, never exposed to the frontend
- SE can only log their own health checks (ownership check)
- Customer data sent to Salesforce is limited to: customer name, score, grade, top findings summary, and a link back to FireComply
- Full report content (XML, detailed findings) stays in FireComply only
- Salesforce API calls are proxied through the Edge Function — the frontend never talks to Salesforce directly

---

## Custom Salesforce Object (alternative to Task)

If the Salesforce admin prefers, a custom object `Health_Check__c` could be created with fields like:

- `Customer_Name__c` (text)
- `Overall_Score__c` (number)
- `Overall_Grade__c` (picklist: A/B/C/D/F)
- `Findings_Count__c` (number)
- `Firewall_Count__c` (number)
- `Top_Findings__c` (long text)
- `Report_Link__c` (URL)
- `Checked_Date__c` (date)
- `SE_Name__c` (text)

This would allow Salesforce reporting/dashboards on health check data. The API integration pattern is the same — just a different `sobjects` endpoint.

---

## Rollout phases

1. **Phase 1 (this plan)**: Log as standard Salesforce Task with description containing the summary. Minimal Salesforce admin setup required.
2. **Phase 2**: Custom `Health_Check__c` object for richer reporting. Requires Salesforce admin to create the object/fields.
3. **Phase 3**: Bi-directional sync — pull Account/Opportunity metadata into FireComply to auto-populate customer details.

