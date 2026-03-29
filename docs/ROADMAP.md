# Sophos FireComply — Roadmap & Feature Log

> Last updated: 29 March 2026

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
- **Virus Scanning Analysis** — Checks dual-engine mode and scan-mode settings
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

### Scoring & Benchmarking

- **Security Risk Score Dashboard** — Weighted category scoring (Access Control, Encryption, Monitoring, Network Segmentation, Threat Prevention) with Recharts gauge visualisation
- **Peer Benchmark** — Compares scores against industry peer data by environment type
- **Sophos Best Practice Score** — Licence-aware scoring (Xstream Protection, Standard Protection, Individual Modules) with 20+ checks mapped to Sophos documentation
- **What-If Score Simulator** — Toggle individual findings on/off to see projected score impact

### Visualisations

- **Estate Overview** — Extraction coverage stats, inspection posture bars, severity breakdown
- **Attack Surface Map** — Per-firewall zone-to-zone traffic flow diagram with exposed services
- **Compliance Heatmap** — Framework control coverage matrix with colour-coded status
- **Rule Optimisation Engine** — Detects duplicate, shadowed, and mergeable firewall rules
- **Finding Priority Matrix** — Impact vs effort quadrant chart (Quick Wins, Strategic, Low Priority, Reconsider) with interactive SVG scatter plot

### Operational Tools

- **Config Diff Viewer** — Side-by-side section comparison for change reviews and drift auditing
- **Multi-Firewall Consistency Checker** — Compares settings across firewalls and highlights discrepancies
- **Remediation Playbooks** — Step-by-step Sophos Firewall remediation instructions for each finding
- **Assessment History** — IndexedDB-backed snapshot storage with drift detection, inline renaming, and trend comparison
- **Parser Diagnostics** — Section extraction stats and parseable data coverage metrics

### Cloud, MSP & integrations (shipped)

- **Multi-tenant backend** — Supabase Auth, Postgres, row-level security; organisations, staff roles (admin/member/viewer patterns); assessments and artefacts scoped by `org_id`
- **Sophos Central** — Encrypted credential storage, tenant and firewall sync, Fleet command, connector version surfaced in fleet views; **Firewall Licence Monitor** refinements (e.g. HA serial display cap, Xstream vs superseded FullGuard / trial licence rows)
- **Commercial hub** — Customer management, report centre, portfolio insights, drift monitor, playbook library
- **API & Integrations** — API Hub (`/api`): REST surface documentation, webhooks UI, agent fleet summary; Edge Function `api` routes (e.g. firewalls, assessments, service-key issue/revoke/ping); **scoped org service keys** with hashed storage
- **PSA** — ConnectWise Cloud (Partner API OAuth), ConnectWise Manage (REST tickets, company mapping from FireComply customers), Datto Autotask PSA (credentials, mapping, idempotent tickets from findings)
- **Workspace settings** — Branding, Central, connector agents, team invites, client portal, security (MFA, passkeys), **activity log** (`/audit` and in-drawer), alerts, webhooks, scheduled reports, report template, API docs entry, **How we handle your data** (retention, regulatory scanner notes, delete-all-org-data for admins), PSA & API automation (modal flows)
- **Trust & transparency** — **Trust** page (`/trust`) with “How we handle your data” summary, subprocessors baseline, links to `docs/DATA-PRIVACY.md`; main nav **Trust** link; in-app **Changelog** (`/changelog`)
- **Compliance & signals** — Regulatory digest settings; **regulatory-scanner** Edge Function and scheduled RSS ingest (Compliance / Regulatory Tracker)
- **Client experience** — Client portal routes and portal viewer management where configured

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

### Quick Wins

- **DoS and Spoof Protection** — Check DoSSettings section for flood protection and spoof prevention configuration
- **VPN Security Analysis** — Flag PPTP usage, check IPSec/SSL VPN encryption strength, identify weak ciphers
- **Email Security Posture** — Analyse SMTP/POP/IMAP scanning, anti-spam configuration, DKIM settings

### Medium Effort

- **Assessment History Trend Charts** — Line chart of scores over time using Recharts (data already in IndexedDB/cloud)
- **Certificate Health Monitor** — Parse certificate sections, track expiry dates, flag certificates expiring within 30/60/90 days
- **VPN Topology Diagram** — Visualise site-to-site and remote access VPN connections

### Larger Features

- **Scheduled Comparison** — Automated periodic assessment with email alerts on score regression
- **Remediation Tracker** — Track which findings have been actioned, with completion dates and notes
- **WAF Security Analysis** — Parse WAF rules and policies, check for OWASP coverage
- **SD-WAN Analysis** — Analyse SD-WAN profiles, SLA routing, and gateway health

### Operations and governance

- **Data retention and erasure** — Org-level submission retention, in-app **Delete all data** (admins), Trust + **DATA-PRIVACY.md** alignment shipped; continue counsel-approved DPA wording and any export-before-delete UX
- **Operational visibility** — Structured logging and diagnostics for Edge Functions and Connector; document retry and rate-limit behaviour (Central, Gemini) for support runbooks

### Skipped

- **Syslog / SIEM Integration Check** — Skipped because Sophos Central uploads to the data lake without needing a syslog connector; the connector is only useful for third-party SIEM

---

## Phase 4 — Compliance productization (next steps)

- **Control-level evidence mapping** — Evidence Verification panel now shows "Findings map to framework controls: [frameworks]" when frameworks are selected. Next: per-finding control IDs and traceable evidence references in exports.
- **Reviewer sign-off and annotations** — Not yet started; would allow reviewers to attest or annotate controls.
- **Validation layer** — Compare FireComply deterministic findings with Sophos/open audit tooling where available; surface confidence and traceability in the UI.

---

## See also

- [docs/plans/sophos-firewall-gaps-and-improvements-roadmap.md](plans/sophos-firewall-gaps-and-improvements-roadmap.md) — Deeper gap analysis and execution targets
- [docs/plans/sophos-firewall-master-execution.md](plans/sophos-firewall-master-execution.md) — Master execution checklist
- [docs/DATA-PRIVACY.md](DATA-PRIVACY.md) — Data flows, modes, retention summary
