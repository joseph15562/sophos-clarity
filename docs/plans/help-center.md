# Help center — setup-style walkthrough + every page

**Cursor UI copy:** mirror basename under `~/.cursor/plans/` if paired.

## Goal

- A routable **`/help`** page that (1) **matches first-time setup visually** (same card shell, progress, Back/Continue) and stays **interactive** (FeatureButton / FeatureOverlay guide panels, no setup form fields).
- (2) **Help for all pages**: every meaningful route in [`src/App.tsx`](src/App.tsx) has a short **purpose line**, **link** to open that screen, and guidance to use **Tours → This page** once there (and optionally a **“Open & tour”** action that navigates then starts the mapped tour when technically reliable).

## Part A — Shared shell + assess deep-dive (unchanged intent)

- Extract **`WalkthroughShell`** (`modal` for [`SetupWizardBody`](src/components/setup-wizard/SetupWizardBody.tsx), `page` for Help).
- Extract the four still-inline sections into **`GuideToolsStep`**, **`GuideManagementStep`**, **`GuideTeamSecurityStep`**, **`GuidePortalAlertsStep`**.
- Help **walkthrough steps** (after the browse index — see Part B): Intro → `GuideUploadStep` → … → extracted guide steps → Outro (no Branding / Central / Connector / wizard Done).

## Part B — Browse help for every route (new)

Avoid dozens of linear “Next” steps for page list. Add a **dedicated first step** (or a **top tab**: “All pages” | “Assess walkthrough”) inside the same card:

### Content source

- Add [`src/data/help-routes.ts`](src/data/help-routes.ts) (or `src/lib/help-routes.ts`) exporting a typed array, e.g. `{ pathPattern, label, group, description }[]`, aligned with [`App.tsx`](src/App.tsx) routes:
  - **Assess & analysis:** `/`
  - **Workspace hub:** `/dashboard`, `/command`, `/customers`
  - **Central:** `/central/overview`, `/central/tenants`, `/central/firewalls`, `/central/alerts`, `/central/mdr`, `/central/groups`, `/central/licensing`, `/central/sync`, plus note for `/central/firewall/:tenantId/:firewallId` (pattern row, no single link)
  - **Reports & insights:** `/reports`, `/reports/saved/:id` (describe as saved viewer; link to `/reports` + explain open-from-library)
  - **Operations:** `/drift`, `/playbooks`, `/api`, `/audit`
  - **Trust & updates:** `/trust`, `/changelog`, `/help` (self)
  - **Health & SE tools:** `/health-check`
  - **Token / guest flows:** `/shared/:token`, `/portal/:tenantId`, `/upload/:token`, `/team-invite/:token`, `/health-check/shared/:token`, `/preview`
  - **Other:** 404 / unknown URL (`*`)

### UI

- **`HelpBrowseByPageStep`**: collapsible **Accordion** or **category headings** + list rows: label, one-line description, `Link` (use concrete paths for static routes; for param routes use example path or `/reports` only where appropriate).
- **Tour CTA**: Text: “On that page: open **Tours** (bottom bar) → **This page**.” Optional button **“Go there”** (`Link`). Optional **“Open & start tour”** only if implementation uses `navigate` + deferred `getWorkspacePageTourMeta(path)?.start()` after the route mounts (test `/dashboard`, `/drift`, `/central/overview`; skip or disable if flaky).

### Maintenance

- When adding routes in `App.tsx`, update the help data file in the same PR (comment in `App.tsx` optional pointer).

## Part C — Routing, nav, tours, changelog

- [`App.tsx`](src/App.tsx): `<Route path="/help" element={<HelpPage />} />`.
- [`WorkspacePrimaryNav.tsx`](src/components/WorkspacePrimaryNav.tsx): **Help** item (e.g. `LifeBuoy`).
- [`guided-tours.ts`](src/lib/guided-tours.ts): `getWorkspacePageTourMeta("/help")` + `startHelpPageTour` with `data-tour` anchors on shell + browse section.
- [`ChangelogPage.tsx`](src/pages/ChangelogPage.tsx): **2026-04** bullet for Help center (all pages + assess walkthrough).

## Out of scope

- No real setup/API forms on Help.
- No duplicate full-page manuals; keep blurbs short; deep interactivity stays in the assess guide steps and on each page’s own tour.

## Implementation todos

1. `WalkthroughShell` + refactor `SetupWizardBody`.
2. Extract four inline guide steps.
3. `help-routes` data + `HelpBrowseByPageStep`.
4. `HelpIntroStep`, `HelpOutroStep`, `HelpPage` composition (browse as step 1 or tab).
5. Route, nav, `startHelpPageTour`, changelog.
