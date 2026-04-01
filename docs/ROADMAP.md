# Sophos FireComply — Roadmap & Feature Log

> Last updated: 1 April 2026

---

## Completed Features

### Core Platform

- **HTML Report Parser** — Parses Sophos XGS firewall HTML exports (V1 and V2 formats), extracting 150+ configuration sections into structured data using DOMParser
- **Multi-Firewall Support** — Upload and analyse multiple firewall exports simultaneously with per-firewall and aggregated results
- **Data Anonymisation** — Client-side anonymisation of IP addresses, hostnames, and customer identifiers before any data leaves the browser
- **Session Persistence** — Auto-saves branding, reports, and active state to localStorage for 24-hour recovery
- **Assessment Context** — Optional customer name, environment, country, and compliance framework tagging before generating reports
- **Local (air-gapped) mode** — Optional mode: parsing and scoring stay in the browser (IndexedDB); disables cloud AI and Sophos Central in the UI

### AI-Powered Reports

- **Individual Technical Reports** — Per-firewall detailed analysis via Gemini AI (streamed SSE through Supabase Edge Function)
- **Executive Brief** — Multi-firewall summary report for management stakeholders
- **Compliance Evidence Pack** — Framework-mapped evidence document (Cyber Essentials, ISO 27001, NIST, PCI DSS, NIS2, NCSC CAF)
- **Document Preview** — Markdown-rendered report viewer with print/export support
- **AI Chat Panel** — Lightweight contextual chat using a dedicated Supabase Edge Function mode with compact context (analysis findings + stats, not full config)

### Deterministic Analysis Engine

- **Firewall Rule Analysis** — Detects disabled rules, overly permissive "ANY" services, missing web filtering, missing app control, missing IPS, logging disabled, broad source/destination networks
- **SSL/TLS Inspection Analysis** — Parses SSL/TLS decrypt rules, identifies zone coverage gaps for WAN-bound traffic
- **NAT Rule Analysis** — Detects DNAT rules exposing services to WAN without IPS
- **Web Filter Policy Analysis** — Checks for default/uncustomised policies, missing HTTPS scanning
- **IPS Policy Analysis** — Detects "Monitor Only" mode, disabled categories, outdated signatures
- **Virus Scanning Analysis** — Checks dual-engine mode and scan-mode settings; flags malware scanning **disabled for HTTP/SMTP/POP3/IMAP** (and related) when those rows appear in the scan settings export
- **Local Service ACL Analysis** — Flags admin services (HTTPS, SSH) exposed to WAN
- **Admin Settings Analysis** — Checks password complexity, login lockout, login disclaimer
- **Backup & Restore Analysis** — Detects missing scheduled backups
- **Notification Settings Analysis** — Checks email notification configuration
- **Pattern Download Analysis** — Verifies automatic pattern updates are enabled
- **NTP/Time Settings Analysis** — Checks NTP synchronisation configuration
- **Authentication Server Analysis** — Verifies encrypted LDAP/RADIUS connections
- **Hotfix Analysis** — Checks auto-apply hotfix status
- **Synchronized App Control** — Detects if Security Heartbeat app identification is enabled
- **ATP / Sophos X-Ops Analysis** — Checks Advanced Threat Protection status and policy action
- **High Availability Analysis** — Detects HA mode (Active-Passive/Active-Active), node name, cluster status
- **DoS & Spoof Protection** — Finds missing DoS/spoof sections in the export, disabled SYN flood protection, and disabled IP spoof prevention (`analyseDoSProtection` in `src/lib/analysis/domains/vpn-network.ts`, invoked from `analyse-config.ts`). Section matching uses parsed headings (e.g. DoS / spoof-related blocks), not a single fixed `DoSSettings` key name across all export shapes
- **VPN Security** — For **IPsec** profiles in use: weak Phase 1/2 encryption or authentication, weak DH groups, Perfect Forward Secrecy off, and PSK vs certificate authentication. **SSL VPN**: policy count / presence informational finding. **Legacy PPTP / L2TP-style remote access** — dedicated finding when the export indicates PPTP or legacy L2TP/PPTP remote access (`analyseVpnSecurity` in `src/lib/analysis/domains/vpn-network.ts`).
- **Certificate management** — Weak key sizes, SHA-1 signatures, **expiry within 30 days** (high) and **30–90 days** (medium), self-signed / untrusted issuer (`analyseCertificates` in `src/lib/analysis/domains/infra.ts`)
- **WAF (Web Application Firewall)** — Monitor-only policies; **published web servers without WAF** when DNAT suggests exposure (`analyseWafPolicies` in `src/lib/analysis/domains/rules-waf.ts`). Deeper OWASP-oriented rule/template coverage can still expand
- **Licensed-feature gaps** — When the export shows **Web Protection** licensed but no web filter/WAF policies; **Email Protection** licensed but no relay/SMTP/DKIM-style configuration detected (`infra.ts` licensing helpers)

### Scoring & Benchmarking

- **Security Risk Score Dashboard** — Weighted category scoring (Access Control, Encryption, Monitoring, Network Segmentation, Threat Prevention) with Recharts gauge visualisation
- **Peer Benchmark** — Compares scores against industry peer data by environment type
- **Sophos Best Practice Score** — Licence-aware scoring (Xstream Protection, Standard Protection, Individual Modules) with 20+ checks mapped to Sophos documentation
- **What-If Score Simulator** — Toggle individual findings on/off to see projected score impact

### Visualisations

- **Estate Overview** — Extraction coverage stats, inspection posture bars, severity breakdown
- **Attack Surface Map** — Per-firewall zone-to-zone traffic flow diagram with exposed services
- **Compliance Heatmap** — Framework control coverage matrix with colour-coded status
- **Certificate posture strip** — Compliance tab summary grouping certificate-related findings by **≤30 days**, **31–90 days**, and **other** (deterministic analysis thresholds)
- **VPN topology summary** — Security tab diagram from parsed IPsec connection names + SSL VPN policy count (**`VpnTopologyDiagram`** / **`buildVpnTopologySummary`**)
- **Rule Optimisation Engine** — Detects duplicate, shadowed, and mergeable firewall rules
- **Finding Priority Matrix** — Impact vs effort quadrant chart (Quick Wins, Strategic, Low Priority, Reconsider) with interactive SVG scatter plot

### Operational Tools

- **Config Diff Viewer** — Side-by-side section comparison for change reviews and drift auditing
- **Multi-Firewall Consistency Checker** — Compares settings across firewalls and highlights discrepancies
- **Remediation Playbooks** — Step-by-step Sophos Firewall remediation instructions for each finding
- **Remediation status** — Cloud `remediation_status` rows with playbook completion from Assess / **Playbook library**; **Remediation progress** and velocity-style views where wired
- **Assessment History** — IndexedDB-backed snapshot storage with drift detection, inline renaming, score trend mini-chart, and comparison vs previous snapshot; **cloud** snapshots support optional **reviewer sign-off** (Postgres on **`assessments`**) with read-only display for viewers
- **Assessment score trend CSV** — Export mini-chart history to CSV from **Assessment History** (local or cloud snapshots)
- **Score history & trends** — **`ScoreTrendChart`** from persisted score history (workspace dashboard drawer, **Client portal**); click-to-sync dial on Assess when integrated
- **Drift monitoring** — **Drift** route, agent submission drift payloads, alerts for agent drift
- **Parser Diagnostics** — Section extraction stats and parseable data coverage metrics

### Cloud, MSP & integrations (shipped)

- **Multi-tenant backend** — Supabase Auth, Postgres, row-level security; organisations, staff roles (admin/member/viewer patterns); assessments and artefacts scoped by `org_id`
- **Sophos Central** — Encrypted credential storage, tenant and firewall sync, Fleet command, connector version surfaced in fleet views; **Firewall Licence Monitor** refinements (e.g. HA serial display cap, Xstream vs superseded FullGuard / trial licence rows)
- **Commercial hub** — Customer management, report centre, portfolio insights, drift monitor, playbook library
- **API & Integrations** — API Hub (`/api`): REST surface documentation, webhooks UI, agent fleet summary; Edge Function `api` routes (e.g. firewalls, assessments, service-key issue/revoke/ping); **scoped org service keys** with hashed storage
- **PSA** — ConnectWise Cloud (Partner API OAuth), ConnectWise Manage (REST tickets, company mapping from FireComply customers), Datto Autotask PSA (credentials, mapping, idempotent tickets from findings)
- **Workspace settings** — Branding, Central, connector agents, team invites, client portal, security (MFA, **passkeys** — WebAuthn **login-options / login-verify** on **`api-public`** with **HMAC-signed challenge tokens** and **`verifyAuthenticationResponse`**; optional **`PASSKEY_CHALLENGE_SECRET`** for self-hosted — see **SELF-HOSTED**), **activity log** (`/audit` and in-drawer), alerts, webhooks, scheduled reports, report template, API docs entry, **How we handle your data** (retention, regulatory scanner notes, delete-all-org-data for admins), PSA & API automation (modal flows)
- **Trust & transparency** — **Trust** page (`/trust`) with “How we handle your data” summary, subprocessors baseline, links to `docs/DATA-PRIVACY.md`; main nav **Trust** link; in-app **Changelog** (`/changelog`)
- **Export Centre (compliance)** — Findings CSV with framework **control IDs**; non-blocking **validation checklist** in UI for high/critical gaps; optional **reviewer sign-off** rows on CSV when a linked cloud assessment has sign-off (persists across **browser session** refresh when signed in)
- **Compliance & signals** — Regulatory digest settings; **regulatory-scanner** Edge Function and scheduled RSS ingest (Compliance / Regulatory Tracker)
- **Client experience** — Client portal routes and portal viewer management where configured
- **Shared report viewer (security)** — Token-based **shared health-check** HTML loads in a **sandboxed iframe** (`sandbox="allow-same-origin"`: scripts blocked; same-origin needed for parent **contentDocument** auto-height)
- **Report export shell (security)** — PDF/HTML document shell from **`buildPdfHtml`** **HTML-escapes** branding fields (**title**, org/customer names, prepared-by, footer); **logo URL** allowlist (**https** or **data:image/…;base64** for selected image types)
- **Client fetch cancellation (product UI)** — User-initiated **`fetch`** in **`src/components`** / **`src/pages`** passes **`AbortSignal`** (TanStack **`queryFn`**, **`useAbortableInFlight`**, effect **`AbortController`s**, per-agent run-now/delete on fleet surfaces, **`ClientPortal`** stale-load guard on **`portal-data`**). Policy and inventory: **[client-data-layer.md](api/client-data-layer.md)**. **SE Health Check guest Central** (**`callGuestCentral`**) threads **`AbortSignal`** for licence load and connect chains; residual optional **`signal`** on other **`src/lib`** **`fetch`** helpers (pdfmake assets, **`geo-cve`**, etc.).
- **SE Health Check layout slice** — Results step in **`HealthCheckResultsSection.tsx`**; landing / analysing step in **`HealthCheckLandingSection.tsx`**; **`HealthCheckInnerLayout`** keeps dialogs and orchestration only.
- **CI JS bundle budget** — Optional post-build check via **`scripts/assert-bundle-budget.mjs`** (see deploy/staging workflows when enabled).
- **Job outbox worker (testability)** — **`process-job-outbox`** exposes a handler for HTTP/cron and ships Deno contract tests (see **[job-queue-outline.md](job-queue-outline.md)**).

### UI/UX

- **Dark Mode** — Full dark mode support with Sophos brand colour palette
- **Collapsible Sections** — All analysis panels are collapsible (except Assessment Context)
- **Responsive Layout** — Mobile-friendly grid layouts throughout
- **Sophos Branding** — Custom icon set, Sophos colour palette, brand-consistent typography
- **Landing Page** — Clean hero section describing the tool's capabilities
- **Fleet list view** — Customer groups **collapsed by default**; expand to see firewalls

---

## Multi-tenant architecture (reference)

The app supports **guest/local use** (IndexedDB, no login) and **signed-in cloud use** (data in Supabase with RLS). MSPs operate as **organisations**; staff are members with roles enforced in the app and database.

### Representative schema (evolved across migrations)

- `organisations` — Workspace profile, webhook URL, retention fields, feature flags
- `org_members` — User ↔ org membership and role
- `assessments`, `saved_reports`, `central_*`, `agents`, `audit_log`, PSA credential tables, etc. — See `supabase/migrations/` and [TENANT-MODEL.md](TENANT-MODEL.md)

### Implementation pointers

- `src/hooks/use-auth.ts` — Auth, org, role, guest/local mode
- `src/lib/assessment-cloud.ts` — Cloud assessment CRUD patterns
- `src/components/AuthGate.tsx`, `OrgSetup.tsx`, `InviteStaff.tsx` — Onboarding and invites
- App routes: Assess (`/`), Fleet (`/command`), and hub pages under `src/pages/`

---

## Planned Features (Not Yet Started)

The bullets below are **still open or only partially covered**. Several older roadmap lines (DoS/spoof, VPN crypto, certificate expiry findings, score trends, basic WAF findings, SMTP/POP/IMAP malware-off) **already ship** — see **Completed** above.

### Quick Wins

- **Email security (deeper)** — Anti-spam rule posture, SPF/DMARC-style signals if present in export, richer **DKIM** policy review beyond the licenced-feature “no DKIM section” check; **virus scanning** already flags disabled mail-protocol malware scanning when those rows exist

### Medium Effort

- **Assessment trend UX** — **Partial:** Assessment History **CSV** export for score trend; **ScoreTrendChart** / workspace **`score_history`** unchanged. **Still open:** category breakdowns on Assess, **PNG** export from main trend chart, deeper unification with drawer chart
- **Certificate UX** — **Partial:** **CertificatePostureStrip** (30 / 90 / other buckets). **Still open:** explicit **60-day** horizon in analysis if product wants it; full **inventory table** or **expiry calendar** view
- **VPN Topology Diagram** — **Partial:** hub-and-spoke **summary** from IPsec names + SSL VPN counts. **Still open:** richer graph (topology edges, remote-access detail) if exports expose enough structured fields

### Larger Features

- **Scheduled Comparison** — Automated periodic re-assessment with **email/webhook** alerts on score regression (connector + scheduling productisation)
- **Remediation programme** — Cross-customer views, reviewer **notes**, due dates, and exports on top of today’s **playbook + `remediation_status`** completion tracking
- **WAF depth** — OWASP-style template coverage, virtual host / rule semantic checks beyond monitor-only and “published server without WAF”
- **SD-WAN Analysis** — Profiles, SLA routing, gateway health (not yet a dedicated `analyseSdwan`-style module)

### Operations and governance

- **Data retention and erasure (follow-ups)** — Counsel-approved DPA wording, export-before-delete UX, customer-facing procurement pack
- **Operational visibility** — **Partial:** **[observability.md](observability.md)** catalogs **`logJson`** messages, latency boards, and saved-search examples (including **`process_job_outbox_*`** / **`send_scheduled_reports_*`**). **Still open:** connector diagnostics depth, Central/Gemini rate-limit runbooks beyond inline docs

### Skipped

- **Syslog / SIEM Integration Check** — Skipped because Sophos Central uploads to the data lake without needing a syslog connector; the connector is only useful for third-party SIEM

---

## Phase 4 — Compliance productization (next steps)

- **Control-level evidence mapping** — Evidence Verification panel shows framework mapping when frameworks are selected; findings CSV includes **Control IDs** column when frameworks are chosen; deeper traceability in **PDF / evidence packs** can still expand.
- **Reviewer sign-off and annotations** — **Shipped (cloud):** **`assessments`** columns + **Assessment History** UI (members/engineers/admins; viewers read-only). **CSV:** **`ExportCentre`** receives **`reviewerSignoff`** from **`Index`** / **`AnalysisTabs`** when a cloud assessment is linked; **browser session** persists **`linkedCloudAssessmentId`** and rehydrates sign-off from Supabase after refresh (signed-in). **Further:** org-wide policy UI, **Evidence** tab integration.
- **Validation layer** — **`validateFindingExportMetadata`** + **`collectFindingExportValidationIssues`**; **Export Centre** shows a non-blocking checklist; high/critical **empty detail** also flagged. Broader comparison with external audit tooling remains a research item.

---

## See also

- [docs/REVIEW.md](REVIEW.md) — War-room audit scorecard, Tier 3 checklist, and evidence links (vs this **product** roadmap)
- [docs/plans/review-100-program-evidence.md](plans/review-100-program-evidence.md) — REVIEW “100%” program implementation evidence (abort sweep, architecture checks, CI)
- [docs/plans/sophos-firewall-gaps-and-improvements-roadmap.md](plans/sophos-firewall-gaps-and-improvements-roadmap.md) — Deeper gap analysis and execution targets
- [docs/plans/sophos-firewall-master-execution.md](plans/sophos-firewall-master-execution.md) — Master execution checklist
- [docs/DATA-PRIVACY.md](DATA-PRIVACY.md) — Data flows, modes, retention summary
