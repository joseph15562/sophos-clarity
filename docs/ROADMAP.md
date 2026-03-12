# Sophos FireComply — Roadmap & Feature Log

> Last updated: 5 March 2026

---

## Completed Features

### Core Platform
- **HTML Report Parser** — Parses Sophos XGS firewall HTML exports (V1 and V2 formats), extracting 150+ configuration sections into structured data using DOMParser
- **Multi-Firewall Support** — Upload and analyse multiple firewall exports simultaneously with per-firewall and aggregated results
- **Data Anonymisation** — Client-side anonymisation of IP addresses, hostnames, and customer identifiers before any data leaves the browser
- **Session Persistence** — Auto-saves branding, reports, and active state to localStorage for 24-hour recovery
- **Assessment Context** — Optional customer name, environment, country, and compliance framework tagging before generating reports

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
- **Multi-Tenant Dashboard** — Customer overview from saved assessments (currently local IndexedDB, cloud migration planned)
- **Parser Diagnostics** — Section extraction stats and parseable data coverage metrics

### UI/UX
- **Dark Mode** — Full dark mode support with Sophos brand colour palette
- **Collapsible Sections** — All analysis panels are collapsible (except Assessment Context)
- **Responsive Layout** — Mobile-friendly grid layouts throughout
- **Sophos Branding** — Custom icon set, Sophos colour palette, brand-consistent typography
- **Landing Page** — Clean hero section describing the tool's capabilities

---

## In Progress — Multi-Tenant MSP Authentication

### Problem
The app currently runs entirely client-side. Assessment data is stored in the browser's IndexedDB, meaning:
- Data doesn't sync across devices
- No access control — anyone with the URL can use the tool
- MSPs can't share assessments with team members
- No data isolation between different MSP organisations

### Solution
Add Supabase Auth + Supabase Postgres with Row Level Security (RLS) to create a proper multi-tenant SaaS backend.

### Architecture
- **Supabase Auth** — Email/password authentication (50,000 MAUs free)
- **Supabase Postgres** — Assessment storage with RLS (500 MB free)
- **Organisation model** — Each MSP is an "organisation"; staff are members with roles (admin/member)
- **Data isolation** — RLS policies filter all queries by org_id from JWT claims
- **Guest mode preserved** — App still works without login (local IndexedDB), login needed to save to cloud and access team features

### Database Schema
- `organisations` — id, name, created_at
- `org_members` — id, org_id, user_id, role (admin/member), joined_at
- `assessments` — id, org_id, created_by, customer_name, environment, firewalls (JSONB), overall_score, overall_grade, created_at

### User Flows
1. **First MSP user** signs up → creates organisation → becomes admin
2. **Admin** invites staff via email → staff sign up → auto-added to org as member
3. **Any member** runs assessments → saves to cloud → visible to all org members
4. **MSP 1 users** cannot see MSP 2's data (enforced at database level via RLS)

### Implementation
- `supabase/migrations/001_multi_tenant.sql` — Schema + RLS policies
- `src/hooks/use-auth.ts` — Auth state hook (user, org, role, isGuest)
- `src/lib/assessment-cloud.ts` — Cloud CRUD for assessments
- `src/components/AuthGate.tsx` — Login/signup form
- `src/components/OrgSetup.tsx` — Organisation creation
- `src/components/InviteStaff.tsx` — Admin invite form
- Updates to AppHeader, AssessmentHistory, TenantDashboard, Index.tsx

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

### Skipped
- **Syslog / SIEM Integration Check** — Skipped because Sophos Central uploads to the data lake without needing a syslog connector; the connector is only useful for third-party SIEM
