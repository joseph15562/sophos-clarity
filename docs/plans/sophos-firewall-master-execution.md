# Sophos FireComply — master execution plan

**Purpose:** Single place listing **every** roadmap epic (G1.1–G1.6, G2.x, G3.x, X1–X4), sequencing, and file anchors.  
**Detail / acceptance:** [sophos-firewall-gaps-and-improvements-roadmap.md](./sophos-firewall-gaps-and-improvements-roadmap.md)  
**Product map:** [sophos-firewall-msp-product-inventory.md](./sophos-firewall-msp-product-inventory.md)

**Cursor Plans UI:** mirror substantive edits to `~/.cursor/plans/` when using paired plan files.

---

## Source of truth

- **Epic definitions:** [sophos-firewall-gaps-and-improvements-roadmap.md](./sophos-firewall-gaps-and-improvements-roadmap.md)
- **Routes:** [src/App.tsx](../src/App.tsx) — primary app routes include `/`, `/command`, `/customers`, `/insights`, `/reports`, `/playbooks`, `/api`, **`/audit`**, **`/trust`**, **`/changelog`**, `/drift`, `/portal/:tenantId`, `/upload/:token`, `/health-check`, shared links, etc. Drawer audit: [AuditLog.tsx](../src/components/AuditLog.tsx), [audit.ts](../src/lib/audit.ts), full page [AuditPage.tsx](../src/pages/AuditPage.tsx).

---

## Complete G catalog (every epic)

### Horizon 1 — Quick composability

| ID       | Title                                             | Inventory § | One-line target                                                                                                                                                                                         |
| -------- | ------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1.1** | MSP attention / command surface                   | §7          | Single “what needs me today” + deeplinks (stale assessments, offline agents, low scores, optional critical counts); summary only.                                                                       |
| **G1.2** | First-run MSP checklist                           | §3          | Dismissible: Central · agent · save · portal; one CTA per step; workspace deeplinks.                                                                                                                    |
| **G1.3** | Discoverability from Fleet / Customers / Insights | §4          | Workspace settings strip on `/command`, `/customers`, `/insights`; same `panel`/`section` as [workspace-deeplink.ts](../src/lib/workspace-deeplink.ts).                                                 |
| **G1.4** | Central connection health                         | §5          | Banner on Assess + Fleet; disconnected vs stale vs error; link to Central settings.                                                                                                                     |
| **G1.5** | Audit full-screen + export                        | §11         | `/audit` reusing `loadAuditLog`; drawer “Open full screen”.                                                                                                                                             |
| **G1.6** | Persist Prepared By / report footer               | §3          | Org `report_template` merge (like `company_logo`); load on Index; debounced save from setup/branding; watch [ReportTemplateSettings](../src/components/ReportTemplateSettings.tsx) full-JSON overwrite. |

### Horizon 2 — Product depth

| ID       | Title                               | Inventory § | One-line target                                                                          |
| -------- | ----------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| **G2.1** | Agent operations dashboard          | §6          | Version, failure rate, errors, filters; api-agent + AgentFleetPanel.                     |
| **G2.2** | Installer / update honesty          | §6          | Real URLs or “contact for installer”; no dead CTAs.                                      |
| **G2.3** | Remediation loop                    | §9          | Finding → playbook; optional `remediation_status`; server-backed library when signed in. |
| **G2.4** | Portal client vs consultant clarity | §8          | Preview/tabs + live `/portal/:slug` from configurator.                                   |
| **G2.5** | Regulatory scanner visible          | §9          | Last run, summary, links; regulatory-scanner function.                                   |
| **G2.6** | Saved reports retention / lifecycle | §8          | UI + copy aligned with cron/jobs; DATA-PRIVACY.                                          |

### Horizon 3 — Strategic platform

| ID       | Title                  | Inventory §        | One-line target                                                                                            |
| -------- | ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **G3.1** | PSA (first vendor)     | §7                 | Tickets, customer mapping, idempotency, audit.                                                             |
| **G3.2** | Scoped API keys        | §11                | Table, Edge validation, rotate/revoke UI.                                                                  |
| **G3.3** | Trust centre           | §12                | `/trust`, subprocessors, [DATA-PRIVACY.md](../DATA-PRIVACY.md) (repo).                                     |
| **G3.4** | Parser version matrix  | §3                 | [SUPPORTED-SFOS-VERSIONS.md](../SUPPORTED-SFOS-VERSIONS.md) + `/supported-sfos-versions.md` + upload link. |
| **G3.5** | Self-hosted (optional) | PRODUCT-ASSESSMENT | [SELF-HOSTED.md](../SELF-HOSTED.md) runbook baseline; helm XL.                                             |

### Cross-cutting

| ID     | Theme                                    |
| ------ | ---------------------------------------- |
| **X1** | Role-aware toast on admin-only deeplink. |
| **X2** | Telemetry funnel.                        |
| **X3** | Playwright E2E on staging.               |
| **X4** | Changelog / What’s new.                  |

---

## Already shipped (foundation + Phase A)

- [workspace-deeplink.ts](../src/lib/workspace-deeplink.ts)
- [Index.tsx](../src/pages/Index.tsx) + [ManagementDrawer.tsx](../src/components/ManagementDrawer.tsx) URL open / settings section scroll
- [ApiHub.tsx](../src/pages/ApiHub.tsx) workspace links + API docs dialog

**Horizon 1 (G1.1–G1.6) — shipped**

| ID   | Anchors                                                                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1.1 | [MspAttentionSurface.tsx](../src/components/MspAttentionSurface.tsx), [msp-attention.ts](../src/lib/msp-attention.ts), Index                                                                                                                    |
| G1.2 | [MspSetupChecklist.tsx](../src/components/MspSetupChecklist.tsx)                                                                                                                                                                                |
| G1.3 | [WorkspaceSettingsStrip.tsx](../src/components/WorkspaceSettingsStrip.tsx) on [FleetCommand](../src/pages/FleetCommand.tsx), [CustomerManagement](../src/pages/CustomerManagement.tsx), [PortfolioInsights](../src/pages/PortfolioInsights.tsx) |
| G1.4 | [CentralHealthBanner.tsx](../src/components/CentralHealthBanner.tsx) on Index + Fleet                                                                                                                                                           |
| G1.5 | `/audit` [AuditPage.tsx](../src/pages/AuditPage.tsx), [AuditLog.tsx](../src/components/AuditLog.tsx)                                                                                                                                            |
| G1.6 | Org `report_template` on Index; merge with [ReportTemplateSettings](../src/components/ReportTemplateSettings.tsx)                                                                                                                               |

**X4** — [ChangelogPage.tsx](../src/pages/ChangelogPage.tsx), route `/changelog`.

**Phase B (H2) — shipped in repo (2026-03)**

| ID   | Anchors                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G2.1 | [api-agent](../supabase/functions/api-agent/index.ts) `connector_version`; migration `20260329120000_agent_connector_version.sql`; [AgentFleetPanel.tsx](../src/components/AgentFleetPanel.tsx), [connector-version.ts](../src/lib/connector-version.ts), ApiHub agents table |
| G2.2 | [ApiHub.tsx](../src/pages/ApiHub.tsx) installer matrix + workspace link to connector settings                                                                                                                                                                                 |
| G2.3 | [playbook-link.ts](../src/lib/playbook-link.ts), [EstateOverview.tsx](../src/components/EstateOverview.tsx), [PlaybookLibrary.tsx](../src/pages/PlaybookLibrary.tsx) + `remediation_status` upsert                                                                            |
| G2.4 | [PortalConfigurator.tsx](../src/components/PortalConfigurator.tsx) consultant / customer tabs + live portal link                                                                                                                                                              |
| G2.5 | [RegulatoryDigestSettings.tsx](../src/components/RegulatoryDigestSettings.tsx), ManagementDrawer **Regulatory digest**                                                                                                                                                        |
| G2.6 | ManagementDrawer **Data governance** retention copy + DATA-PRIVACY pointer                                                                                                                                                                                                    |

**Phase C (H3) — partial**

| ID   | Anchors                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G3.1 | ManagementDrawer **PSA & API automation** — ConnectWise-first narrative (OAuth/tickets TBD)                                                                                                                                                                                                                                                                               |
| G3.2 | `org_service_api_keys` migration; [\_shared/service-key.ts](../supabase/functions/_shared/service-key.ts), [api/routes/service-key.ts](../supabase/functions/api/routes/service-key.ts) ping; [firewalls.ts](../supabase/functions/api/routes/firewalls.ts) optional service key + `api:read`; [OrgServiceKeysSettings.tsx](../src/components/OrgServiceKeysSettings.tsx) |
| G3.3 | [TrustPage.tsx](../src/pages/TrustPage.tsx) subprocessors + retention sections                                                                                                                                                                                                                                                                                            |
| G3.4 | [docs/SUPPORTED-SFOS-VERSIONS.md](../SUPPORTED-SFOS-VERSIONS.md), [public/supported-sfos-versions.md](../public/supported-sfos-versions.md), UploadSection link                                                                                                                                                                                                           |
| G3.5 | [docs/SELF-HOSTED.md](../SELF-HOSTED.md)                                                                                                                                                                                                                                                                                                                                  |

**Phase D — cross-cutting**

| ID  | Anchors                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1  | [workspace-deeplink.ts](../src/lib/workspace-deeplink.ts) `settingsSectionExpandAllowed`; Index deep-link toast for any blocked section (not viewer-only); [AuditPage.tsx](../src/pages/AuditPage.tsx) “Open in workspace drawer” |
| X2  | [product-telemetry.ts](../src/lib/product-telemetry.ts) `VITE_ANALYTICS_INGEST_URL`; funnel events (Central, saves, checklist, first agent)                                                                                       |
| X3  | [e2e/smoke.spec.ts](../e2e/smoke.spec.ts); [playwright.config.ts](../playwright.config.ts) `PLAYWRIGHT_BASE_URL` for staging                                                                                                      |

---

## Sequencing

**Phase A (H1):** Complete (G1.1–G1.6, X4).

**Phase B (H2):** G2.1 → G2.2; G2.3 → G2.4 (soft); G2.5, G2.6 as capacity allows.

**Phase C (H3):** G3.1–G3.5 separate initiatives (vendor, legal, security).

**Phase D:** X1, X2, X3 ongoing.

Roadmap mermaid: [sophos-firewall-gaps-and-improvements-roadmap.md](./sophos-firewall-gaps-and-improvements-roadmap.md) (Suggested sequencing).

---

## Next engineering focus

1. **G3.1** — ConnectWise (or chosen PSA) OAuth, ticket create, idempotency, audit entries (legal + sandbox).
2. **G3.2** — Self-serve key issuance/revoke UI; expand service-key auth to additional routes per scope matrix.
3. **G3.5 / XL** — Container/Helm packaging if customers require on-prem images.

---

## Maintenance

When an epic ships, note it in the gaps roadmap **Done** section or with PR links. Keep this file aligned with [App.tsx](../src/App.tsx) and nav.

_Updated: 2026-03-29 — Phase B–D implementation pass; H1 + H2 shipped tables; H3 partial._
