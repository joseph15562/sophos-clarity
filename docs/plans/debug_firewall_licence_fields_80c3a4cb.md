---
name: Debug firewall licence fields
overview: Deploy the updated Edge Function with the `firewall-detail` mode and query it to inspect the full raw Sophos API response for a single firewall, looking for any undocumented licence/subscription fields.
todos:
  - id: deploy-edge-fn
    content: Deploy the updated sophos-central Edge Function with firewall-detail mode
    status: completed
  - id: query-raw-response
    content: Query firewall-detail for the XGS128 and inspect full raw JSON response for licence fields
    status: completed
  - id: decide-next
    content: Based on findings, decide how to show per-device licence data in the enrichment panel
    status: completed
isProject: false
---

# Debug Firewall Licence Fields

## Goal
Check if the Sophos Central `/firewall/v1/firewalls/{firewallId}` endpoint returns any per-device licence data in its raw response that we're currently discarding.

## Steps

1. **Deploy the updated Edge Function** that includes the new `firewall-detail` mode (already committed in `supabase/functions/sophos-central/index.ts`)
   ```bash
   cd "/Users/joseph.mcdonald/Sophos Clarity"
   supabase functions deploy sophos-central
   ```

2. **Query the firewall-detail endpoint** via `curl` or a quick script to call the Edge Function with:
   - `mode: "firewall-detail"`
   - `tenantId`: the tenant ID from `central_credentials` or `central_tenants`
   - `firewallId`: the firewall ID from `central_firewalls` (the XGS128)

3. **Inspect the full JSON response** for any fields like:
   - `assignedProducts`
   - `subscription` / `subscriptions`
   - `features` / `modules`
   - `license` / `licensing`
   - Any nested objects we haven't mapped

4. **Decide next steps** based on findings:
   - If licence fields exist: map them into the `central_firewalls` table and show in `CentralEnrichment`
   - If not: fall back to one of the alternative approaches (infer from HTML, keep tenant-level, or remove)
