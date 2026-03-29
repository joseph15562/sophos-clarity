# PSA customer ↔ company mapping — dropdown UX

**Context:** [ConnectWiseManageSettings.tsx](../src/components/ConnectWiseManageSettings.tsx) mapping block today uses **two free-text fields** (FireComply customer name + Manage company ID). That avoids extra API calls but is error-prone.

## ConnectWise Manage — plan requirement (this integration)

- **Left field (“FireComply customer name”):** Ship as a **dropdown or searchable combobox**, not a plain text input. Options = org customers (resolved names) per **Data source** below; optional **“Custom…”** row to type a name that is not in the list.
- **Right field (“Manage company ID”):** Remains **numeric entry** until `GET /api/connectwise-manage/companies` exists; then upgrade to combobox per **Should Manage company ID be a dropdown?** below.

## Should FireComply customer be a dropdown?

**Yes, when possible.** The value stored in `psa_customer_company_map.customer_key` must still be the **resolved customer label** (same string as the Customers page / `resolveCustomerName`), not an arbitrary alias.

**Data source (client or small Edge helper):**

- Reuse the same **inputs as CustomerManagement**: latest `assessments` for the org (distinct `customer_name` → resolved with `resolveCustomerName(..., org.name)`), plus **central tenants / agents** if you want tenants with no assessment yet—mirror the aggregation logic in [CustomerManagement.tsx](../src/pages/CustomerManagement.tsx) or extract a shared `useOrgCustomerNames(orgId, orgName)` hook that returns sorted unique strings.
- UI: **Combobox** (searchable select) via shadcn `Popover` + `Command`, or `Select` if the list stays small; allow **“Custom…”** fallback for edge cases (one-off names not in the list) so power users are not blocked.

## Does the tool pull Manage company IDs today?

**No.** Nothing in the repo calls ConnectWise Manage to **list companies**. Only **ticket create** uses a company id the user typed (or mapping).

## Should Manage company ID be a dropdown?

**Yes, if we add a read API.** Implement:

1. **Edge (admin JWT):** `GET /api/connectwise-manage/companies`
   - Load org credentials from `connectwise_manage_credentials`, decrypt keys, call Manage REST **Companies** query endpoint (e.g. `GET {base}/company/companies` with appropriate `conditions` / `pageSize` per [ConnectWise Manage REST](https://developer.connectwise.com/products/manage/rest)).
   - Return a bounded list: `{ id: number, name: string, identifier?: string }[]` (cap page size, e.g. 500; optional `?q=` server-side filter for typeahead).
2. **Shared helper:** e.g. `connectWiseManageListCompanies(...)` in [connectwise-manage.ts](../supabase/functions/_shared/connectwise-manage.ts) (same Basic auth as ticket create).
3. **UI:** Combobox searchable by **name**; store **numeric id** in the mapping. Loading/error states when Manage is unreachable; **manual numeric entry** fallback if the API fails or the company is outside the first page (document limitation).

**Risks:** Large estates, API rate limits, and permission scopes on the API member—handle HTTP errors and empty results clearly.

## Autotask (Datto) parity

When the **Autotask PSA MVP** ships (Cursor plan / engineering backlog), use the **same pattern**:

- FireComply customer: **same dropdown source** (org customers).
- Autotask company/account: **GET** companies/accounts from Autotask REST (after spike) → combobox + optional manual ID fallback.

## Suggested sequencing

1. **ConnectWise:** Replace the mapping **left box** with **customer dropdown/combobox** in `ConnectWiseManageSettings` (no Manage API dependency).
2. **ConnectWise:** **Manage companies** Edge route + replace **right box** with company combobox (keep manual ID fallback).
3. **Autotask:** Reuse the same customer control; add PSA-specific company list when Autotask MVP lands.

_Updated: 2026-03-29._
