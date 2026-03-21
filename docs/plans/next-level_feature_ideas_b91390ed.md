---
name: Next-Level Feature Ideas
overview: A set of high-impact features that go beyond incremental improvements — leveraging underutilised data, adding visual intelligence, and giving MSPs tools no competing product offers.
todos:
  - id: admin-acl
    content: Admin Access Exposure Analysis — parse LocalServiceACL, generate findings for exposed management services
    status: completed
  - id: nat-analysis
    content: NAT Rule Security Analysis — parse NAT rules, flag DNAT without IPS, broad NAT, missing logging
    status: completed
  - id: whatif-sim
    content: What-If Score Simulator — clone analysis, toggle changes, show projected score/grade
    status: completed
  - id: findings-export
    content: Findings Quick Export — CSV and PDF export of deterministic findings
    status: completed
  - id: attack-surface
    content: Attack Surface Map — visualise inbound DNAT/port forwarding with risk colouring
    status: completed
  - id: consistency
    content: Multi-Firewall Consistency Checker — compare security policies across estate
    status: completed
  - id: policy-deep
    content: Web Filter and IPS Policy Deep Dive — analyse policy content, not just presence
    status: completed
  - id: virus-scan
    content: Virus Scanning Analysis — check anti-malware config from VirusScanning section
    status: completed
  - id: benchmarks
    content: Peer Benchmark Scoring — compare score against environment-type averages
    status: completed
  - id: topology
    content: Network Topology Diagram — auto-generated zone/interface/rule flow visualisation
    status: completed
isProject: false
---

# Next-Level Features for Sophos FireComply

The app currently extracts 18 sections from Sophos exports but only analyses 3 of them (Firewall Rules, OTP Settings, SSL/TLS Inspection). There are 15 sections of rich data sitting untapped. Combined with creative new features, here are the ideas ranked by impact.

---

## Tier 1 — High Impact, Uses Existing Data

### 1. Attack Surface Map

Visualise everything exposed to the internet. Parse NAT rules (DNAT/port forwarding) to show every inbound service: which internal IPs and ports are reachable from WAN, which have IPS/web filtering, which don't. Render as an interactive diagram — each exposed service is a node coloured by risk. MSPs can screenshot this for customer reports.

- **Data source**: NAT rules (currently only counted), firewall rules
- **New file**: `src/components/AttackSurfaceMap.tsx`, `src/lib/attack-surface.ts`
- **Value**: No firewall tool does this visually. Instant "wow" for customer presentations.

### 2. Admin Access Exposure Analysis (Local Service ACL)

The Local Service ACL section defines which zones can reach management services (HTTPS admin, SSH, SNMP, ping). Analyse this to flag if the admin console is accessible from WAN, if SSH is open to untrusted zones, or if SNMP is exposed. These are common audit failures.

- **Data source**: `LocalServiceACL` section (currently ignored)
- **New findings**: "Admin HTTPS accessible from WAN" (critical), "SSH open to DMZ" (high), "SNMP v2 exposed" (high)
- **Value**: Catches a class of vulnerabilities the current analysis completely misses.

### 3. "What-If" Score Simulator

Let the user toggle hypothetical changes — "Enable IPS on all WAN rules", "Add SSL/TLS Decrypt for LAN", "Remove ANY service rules" — and instantly see the projected risk score, grade, and which findings would be resolved. No actual changes needed.

- **New file**: `src/components/ScoreSimulator.tsx`
- **Logic**: Clone `AnalysisResult`, apply modifications, recompute `computeRiskScore`
- **Value**: Helps MSPs prioritise remediation and demonstrate ROI to customers: "If we do these 3 things, you go from D to B."

### 4. NAT Rule Security Analysis

Currently NAT rules are counted but never analysed. Check for: DNAT rules forwarding to internal servers without IPS, source NAT without logging, overly broad NAT (any-to-any), DNAT to non-standard ports that might indicate shadow IT.

- **Data source**: `NATRule` section
- **New findings**: "DNAT to internal server without IPS" (high), "NAT rule with no logging" (medium), "Broad NAT masquerade" (low)
- **Value**: Completes the security picture — firewall rules alone don't show port forwarding risks.

### 5. Multi-Firewall Consistency Checker

For estates with 2+ firewalls, compare whether common security policies are applied consistently. Flag discrepancies: "FW-Office has IPS on 90% of WAN rules but FW-Branch has 20%", "FW-DC has web filtering but FW-Remote doesn't", "SSL/TLS inspection enabled on FW-HQ but missing on FW-Branch".

- **New file**: `src/components/ConsistencyChecker.tsx`, `src/lib/consistency-check.ts`
- **Value**: Critical for MSPs managing multi-site estates. Currently the estate comparison only shows weighted scores, not policy-level alignment.

---

## Tier 2 — Differentiation Features

### 6. Network Topology Diagram

Auto-generate an interactive network diagram from extracted zones, interfaces/VLANs, and firewall rule flows. Show zones as groups, interfaces as connection points, and rule flows as edges (coloured by security coverage). Uses a library like `reactflow` or D3.

- **Data source**: Zones, Ports/VLANs/Interfaces, Firewall Rules
- **Value**: Replaces hours of manual Visio work. Auto-generated topology from config data.

### 7. Web Filter and IPS Policy Deep Dive

Currently the app checks "is a web filter policy applied?" but not "is the policy any good?". Parse the `WebFilterPolicy` and `IPSPolicy` sections to check: are high-risk categories blocked? Is the IPS policy using a comprehensive ruleset? Are there custom overrides that weaken protection?

- **Data source**: `WebFilterPolicy`, `IPSPolicy` sections (currently ignored)
- **New findings**: "Web policy allows Proxy/VPN category" (high), "IPS policy has no custom rules" (info)

### 8. Peer Benchmark Scoring

Show how this firewall compares to anonymised averages for the same environment type. "Your Education sector score is 62 — the average is 74." Even if initially based on static benchmarks, this gives MSPs a powerful conversation starter.

- **New file**: `src/lib/benchmarks.ts`, update `RiskScoreDashboard.tsx`
- **Benchmark data**: Static JSON of average scores per environment/category (can be crowd-sourced over time)

### 9. Findings Quick Export

One-click export of just the deterministic findings as a standalone CSV or PDF table — without generating a full AI report. Useful for quick internal handoff or ticketing system import.

- **Formats**: CSV (for import into PSA/ticketing), PDF (for quick email)
- **Location**: Button in the FindingsPanel header

### 10. Virus Scanning and Content Filtering Analysis

Parse the `VirusScanning` section to check if anti-malware scanning is enabled, which protocols are scanned (HTTP, SMTP, FTP), and whether sandboxing is active. Flag gaps.

- **Data source**: `VirusScanning` section (currently ignored)
- **New findings**: "HTTP virus scanning disabled" (high), "No sandboxing configured" (medium)

---

## Recommended Build Order

If building all of these, the suggested priority based on effort vs impact:

1. **Admin Access Exposure** (Tier 1, item 2) — small effort, high impact, uses existing parsed data
2. **NAT Rule Analysis** (Tier 1, item 4) — small effort, fills a major blind spot
3. **"What-If" Simulator** (Tier 1, item 3) — medium effort, unique differentiator
4. **Findings Quick Export** (Tier 2, item 9) — small effort, high utility
5. **Attack Surface Map** (Tier 1, item 1) — medium effort, visual impact
6. **Multi-Firewall Consistency** (Tier 1, item 5) — medium effort, MSP-critical
7. **Web Filter / IPS Deep Dive** (Tier 2, item 7) — small effort, deeper analysis
8. **Virus Scanning Analysis** (Tier 2, item 10) — small effort, more coverage
9. **Peer Benchmarks** (Tier 2, item 8) — small effort, compelling visual
10. **Network Topology** (Tier 2, item 6) — large effort, biggest "wow"

