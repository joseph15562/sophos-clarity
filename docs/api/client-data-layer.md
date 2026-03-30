# Client data layer (TanStack Query vs direct Supabase)

**Policy:** Prefer **`useQuery` / `useMutation`** with stable keys from [`src/hooks/queries/keys.ts`](../../src/hooks/queries/keys.ts) for server-backed reads and writes. Pass **`signal`** into `fetch` when using `useQuery` so navigation unmounts cancel in-flight requests.

## Intentional exceptions (direct Supabase / `fetch`)

| Area                            | Why not Query (yet)                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth session**                | `supabase.auth.getSession()` is synchronous-ish orchestration; not cached as entity lists.                                                         |
| **Large wizards / mega-panels** | e.g. SE Health Check inner model: incremental migration; some paths still use `fetch` + Supabase in one hook (`use-health-check-inner-state.tsx`). |
| **One-off mutations**           | Simple `.update` / `.delete` where invalidation is wired manually — prefer wrapping in `useMutation` when touching lists shown elsewhere.          |

**Migrated:** **PortalConfigurator** tenant list + `portal_config` rows use **`useQuery`** (`queryKeys.portal.tenantBootstrap`) + **`invalidateQueries`** on save (`PortalConfigurator.tsx`). **SavedReportsLibrary** uses **`useQuery`** / **`useMutation`** with **`queryKeys.savedReports.packages(scope, refreshEpoch)`** (cloud = org id, local = `"local"`; parent bumps `refreshTrigger` after save). **InviteStaff** loads **`org_invites` + `org_members`** via **`useOrgTeamRosterQuery`** (`queryKeys.org.teamRoster(orgId)`); invite / revoke / remove **`invalidateQueries`** on that key.

**Management drawer:** PSA / service-key **presence flags** use **`useOrgPsaIntegrationFlagsQuery`** (`queryKeys.org.psaIntegrationFlags`); **`invalidateQueries`** when a PSA setup modal closes. **Data governance** retention copy uses **`useOrgSubmissionRetentionQuery`** (`queryKeys.org.submissionRetention`).

**Customer Management:** directory rows (assessments + tenants + agents + portal slugs) use **`useCustomerDirectoryQuery`** (`queryKeys.org.customerDirectory`); **`fetchCustomerDirectory`** lives in **`src/lib/customer-directory.ts`**. **invalidateQueries** after customer delete and after **PortalConfigurator** save.

**Search debouncing:** **CustomerManagement** filters the in-memory customer list using **`useDebouncedValue`** (`src/hooks/use-debounced-value.ts`, 300ms) so typing in search does not thrash heavy **`useMemo`** work on large lists.

## Inventory (prioritised follow-ons)

High-traffic reads still on **`useEffect` + `supabase`** or ad-hoc **`fetch`** (non-exhaustive — run `rg 'supabase\\.from' src` and `rg '\\bfetch\\(' src` periodically):

| Priority | Surface                                                    | Notes                                                                                                                        |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| P1       | **`FleetCommand.tsx`**                                     | Large aggregate **`Promise.all`** (~6 tables) + mapping; extract **`loadFleetForOrg`** + **`useQuery`** when touching fleet. |
| P1       | **`ManagementDrawer`** lazy sections                       | Many child panels still own direct Supabase; migrate per panel when editing.                                                 |
| P2       | **`use-company-logo`**, **`use-health-check-inner-state`** | Intentional exceptions today; move reads to Query when safe.                                                                 |

Update this table when you migrate a screen to Query or add a new exception with a one-line rationale.
