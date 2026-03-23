---
name: Report email and SE title
overview: Fix the send-report email text (greeting uses "Prepared For", body includes company name, sign-off uses "Prepared By" + new SE title) and add an SE Title field to the management drawer with preset dropdown options.
todos:
  - id: migration
    content: Create SQL migration to add se_title column to se_profiles
    status: completed
  - id: se-profile-type
    content: Update SEProfile interface and fetch/create functions in use-se-auth.ts to include seTitle
    status: completed
  - id: management-drawer
    content: Add SE Title field (dropdown with presets + freeform input) to both management drawers, save alongside prepared_by
    status: completed
  - id: frontend-payload
    content: Send prepared_for, prepared_by, and se_title in the send-report API payload from both HealthCheck pages
    status: completed
  - id: backend-template
    content: Update send-report handler to accept new fields and fix greeting, body text, and sign-off in the email template
    status: in_progress
isProject: false
---

# Report Email Fix and SE Title Field

## Problem

The current "send report to customer" email has several issues (see screenshot):

- **Greeting** uses `customer_name` (company) instead of the "Prepared For" (person)
- **Body** is generic, doesn't mention the company name
- **Sign-off** shows the SE's raw email (`joseph.mcdonald@sophos.com`) instead of their name, and has no job title

## Desired Email Layout

```
Hi {prepared_for},

Please find your Sophos Firewall Health Check report attached for {customer_name}.
This report includes a comprehensive assessment of your firewall configuration
with recommendations for improvement.

If you have any questions about the findings, please don't hesitate to reach out.

Best regards,
{prepared_by}
{se_title}
```

---

## Changes

### 1. Database: Add `se_title` column

Create a new migration to add `se_title text` to `se_profiles`:

```sql
ALTER TABLE public.se_profiles
  ADD COLUMN IF NOT EXISTS se_title text;
```

### 2. Frontend Type: Update `SEProfile` interface

In [src/hooks/use-se-auth.ts](src/hooks/use-se-auth.ts):

- Add `seTitle: string | null` to the `SEProfile` interface
- Update `fetchSEProfile` and `createSEProfile` to select and map `se_title`

### 3. Management Drawer: Add SE Title field

In both [src/components/SeHealthCheckManagementDrawer.tsx](src/components/SeHealthCheckManagementDrawer.tsx) and [src/components/SeHealthCheckManagementDrawer2.tsx](src/components/SeHealthCheckManagementDrawer2.tsx):

Add a new "Title" field below the "Prepared by" field with:

- A dropdown (`Select` component) with preset options:
  - Sophos Sales Engineer
  - Sophos Senior Sales Engineer
  - Sophos Cyber Security Consultant
  - Sophos Senior Professional Services Engineer
  - Sophos Professional Services Engineer
- A freeform `Input` that allows custom text (the dropdown pre-fills it, but the user can override)
- Save the title to `se_profiles.se_title` alongside the existing `health_check_prepared_by` save

### 4. Frontend: Send `prepared_for`, `prepared_by`, and `se_title` to the API

In [src/pages/HealthCheck.tsx](src/pages/HealthCheck.tsx) and [src/pages/HealthCheck2.tsx](src/pages/HealthCheck2.tsx), update the `send-report` API payload:

```typescript
body: JSON.stringify({
  customer_email: customerEmail.trim(),
  customer_name: customerName.trim() || undefined,
  prepared_for: preparedFor.trim() || undefined,
  prepared_by: effectivePreparedBy,   // from SE profile
  se_title: seAuth.seProfile?.seTitle || undefined,
  pdf_base64: pdfBase64,
  html_base64: htmlBase64,
  filename_base: filenameBase,
}),
```

### 5. Backend: Update send-report email template

In [supabase/functions/api/index.ts](supabase/functions/api/index.ts) (line ~2236):

- Accept `prepared_for`, `prepared_by`, and `se_title` from the request body
- **Greeting**: Use `prepared_for` (fall back to `customer_name`, then "Customer")
- **Body**: Include `for <strong>{customer_name}</strong>` when available
- **Sign-off**: Use `prepared_by` (fall back to `se.seProfile.display_name` / email), then `se_title` on the next line

```typescript
const recipientGreeting = prepared_for || customer_name || "Customer";
const signOffName = prepared_by || seName;
const forClause = customer_name ? ` for <strong>${customer_name}</strong>` : "";
const titleLine = se_title ? `<br/>${se_title}` : "";

// Body:
`<p>Hi ${recipientGreeting},</p>
 <p>Please find your Sophos Firewall Health Check report attached${forClause}. ...</p>
 <p>...</p>
 <p style="margin-top:16px;">Best regards,<br/>${signOffName}${titleLine}</p>`
```

