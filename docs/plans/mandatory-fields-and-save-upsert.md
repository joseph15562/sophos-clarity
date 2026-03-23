---
name: Mandatory fields before export
overview: Add validation to require Customer Name, Customer Email, and Prepared For before any export/send. Also change saveHealthCheck to upsert (update existing row) instead of always inserting, matching by savedCheckId or customer_name + firewall serial numbers.
todos:
  - id: upsert-hc2
    content: Change saveHealthCheck in HealthCheck2.tsx to upsert — update existing row when savedCheckId is set, otherwise match by customer_name + serial numbers before inserting
    status: completed
  - id: upsert-hc1
    content: Apply same upsert logic to saveHealthCheck in HealthCheck.tsx
    status: completed
  - id: validation-hc2
    content: Add mandatory field validation to all 5 export/send callbacks in HealthCheck2.tsx and disable buttons when fields empty
    status: completed
  - id: validation-hc1
    content: Add same mandatory field validation to all 5 export/send callbacks in HealthCheck.tsx and disable buttons when fields empty
    status: in_progress
isProject: false
---

# Mandatory Fields Before Export/Send + Save Upsert

## Requirements

1. **Mandatory fields**: Customer Name, Customer Email, and Prepared For must all be filled in before any export (PDF, HTML, ZIP, JSON) or email send
2. **Upsert on save**: `saveHealthCheck` should update the existing saved row instead of creating duplicates. Match on `savedCheckId` first, then fall back to matching by `customer_name` + firewall serial numbers within the same SE and team

## Changes

### 1. Upsert logic in `saveHealthCheck`

In both [src/pages/HealthCheck.tsx](src/pages/HealthCheck.tsx) and [src/pages/HealthCheck2.tsx](src/pages/HealthCheck2.tsx), the `saveHealthCheck` callback (line ~874 in HC2) currently always does `.insert()`. Change to:

```typescript
// If we already have a savedCheckId, update that row
if (savedCheckId) {
  const { error } = await supabase
    .from("se_health_checks")
    .update({ customer_name, overall_score, overall_grade, findings_count, firewall_count, summary_json, team_id })
    .eq("id", savedCheckId);
  if (error) throw error;
  toast.success("Health check updated.");
} else {
  // Try to find an existing match by customer_name + serial numbers + SE
  const serialNumbers = files.map(f => f.serialNumber).filter(Boolean).sort();
  let existingId: string | null = null;
  if (customerName.trim() && serialNumbers.length) {
    const { data: existing } = await supabase
      .from("se_health_checks")
      .select("id, summary_json")
      .eq("se_user_id", seAuth.seProfile.id)
      .eq("customer_name", customerName.trim())
      .eq("team_id", activeTeamId)
      .order("checked_at", { ascending: false })
      .limit(10);
    // Match by serial numbers in the snapshot
    existingId = existing?.find(row => {
      const snap = row.summary_json?.snapshot;
      const savedSerials = snap?.files?.map(f => f.serialNumber).filter(Boolean).sort();
      return JSON.stringify(savedSerials) === JSON.stringify(serialNumbers);
    })?.id ?? null;
  }
  if (existingId) {
    const { error } = await supabase
      .from("se_health_checks")
      .update({ ... })
      .eq("id", existingId);
    setSavedCheckId(existingId);
    toast.success("Health check updated.");
  } else {
    const { data, error } = await supabase
      .from("se_health_checks")
      .insert({ ... })
      .select("id").single();
    setSavedCheckId(data.id);
    toast.success("Health check saved.");
  }
}
```

Key behaviors:

- If `savedCheckId` is already set (from a previous save in this session), always update that row
- If no `savedCheckId`, look for an existing row with the same `customer_name` + same set of firewall serial numbers + same SE + same team
- If the matched existing row is **older than 7 days** (`checked_at` > 7 days ago), treat it as stale and create a new row instead of updating -- this gives a historical trail for repeat health checks
- Only create a new row if no match found or the match is over a week old
- Don't reset `shareToken`/`shareExpiry` on update (preserves existing share links)

### 2. Mandatory field validation

Add a validation guard at the top of each export/send callback:

```typescript
const missingFields: string[] = [];
if (!customerName.trim()) missingFields.push("Customer Name");
if (!customerEmail.trim()) missingFields.push("Customer Email");
if (!preparedFor.trim()) missingFields.push("Prepared For");
if (missingFields.length) {
  toast.error(`Please fill in: ${missingFields.join(", ")}`);
  return;
}
```

Apply to all five: `handleDownloadHealthCheckPdf`, `handleDownloadHealthCheckHtml`, `handleDownloadHealthCheckZip`, `exportSummaryJson`, `handleSendReportToCustomer`

### 3. Disable buttons when fields empty

```typescript
const exportFieldsReady = !!(customerName.trim() && customerEmail.trim() && preparedFor.trim());
```

Add `disabled={!exportFieldsReady || pdfBusy}` to all download/send buttons. Always show the "Send to customer" button (currently hidden when email is empty) but disable it.