---
name: Feature Enhancement Ideas
overview: A prioritised list of feature additions for Sophos FireComply, based on gap analysis between what the V2 config export contains (127 sections) and what the app currently analyses (about 20 sections).
todos: []
isProject: false
---

# Feature Enhancement Ideas for Sophos FireComply

The V2 config export contains **127 distinct sections** but the app currently analyses only about **20**. Below are the highest-value additions grouped by effort level.

---

## Quick Wins (small effort, high value)

### 1. VPN Security Analysis

**Sections available:** `SSLVPNPolicy`, `VPNIPSecConnection`, `PPTPConfiguration`, `SSLTunnelAccessSettings`, `SophosConnectClient`, `VPNAuthentication`

- Flag **PPTP** as insecure (should never be used)
- Check SSL VPN cipher suites and tunnel settings
- Verify IPSec connections use strong encryption (no DES/3DES)
- Add BP checks: `bp-no-pptp`, `bp-vpn-encryption`

### 2. DoS and Spoof Protection

**Sections available:** `DoSSettings`

- Check if DoS protection is enabled
- Check if IP spoofing protection is active
- Add BP check: `bp-dos-protection`

### 3. Syslog / SIEM Integration Check

**Sections available:** `SyslogServers`

- Flag if no external syslog server is configured (logs only local = lost on failure)
- Add BP check: `bp-syslog` under "Visibility and Monitoring"

### 4. High Availability Status

**Sections available:** `HAConfigure`

- Detect if HA is configured (active-active or active-passive)
- Info-level finding if no HA (single point of failure)

### 5. Email Security Posture

**Sections available:** `PopImapScanning`, `AntiVirusMailSMTPScanningRules`, `AntiSpamRules`, `DKIMVerification`, `RelaySettings`

- Check if email scanning is enabled for SMTP/POP/IMAP
- Check if anti-spam rules exist
- Check if DKIM verification is on
- Flag open relay settings

---

## Medium Effort (new components or significant logic)

### 6. Certificate Health Dashboard

**Sections available:** `CertificateAuthority`, `SelfSignedCertificateAuthority`, `Certificate`, `Letsencrypt`, `CRL`

- New component: `CertificateHealth.tsx`
- List all certificates with expiry dates
- Flag expired or soon-to-expire certificates
- Flag self-signed CAs in production
- Check if CRL checking is enabled

### 7. Rule Optimisation Engine

**Data available:** Firewall rules table with source/dest zones, networks, services

- Detect **shadowed rules** (rules that can never match because a broader rule above already matches)
- Detect **duplicate rules** (identical source/dest/service/action)
- Detect **redundant rules** (rules that could be merged)
- New component: `RuleOptimiser.tsx`

### 8. VPN Topology Map

**Sections available:** `VPNIPSecConnection`, `REDDevice`, `SSLVPNPolicy`

- Visual map of site-to-site VPN tunnels, RED tunnels, and SSL VPN access
- Show which remote sites connect to which zones
- Highlight any tunnels using weak encryption

### 9. Assessment History Trend Charts

**Data available:** Assessment history snapshots in IndexedDB

- Add a line chart showing risk score over time
- Show per-category trends (Network Protection, Web Protection, etc.)
- Uses existing Recharts dependency

### 10. Finding Priority Matrix

**Data available:** All findings with severity levels

- 2D scatter/quadrant chart: Impact (severity) vs Effort (from remediation complexity)
- Helps customers prioritise what to fix first
- "Quick wins" quadrant (high impact, low effort) highlighted

---

## Larger Features (new workflows)

### 11. Scheduled Assessment Comparison

- Let users load a previous snapshot and compare side-by-side with the current assessment
- Show which findings are new, resolved, or unchanged
- Drift report generation

### 12. Multi-Tenant Dashboard

- Support uploading configs from multiple customers
- Dashboard view showing all customers with their scores
- Sort/filter by grade, date, environment

### 13. Exportable Remediation Tracker

- Export findings as a CSV/Excel task list with assignee, status, due date columns
- Import back to track progress
- Kanban-style board view

### 14. WAF Security Analysis

**Sections available:** `WAFSlowHTTP`, `WAFTLS`, `ProtocolSecurity`, `ReverseAuthentication`

- Check WAF slow HTTP protection settings
- Verify WAF TLS configuration (min TLS version, cipher suites)
- Analyse reverse proxy authentication settings

### 15. SD-WAN Policy Review

**Sections available:** `SDWANPolicyRoute`, `GatewayConfiguration`, `GatewayHost`, `RoutePrecedence`

- Analyse SD-WAN policy routes for redundancy
- Check gateway failover configuration
- Verify route precedence settings

---

## Recommended Priority Order

1. **Syslog/SIEM check** -- trivial to add, high compliance value
2. **DoS/Spoof protection** -- trivial to add, CIS benchmark item
3. **VPN security analysis** -- PPTP flagging alone is a quick win
4. **Assessment trend charts** -- Recharts already in the project
5. **Email security posture** -- lots of sections available
6. **HA status** -- simple check, valuable context
7. **Rule optimisation** -- high value for customers, medium effort
8. **Certificate health** -- medium effort, very useful
9. **Finding priority matrix** -- great UX addition
10. **VPN topology map** -- visually impressive, medium effort

