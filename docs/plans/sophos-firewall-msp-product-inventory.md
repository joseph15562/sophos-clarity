# Sophos Firewall MSP product — inventory and roadmap

**Role:** Product manager review (Sophos Firewall / partner MSP context)  
**Repo:** Sophos FireComply (`sophos-firecomply`)  
**Scope:** Whole-project snapshot of **what ships today** vs **gaps**, so roadmap and resourcing align with MSP and firewall outcomes.

**Related docs (already in repo):** [PRODUCT-ASSESSMENT.md](../PRODUCT-ASSESSMENT.md), [ROADMAP.md](../ROADMAP.md), [TENANT-MODEL.md](../TENANT-MODEL.md), [DATA-PRIVACY.md](../DATA-PRIVACY.md), `docs/plans/*` (deep dives).

**Gaps → execution planning:** [sophos-firewall-gaps-and-improvements-roadmap.md](./sophos-firewall-gaps-and-improvements-roadmap.md) (phased epics, acceptance criteria, dependencies).  
**All epics at a glance:** [sophos-firewall-master-execution.md](./sophos-firewall-master-execution.md) (G1.1–G1.6, G2.x, G3.x + X1–X4 tables and sequencing).

---

## 1. Executive summary

FireComply is a **Sophos firewall configuration assessment and reporting** product: deterministic analysis on HTML exports, optional AI-authored reports, **Sophos Central** sync for inventory/context, **connector agents** for scheduled pull + submission, **multi-org auth**, **client portal**, and **MSP-oriented** routes (Fleet, Customers, portfolio insights, drift, saved report library).

**Strong fit for MSPs:** repeatable assessments, branding, multi-customer navigation, fleet and customer views, shareable outputs, webhook/alert hooks.

**Not claimed (correctly):** live firewall management, authoritative certification, or replacement for formal audit. Positioning remains **evidence and consultancy workflow**, not SOAR.

---

## 2. Surface map — routes (`src/App.tsx`)

| Route                         | Purpose                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `/`                           | **Assess** — main workbench: upload/sync configs, analysis tabs, reports, management drawer   |
| `/command`                    | **Fleet** — cross-customer / fleet command view                                               |
| `/customers`                  | **Customer management** — per-customer posture, portal, assessments                           |
| `/reports`                    | **Report Centre** — saved reports library rows + links                                        |
| `/reports/saved/:id`          | **Saved report viewer** — packaged PDF-style view, jump nav                                   |
| `/insights`                   | **Portfolio intelligence** — cross-customer analytics (assessments + score history)           |
| `/drift`                      | **Drift monitor** — change-oriented view                                                      |
| `/playbooks`                  | **Remediation playbooks** — standalone library (best-practice checks)                         |
| `/api`                        | **API & integrations hub** — integrations cards, API explorer, webhooks UI, agent fleet table |
| `/health-check`               | **SE Health Check** — separate Sophos SE workflow (profiles, teams, structured health checks) |
| `/health-check/shared/:token` | Shared health check                                                                           |
| `/portal/:tenantId`           | **Client portal** (tenant slug / id)                                                          |
| `/upload/:token`              | **Config upload** (customer token)                                                            |
| `/shared/:token`              | **Shared report** (token)                                                                     |
| `/team-invite/:token`         | Team invite accept                                                                            |
| `/preview`                    | Theme preview (internal/dev)                                                                  |

**Global chrome:** [AppHeader](src/components/AppHeader.tsx) nav links Assess, Fleet, Customers, Reports, Insights, Drift, Playbooks, API; org button opens **management drawer** (only on Assess — see §4).

---

## 3. Core firewall assessment (Assess `/`)

**In place**

- **Ingest:** HTML config export upload; Central-linked firewall sync; config upload flow; connector-submitted configs (`agent_submissions` with `raw_config`, `full_analysis`).
- **Parsing / analysis:** Large deterministic engine (`analyse-config`, extract pipeline), findings, risk score, grades (aligned with `gradeForScore` in design tokens for saved assessments).
- **UI tabs** ([AnalysisTabs](src/components/AnalysisTabs.tsx)): Overview (estate, rule health, SLA gauge, remediation velocity, score simulator, etc.), Security Analysis, Compliance (heatmap, posture ring, gap widget), Optimisation, Tools, Remediation (progress, roadmap, playbooks tied to findings), Compare/diff, Insurance readiness (where enabled).
- **Reports:** Per-firewall technical, executive, compliance packs; exports (DOCX/HTML/PPTX/ZIP per product); save to cloud (`saved_reports`); pre-AI save path.
- **Session:** Auto-save, restore, local mode (no AI/Central, browser storage).
- **Deep links:** Customer / upload query params on Index; **`panel` + `section`** for management drawer ([workspace-deeplink](src/lib/workspace-deeplink.ts)).

**Improvement opportunities**

- Parser coverage and version matrix (documented in several `docs/plans/*` and PRODUCT-ASSESSMENT).
- Clearer **first-run MSP checklist** (Central → agent → first save → portal) using the same deep-link contract.

---

## 4. Management drawer (workspace panel)

**Host:** [ManagementDrawer](src/components/ManagementDrawer.tsx) on **Index only**.

**Tabs**

- **Dashboard:** Tenant dashboard, score trend, licence expiry widget.
- **Reports:** Saved reports library (load into workbench).
- **History:** Assessment history, config history.
- **Settings (accordion):** Local mode, branding, Sophos Central API, connector agents, team invites, client portal configurator, security (MFA/passkeys), activity log, alerts (email/webhook rules), integrations webhook URL, scheduled reports, report template, API documentation dialog, data governance.

**Deep links:** `/?panel=<tab>&section=<slug>` opens drawer and expands one settings section when permitted (admin/viewer/local-mode rules).

**Gap:** Heavy **settings** surface is correct for power users; **discoverability** from Fleet/API/Customers depends on links and copy (partially addressed on ApiHub).

---

## 5. Sophos Central integration

**In place**

- Encrypted credentials per org (`central_credentials`); synced tenants (`central_tenants`); firewall inventory (`central_firewalls`); linking config exports to Central devices (`firewall_config_links`).
- Edge function [sophos-central](supabase/functions/sophos-central/index.ts); header status and refresh; Central integration UI in drawer and ApiHub modal.

**Gaps**

- **Operational:** token refresh, error surfacing, multi-region edge cases (notes in `docs/sophos-central-api-notes.md`).
- **PM:** partner-facing **connection health** page or fleet-wide “Central sync stale” banner (some signals exist in UI pieces, not one MSP story).

---

## 6. Connector agents

**In place**

- DB: `agents`, `agent_submissions` (scores, summaries, drift JSON, full analysis); pending commands / Central link migrations.
- Edge: [api-agent](supabase/functions/api-agent/index.ts), agent nudge cron.
- UI: [AgentManager](src/components/AgentManager.tsx) in drawer; [AgentFleetPanel](src/components/AgentFleetPanel.tsx) on Assess; **Agents** tab on ApiHub (fleet table, submission “View logs” sheet, links to drawer + Fleet).

**Gaps**

- **Fleet-wide agent health** (version, repeated failures, queue) as a first-class story.
- **Installer / update** distribution story in-product (buttons are partly placeholder).

---

## 7. MSP multi-customer and portfolio

**In place**

- **Customers** page: per-customer cards, assessments, portal hooks, naming resolution for `(This tenant)` etc.
- **Fleet** page: command-centre style view; comparison and assessment loading patterns.
- **Portfolio insights:** assessments aggregated by resolved customer name, score trend from `score_history`, sector breakdown, at-risk table (grade logic aligned to saved assessments).
- **Drift** page: drift-oriented workflow (submissions/drift JSON).
- Auth: orgs, roles (`org_members`, viewer vs manage), invites.

**Gaps**

- **Single “MSP home”** unifying: stale assessments, critical findings, offline agents, licence expiry — partially scattered across Insights, Fleet, Customers, drawer widgets.
- **PSA** (ConnectWise/Autotask/Halo): webhooks + alert rules exist; **no native PSA objects** or sync status UI.

---

## 8. Reporting, sharing, portal

**In place**

- Saved reports metadata + viewer; shared report tokens (`shared_reports`); org webhooks on save (see `saved-reports` lib).
- **Portal:** `portal_config` (slug, branding, sections); [ClientPortal](src/pages/ClientPortal.tsx); portal data edge function; portal viewers migration (20260327000000).
- Scheduled reports ([send-scheduled-reports](supabase/functions/send-scheduled-reports/index.ts), [ScheduledReportSettings](src/components/ScheduledReportSettings.tsx)).

**Gaps**

- **Customer-facing** narrative: clearer “what the client sees” vs consultant view (some preview exists in drawer Client View dialog).
- **Retention / lifecycle** of saved reports and uploads (plans exist under `docs/plans/retention_*`).

---

## 9. Compliance and remediation

**In place**

- Framework-aware compliance UI and packs; Sophos best-practice scoring; heatmaps and gap widgets.
- **Playbook library** route: static library from best-practice checks; local completion tracking (`localStorage` on that page).
- DB table `remediation_status` (server-side playbook completion — verify end-to-end wiring vs library UI).

**Gaps**

- **Tight loop:** open playbook **from a specific finding** with one click; optional **synced** completion per customer (use `remediation_status` if not fully wired).
- **Regulatory updates** scanner function exists — surface value in UI/MSP messaging.

---

## 10. SE Health Check (parallel product line)

**In place**

- Separate auth domain patterns, teams, profiles, health check records, sharing, config upload requests — see migrations `se_*` and [HealthCheck2](src/pages/HealthCheck2.tsx).

**PM note:** Treat as **sibling SKU / persona**; avoid blurring **firewall assessment** and **SE health check** in nav copy without intentional cross-sell.

---

## 11. API, automation, observability

**In place**

- [api](supabase/functions/api/index.ts), [api-public](supabase/functions/api-public/index.ts), parse-config, Gemini usage tracking tables.
- ApiHub: integrations, API explorer static docs, webhooks URL save (`organisations.webhook_url`), deliveries from `audit_log`, deep links back to drawer.
- [AuditLog](src/components/AuditLog.tsx) in drawer.

**Gaps**

- **Scoped API keys** (org service accounts) for MSP automation.
- **Full-screen audit export** for compliance buyers (drawer is cramped).

---

## 12. Security and governance

**In place**

- MFA and passkeys; org-level MFA requirement flag on organisations; RLS-oriented multi-tenant model; audit_log; DATA-PRIVACY doc.

**Gaps**

- **Trust centre** (subprocessors, DPA, retention) as a public or in-app page for enterprise procurement.

---

## 13. Recommended roadmap themes (prioritised)

1. **MSP command surface** — One home: attention queue + deep links into Customers/Fleet/Assess (reuse existing data; mostly UX + queries).
2. **PSA integration path** — Start with one vendor: ticket from critical finding + customer mapping; keep webhooks for the long tail.
3. **Agent operations** — Health, version, failure reasons, upgrade path in UI.
4. **Evidence pack** — Audit log export + saved report lifecycle documentation in-app.
5. **Remediation closure** — Finding → playbook → optional server-side completion per customer.
6. **API keys + changelog** — Partner integrators and internal velocity.

---

## 14. How to use this doc

- **Engineering:** Pick a theme; trace tables and routes above before adding new pages (avoid duplicating drawer).
- **PM / GTM:** Align deck and pricing with **assessment + reporting + connector + portal**; position SE Health Check separately unless bundling intentionally.
- **Sophos Firewall PM alignment:** Map capabilities to **Central + XG/XGS config review + partner services**; avoid overlap claims with **Central live management** or **MTR**.

---

_Last updated from codebase scan: 2026-03-29._
