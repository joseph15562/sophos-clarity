# Full-stack follow-on plan (ops → Tier 3 → Phase 4 → roadmap → platform)

Canonical copy of the **Full backlog sequence** plan for the team (Cursor UI may mirror `~/.cursor/plans/*.plan.md`). **Do not put secrets in this file.**

---

## Phase A — Operations and documentation (ship confidence)

**Goal:** Production behavior matches what the repo implements; docs stop contradicting code.

| Step | Action                                                                                                                                                                                                                                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | **Scheduled reports queue:** Apply migrations (`job_outbox`, `claim_job_outbox_batch`). Deploy **`send-scheduled-reports`** + **`process-job-outbox`**. Schedule **two** crons (enqueue + drain); wire **`CRON_SECRET`** + `Authorization: Bearer` when set. Follow [`docs/job-queue-outline.md`](../job-queue-outline.md) and [`docs/SELF-HOSTED.md`](../SELF-HOSTED.md). |
| A2   | **REVIEW hygiene:** Tier 3 / Scalability rows — no “worker stub only” once the full pipeline is on `main`.                                                                                                                                                                                                                                                                 |
| A3   | **ROADMAP hygiene:** Reconcile **Planned quick wins** and **Phase 4** with what ships; trim duplicates.                                                                                                                                                                                                                                                                    |
| A4   | **Plans sync:** This file lives under `docs/plans/` per repo convention.                                                                                                                                                                                                                                                                                                   |

---

## Phase B — REVIEW Tier 3 (client data layer and perf)

**Goal:** Close documented partials in [`docs/api/client-data-layer.md`](../api/client-data-layer.md) and [`docs/REVIEW.md`](../REVIEW.md) § Tier 3.

| Step | Action                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | **`use-company-logo`**, **`use-health-check-inner-state`:** migrate reads toward Query + **`supabaseWithAbort`** where safe; update **Inventory** in `client-data-layer.md`. |
| B2   | Sweep **`supabase.from`** / **`fetch`** in pages/components → **`src/lib/data/*`** + **`src/hooks/queries/*`** with **`queryKeys`** and **`signal`**.                        |
| B3   | **`React.memo`** on next heavy chart/table leaves after profiling.                                                                                                           |
| B4   | Stable keys: fix **`key={index}`** on reorderable or filtered lists where found.                                                                                             |

---

## Phase C — Phase 4 compliance productization

**Goal:** Reviewer sign-off persistence + UI; extend **`report-export-validation`** + export UX; in-app changelog when user-visible.

| Step | Action                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1   | **Reviewer sign-off:** Scope per org + cloud **`assessments`** row; Postgres + RLS; minimal UI on history/export path; metadata in exports where agreed. |
| C2   | **Validation layer:** Extend **`validateFindingExportMetadata`**; surface issues in export UI (warnings vs gates — product).                             |
| C3   | **`ChangelogPage.tsx`** for shipped compliance UX.                                                                                                       |

---

## Phase D — ROADMAP medium effort (product-prioritized)

| Epic | Target                                                          |
| ---- | --------------------------------------------------------------- |
| D1   | **Assessment trend UX** — **`ScoreTrendChart`** / score history |
| D2   | **Certificate UX** — 60-day horizon, table, or calendar         |
| D3   | **VPN topology diagram** — viz from parsed VPN data             |

---

## Phase E — Master execution: G3.5 XL + X1–X3

| ID          | Work                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| **G3.5 XL** | Expand Helm chart docs (`deploy/helm/sophos-clarity/README.md`).                                    |
| **X1**      | Admin-only deeplink toast + [`src/lib/workspace-deeplink.ts`](../../src/lib/workspace-deeplink.ts). |
| **X2**      | Telemetry catalog for **`trackProductEvent`** / **`spa_page_view`**.                                |
| **X3**      | Playwright staging: **`PLAYWRIGHT_BASE_URL`** workflow or doc.                                      |

---

## Phase F — Explicitly later

- **Server-side PDF** — when product moves off print-dialog ([`docs/pdf-generation-client-ceiling.md`](../pdf-generation-client-ceiling.md)).
