# Fleet firewall compliance context (implemented)

MSP-set **country** and **US state** per firewall; **sector** (environment) per **customer** (Sophos Central tenant or agent customer bucket). Persisted in Supabase, shown as chips on each fleet row, surfaced on Customer Management for countries, and applied when opening Assess from Fleet.

## Database

- Migration: [`supabase/migrations/20260331193100_firewall_compliance_context.sql`](../../supabase/migrations/20260331193100_firewall_compliance_context.sql) (unique version — avoids clash with `20260330120000_agent_submissions_org_created.sql`)
- Migration: [`supabase/migrations/20260331204500_compliance_environment_customer_scope.sql`](../../supabase/migrations/20260331204500_compliance_environment_customer_scope.sql) — **`central_tenants.compliance_environment`**, **`agent_customer_compliance_environment`**, RPC **`update_agent_compliance_context(uuid, text, text)`** (jurisdiction only)
- Migration: [`supabase/migrations/20260331220000_customer_compliance_country.sql`](../../supabase/migrations/20260331220000_customer_compliance_country.sql) — **`compliance_country`** on **`central_tenants`** and **`agent_customer_compliance_environment`**
- Columns on **`central_firewalls`** / **`agents`**: `compliance_country`, `compliance_state`; legacy **`compliance_environment`** on those rows is optional fallback only
- RPC **`update_agent_compliance_context`**: country/state only; sector via **`agent_customer_compliance_environment`**

## App

- Shared options: [`src/lib/compliance-context-options.ts`](../../src/lib/compliance-context-options.ts) (countries, states, environments, `getDefaultFrameworks`, `countryFlagEmoji`)
- Fleet bundle: [`src/lib/fleet-command-data.ts`](../../src/lib/fleet-command-data.ts) — `FleetFirewall` + mapping
- Save helper: [`src/lib/fleet-firewall-compliance.ts`](../../src/lib/fleet-firewall-compliance.ts)
- UI: [`src/pages/FleetCommand.tsx`](../../src/pages/FleetCommand.tsx) — `DetailPanel` compliance block, row chips (`ComplianceContextChips` inside source badges), `/?fleetContext=` on **View Assessment**
- Assess hydrate: [`src/pages/Index.tsx`](../../src/pages/Index.tsx) — deep-link effect
- Customers: [`src/lib/customer-directory.ts`](../../src/lib/customer-directory.ts) — aggregate countries

Apply with **`supabase db push`** (or your usual migration path) before relying on saves in production.
