---
name: compliance-framework-mappings
overview: Add missing sectors and countries to the compliance options library, build out comprehensive country-by-sector default framework mappings in `getDefaultFrameworks()`, add region-specific frameworks to `ALL_FRAMEWORKS`, and fix the demo seed data to use valid sector names.
todos:
  - id: add-sectors
    content: Add Logistics & Transport, Manufacturing, Technology & Telecoms, Energy & Utilities to ENVIRONMENT_TYPES
    status: completed
  - id: add-countries
    content: Add Sweden, Italy, Spain, Brazil, Saudi Arabia, Switzerland to COUNTRIES + COUNTRY_TO_FLAG
    status: completed
  - id: add-frameworks
    content: Add 14 new frameworks to ALL_FRAMEWORKS (ASD Essential Eight, APRA CPS 234, MAS TRM, CSA Cyber Trust, NESA IAS, POPIA, DPDPA, PIPEDA, LGPD, PDPA Japan, FISC, Sweden Cybersecurity Act, Swiss FADP, KRITIS/BSI)
    status: completed
  - id: expand-mapping
    content: Rewrite getDefaultFrameworks() with comprehensive country-region + sector mapping logic
    status: completed
  - id: fix-demo-data
    content: Update seed script, demo-central-data.ts, and live DB rows to use 'Logistics & Transport' instead of 'Logistics'
    status: completed
  - id: update-tests
    content: Add test cases for new country/sector framework defaults
    status: in_progress
isProject: false
---

# Add Missing Sectors, Countries, and Compliance Framework Mappings

## Problem

The demo workspace uses sectors ("Logistics", "Manufacturing") and a country ("Sweden") that don't exist in `ENVIRONMENT_TYPES` / `COUNTRIES`. Additionally, `getDefaultFrameworks()` only maps UK, US, and a subset of EU countries — most other countries and several sectors have no framework defaults at all.

## Files to change

- [`src/lib/compliance-context-options.ts`](src/lib/compliance-context-options.ts) — primary target (sectors, countries, flags, framework list, mapping logic)
- [`scripts/seed-demo-workspace.ts`](scripts/seed-demo-workspace.ts) — fix demo to use valid sector names
- [`supabase/functions/_shared/demo-central-data.ts`](supabase/functions/_shared/demo-central-data.ts) — same fix for canned API data
- DB update via Supabase MCP — update existing demo `central_tenants` and `agents` rows to use valid sector names

## 1. Add missing sectors to `ENVIRONMENT_TYPES`

Add to the array:

- **"Logistics & Transport"** (covers Rheinland and general transport/shipping customers)
- **"Manufacturing"** (covers Atlas Global and industrial customers)
- **"Technology & Telecoms"** (common MSP sector, rounds out the list)
- **"Energy & Utilities"** (fills a gap for critical infra sub-sector)

## 2. Add missing countries to `COUNTRIES` and `COUNTRY_TO_FLAG`

Add:

- **"Sweden"** (flag: SE) — used by Nordic Insurance in demo
- **"Italy"** — major EU market, common MSP customer base
- **"Spain"** — major EU market
- **"Brazil"** — largest LATAM market
- **"Saudi Arabia"** — important Middle East market alongside UAE
- **"Switzerland"** — key European market (non-EU)

## 3. Add new frameworks to `ALL_FRAMEWORKS`

New entries needed for the expanded country/sector coverage:

| Framework                      | Countries / Sectors            |
| ------------------------------ | ------------------------------ |
| **"ASD Essential Eight"**      | Australia — all sectors        |
| **"APRA CPS 234"**             | Australia — Financial Services |
| **"MAS TRM"**                  | Singapore — Financial Services |
| **"CSA Cyber Trust"**          | Singapore — all sectors        |
| **"NESA IAS"**                 | UAE — all sectors              |
| **"POPIA"**                    | South Africa — all sectors     |
| **"DPDPA"**                    | India — all sectors            |
| **"PIPEDA"**                   | Canada — all sectors           |
| **"LGPD"**                     | Brazil — all sectors           |
| **"PDPA (Japan)"**             | Japan — all sectors            |
| **"FISC"**                     | Japan — Financial Services     |
| **"Sweden Cybersecurity Act"** | Sweden — all sectors           |
| **"Swiss FADP"**               | Switzerland — all sectors      |
| **"KRITIS / BSI"**             | Germany — Critical Infra / OT  |

## 4. Expand `getDefaultFrameworks()` mapping logic

The function currently only handles UK, US, and a small EU set. The new logic groups countries into regions and adds per-country + per-sector rules:

- **EU countries** (Germany, France, Netherlands, Ireland, Sweden, Italy, Spain): always include `GDPR` + `NIS2`
- **Australia**: `ISO 27001` + `ASD Essential Eight`
- **Canada**: `ISO 27001` + `PIPEDA`
- **New Zealand**: `ISO 27001`
- **Singapore**: `CSA Cyber Trust`; Financial Services adds `MAS TRM`
- **Japan**: `PDPA (Japan)`; Financial Services adds `FISC`
- **India**: `DPDPA`; Financial Services adds `PCI DSS`
- **UAE**: `NESA IAS`; Financial Services adds `PCI DSS`
- **South Africa**: `POPIA`; Financial Services adds `PCI DSS`
- **Brazil**: `LGPD`; Financial Services adds `PCI DSS`
- **Saudi Arabia**: `NESA IAS` (shares Gulf framework model)
- **Switzerland**: `Swiss FADP`, `ISO 27001`

Sector-specific additions (cross-country):

- **"Logistics & Transport"**: add `ISO 27001`; EU adds `NIS2`
- **"Manufacturing"**: add `IEC 62443`; EU adds `NIS2`
- **"Technology & Telecoms"**: add `SOC 2`, `ISO 27001`
- **"Energy & Utilities"**: add `IEC 62443`, `NIST 800-82`; UK adds `NCSC CAF`; EU adds `NIS2`; US adds `NERC CIP`
- **"Housing"**: UK adds `Cyber Essentials / CE+`
- **"Legal"**: add `ISO 27001`; UK adds `SRA` (already covered by base UK)
- **"Non-Profit / Charity"**: add `Cyber Essentials / CE+` (UK); no special framework elsewhere

## 5. Fix demo data sector names

- Change `"Logistics"` to `"Logistics & Transport"` in:
  - `scripts/seed-demo-workspace.ts` (Rheinland customer + firewalls)
  - `supabase/functions/_shared/demo-central-data.ts` (if present — check first)
  - DB: update `central_tenants`, `central_firewalls`, and `agents` rows for Rheinland

- `"Manufacturing"` is being added as-is, so Atlas data is already valid.

## 6. Update the DB for existing demo rows

Run SQL updates via Supabase MCP to change:

- `central_tenants` where `name = 'Rheinland Logistik GmbH'` to `compliance_environment = 'Logistics & Transport'`
- `central_firewalls` and `agents` with environment `'Logistics'` to `'Logistics & Transport'`

## 7. Update tests

- [`src/lib/__tests__/compliance-context-options.test.ts`](src/lib/__tests__/compliance-context-options.test.ts) — add test cases for new country/sector combos to verify framework defaults are returned correctly.
