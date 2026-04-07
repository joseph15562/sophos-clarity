# Richer workspace tours — full coverage, detailed walkthroughs

## Goal

- **Every routable page** in the app gets its own **detailed** guided tour (multiple highlighted regions per screen, outcome-focused copy), not a single `<main>` spotlight.
- **No “later phase” scope cut**: implementation may be done in any commit order, but the **deliverable is complete coverage** of the inventory below.

## Current state (baseline)

- Hub tours use [`driveHubPageTour`](src/lib/guided-tours.ts): thin sequence ending in one full-page highlight.
- [`getWorkspacePageTourMeta`](src/lib/guided-tours.ts) omits several routes (`/shared/*`, `/portal/*`, `/upload/*`, `/team-invite/*`, `/preview`) — those pages currently have **no** “This page” tour entry.
- All `/central/*` paths share one Central starter; sub-pages are not differentiated.

## “Detailed” bar

- **Dense dashboards** (Mission control, Fleet, Customers, Reports, Insights, Assess, API hub if long): aim for **8–12 steps** (shell + intro optional + **≥6 in-page regions**).
- **List / operational pages** (each Central sub-route, Drift, Playbooks, Changelog, Trust, Audit, Health check landing/results contexts): **6–9 steps**.
- **Narrow flows** (saved report viewer, shared report, client portal, config upload, team invite, shared health check, theme preview, Not found): **4–7 steps** — still multi-region, not a single main blob; split header, primary content, and key actions.
- Use **optional modal step** (popover without `element`) only where it adds a clear “what you’re looking at” frame; avoid filler.
- Keep **`filterVisible`** so missing anchors (guest, unsigned-in, conditional empty states) drop steps without breaking the tour.

## Complete route inventory (each needs a dedicated tour + `getWorkspacePageTourMeta` mapping)

Source: [`src/App.tsx`](src/App.tsx) routes.

| Path pattern                              | Page / component                                                     | Notes                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                       | [`Index`](src/pages/Index.tsx) (Assess)                              | Compose with existing `data-tour` (upload, context, reports, agent fleet, analysis tabs, priority actions, etc.) + any new section anchors.             |
| `/dashboard`                              | [`MissionControlPage`](src/pages/MissionControlPage.tsx)             | KPI row, activity chart, recent alerts, top risk, fleet health, quick actions, recent docs if present.                                                  |
| `/command`                                | [`FleetCommand`](src/pages/FleetCommand.tsx)                         | Settings strip, jump bar, stat cards, drop hint, list/map tabs, search/filter, card grid or map.                                                        |
| `/customers`                              | [`CustomerManagement`](src/pages/CustomerManagement.tsx)             | Summary strip, portfolio pulse, jump bar, filters, directory/table, onboarding CTA.                                                                     |
| `/central` → `overview`                   | [`CentralOverview`](src/pages/central/CentralOverview.tsx)           | Not-connected CTA vs stats, hub link grid, sync/summary blocks.                                                                                         |
| `/central/tenants`                        | [`CentralTenantsPage`](src/pages/central/CentralTenantsPage.tsx)     | Table + actions + any sync/refresh UI.                                                                                                                  |
| `/central/firewalls`                      | [`CentralFirewallsPage`](src/pages/central/CentralFirewallsPage.tsx) | Filters, inventory table, row actions.                                                                                                                  |
| `/central/alerts`                         | [`CentralAlertsPage`](src/pages/central/CentralAlertsPage.tsx)       | Feed/table, severity, links to investigate.                                                                                                             |
| `/central/mdr`                            | [`CentralMdrFeedPage`](src/pages/central/CentralMdrFeedPage.tsx)     | Feed layout, filters if any.                                                                                                                            |
| `/central/groups`                         | [`CentralGroupsPage`](src/pages/central/CentralGroupsPage.tsx)       | Groups list + detail pattern.                                                                                                                           |
| `/central/licensing`                      | [`CentralLicensingPage`](src/pages/central/CentralLicensingPage.tsx) | SKU / device summary regions.                                                                                                                           |
| `/central/sync`                           | [`CentralSyncPage`](src/pages/central/CentralSyncPage.tsx)           | Sync status, connector/API hints.                                                                                                                       |
| `/central/firewall/:tenantId/:firewallId` | [`CentralFirewallPage`](src/pages/central/CentralFirewallPage.tsx)   | Header/meta, health, links back to fleet.                                                                                                               |
| `/drift`                                  | [`DriftMonitor`](src/pages/DriftMonitor.tsx)                         | All meaningful states: loading, empty, main (selector, timeline/history, diff highlights).                                                              |
| `/reports`                                | [`ReportCentre`](src/pages/ReportCentre.tsx)                         | Stats row, filters, library, sidebar/scheduled if present.                                                                                              |
| `/reports/saved/:id`                      | [`SavedReportViewer`](src/pages/SavedReportViewer.tsx)               | Breadcrumb, document chrome, export/share if present.                                                                                                   |
| `/insights`                               | [`PortfolioInsights`](src/pages/PortfolioInsights.tsx)               | Header, risk strip, time range, major sections (threat, widgets, etc.).                                                                                 |
| `/playbooks`                              | [`PlaybookLibrary`](src/pages/PlaybookLibrary.tsx)                   | Search/filter, categories, list/cards.                                                                                                                  |
| `/api`                                    | [`ApiHub`](src/pages/ApiHub.tsx)                                     | Sectioned layout: keys, docs links, examples — **multiple anchors** (this page is long).                                                                |
| `/audit`                                  | [`AuditPage`](src/pages/AuditPage.tsx)                               | Page actions, log surface, drawer cross-link.                                                                                                           |
| `/trust`                                  | [`TrustPage`](src/pages/TrustPage.tsx)                               | Trust sections (security, privacy, subprocessors, etc.) — **≥3 content regions**.                                                                       |
| `/changelog`                              | [`ChangelogPage`](src/pages/ChangelogPage.tsx)                       | Overview panels, history, key CTAs.                                                                                                                     |
| `/health-check`                           | [`HealthCheck`](src/pages/health-check/…)                            | Extend beyond today’s [`startHealthCheckTour`](src/lib/guided-tours.ts) / results tour with **more granular** `data-tour` regions on landing + results. |
| `/health-check/shared/:token`             | Shared health viewer                                                 | Tour for read-only consumer: what they see, how to use export if any.                                                                                   |
| `/shared/:token`                          | [`SharedReport`](src/pages/SharedReport.tsx) (or lazy chunk)         | Public report: header, report body, any download.                                                                                                       |
| `/portal/:tenantId`                       | [`ClientPortal`](src/pages/ClientPortal.tsx)                         | Tenant-facing UI regions.                                                                                                                               |
| `/upload/:token`                          | [`ConfigUpload`](src/pages/ConfigUpload.tsx)                         | Upload dropzone, instructions, status.                                                                                                                  |
| `/team-invite/:token`                     | [`TeamInviteAccept`](src/pages/TeamInviteAccept.tsx)                 | Invite copy, accept form, sign-in.                                                                                                                      |
| `/preview`                                | [`ThemePreview`](src/pages/ThemePreview.tsx)                         | Theme controls + preview panels.                                                                                                                        |
| `*`                                       | [`NotFound`](src/pages/NotFound.tsx)                                 | Short but **multi-step**: message, home CTA, shortcuts.                                                                                                 |

## Implementation mechanics

1. **`runHubPageTour(pageSteps, opts)`** in [`src/lib/guided-tours.ts`](src/lib/guided-tours.ts): optional workspace nav, optional Central subnav, page steps, shortcuts, management — then `createTour` + `drive`.
2. **Prefix convention** for new anchors: `tour-mc-*`, `tour-fleet-*`, `tour-cust-*`, `tour-reports-*`, `tour-ins-*`, `tour-central-<screen>-*`, `tour-drift-*`, `tour-hc-*`, `tour-shared-*`, etc.
3. **`getWorkspacePageTourMeta`**: one `start…` function (or router) per **row** in the table above; **remove** the old “null for token routes” policy for `/shared`, `/portal`, `/upload`, `/team-invite`, `/preview` once those pages have anchors.
4. **GuidedTourButton**: keep a single **This page** item; it must resolve correctly for **all** paths in the inventory (labels can shorten for mobile if needed).
5. **Scroll / layout**: add `scroll-mt-*` on anchored sections if driver highlights sit under fixed headers after implementation.
6. **Changelog**: update [`src/pages/ChangelogPage.tsx`](src/pages/ChangelogPage.tsx) **2026-04** with a bullet stating full-route detailed tours.

## Files touched (expected)

- [`src/lib/guided-tours.ts`](src/lib/guided-tours.ts) — all starters, meta router, helpers.
- [`src/pages/**/*.tsx`](src/pages/) and [`src/pages/central/**/*.tsx`](src/pages/central/) — `data-tour` on section wrappers.
- Token/special pages under [`src/pages/`](src/pages/) (SharedReport, ClientPortal, ConfigUpload, TeamInviteAccept, ThemePreview, SharedHealthCheck) — same.
- Possibly small layout components if tours need stable anchors not tied to page files.
- [`src/pages/ChangelogPage.tsx`](src/pages/ChangelogPage.tsx).

## Sync

After edits, mirror this file to `~/.cursor/plans/` if a paired plan name is used locally (team rule).
