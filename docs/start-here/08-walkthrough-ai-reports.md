# Walkthrough: AI Reports & Deliverables

FireComply generates four distinct report types. Three AI-powered MSP reports are combined into a single document, and a dedicated SE Health Check report is generated separately.

## The Four Report Types

### 1. Full Technical Handover (AI-Generated)

**Audience:** Technical staff, MSP engineers, auditors

**What it contains:**

- Per-firewall deep-dive: every rule, interface, zone, NAT entry, auth server, IPS engine, wireless network, SSL/TLS inspection setting, and admin config
- For each section: Markdown table with all columns from the export, Summary paragraph, Findings with severity (Critical / High / Medium / Low), and Best Practice Recommendations with "How to remediate" steps
- Ends with "Overall Security Recommendations" covering cross-cutting gaps

**Typical length:** 15–20 pages per firewall

### 2. Executive Summary (AI-Generated)

**Audience:** IT Managers, C-Suite, non-technical stakeholders

**What it contains:**

- Executive overview of the estate
- Per-firewall summary: key stats, top concerns, DPI status
- Cross-estate findings (if multiple firewalls)
- Risk matrix: numbered list of up to 10 findings, prioritised by severity
- Strategic recommendations with prioritised actions
- Appendix with configuration highlights
- Limitations section

**Typical length:** 5–8 pages

### 3. Compliance Readiness Report (AI-Generated)

**Audience:** Compliance officers, auditors, governance teams

**What it contains:**

- Security Feature Gaps by Firewall (table)
- Control → Evidence Mapping Tables for each selected framework (GDPR, Cyber Essentials, NCSC, ISO 27001, PCI DSS, HIPAA, etc.)
  - Columns: Control ID, Control Description, Status (Met / Partial / Not Met / N/A), Firewall(s) Lacking, Evidence, Example of non-compliance, Notes
- Not Applicable Justifications
- Residual Risk Statements (table with Risk ID, Description, Affected Controls, Severity, Recommended Mitigation)
- Summary of Findings: total controls assessed, status counts, per-firewall feature summary, SSL/TLS and DPI analysis, overall compliance posture
- Best Practice Recommendations: numbered subsections with Recommendation, Justification, and Specific Rules/Servers

**Typical length:** 10–15 pages per firewall, per framework set

### 4. SE Health Check Report (Template-Generated)

**Audience:** Customers, SEs, technical decision-makers

**What it contains:**

- Cover page with customer name, SE name, serial number, date
- Firewall health check overview (what the tool does and doesn't assess)
- Provenance and limitations (timestamp, tool identity, export caveats)
- Assessment scope and exclusions (DPI, MDR, NDR, DNS, Heartbeat, web filter settings)
- Executive Summary: licence selection, best-practice score and grade, passed/failed/verify counts, per-category check results with Sophos recommendations
- Baseline checklist: pass/fail requirements (DPI, IPS, web filter, MFA, admin exposure, logging, app control)
- Findings table: severity, title, configuration section, detail, and remediation
- SE Engineer Notes: AI-style conversational summary (actually template-generated for accuracy)
- Priority next steps: top 5 critical/high items with remediation paths

**Typical length:** 10–13 pages

## How AI Report Generation Works

### The Prompt Engineering Pipeline

FireComply doesn't just dump config data into an LLM. The pipeline is carefully engineered:

1. **Section omission** — 120+ low-value config sections (DHCP, DNS routes, QoS, email scanning, schedules, etc.) are stripped client-side, saving 30–50% of input tokens
2. **Payload pruning** — Empty strings, arrays, and objects are recursively removed
3. **Anonymisation** — Hostnames, IPs, and identifiers are replaced with tokens before leaving the browser
4. **System prompt assembly** — Base prompt (3,500 words for Technical, 500 for Executive, 1,200 for Compliance) + Shared Assessment Rules (300 words) + Dynamic Context (customer name, environment, country, frameworks, Central data) = complete system prompt
5. **Streaming generation** — The model generates Markdown via SSE streaming. A de-anonymiser restores real values in the response stream.

### Shared Assessment Rules

These domain-specific rules prevent common AI mistakes:

- **Web filter scope** — Only flag missing web filtering for WAN-destination rules with HTTP/HTTPS/ANY service. Don't flag LAN-to-LAN rules.
- **VPN profiles** — Only flag weaknesses when the profile is actively referenced by an IPSec connection. Unused profiles are compliant.
- **SSL/TLS engine** — These settings are for the DPI engine, not a TLS-terminating service. Don't recommend NCSC TLS 1.2+ compliance for the firewall's inspection engine.
- **External logging** — Sophos Central counts as external log forwarding. Central-managed firewalls satisfy the syslog requirement.
- **API service accounts** — Read-only admin accounts for API/monitoring can't use interactive MFA. Document compensating controls instead of flagging as non-compliant.

### Model Configuration

- **Temperature:** 0.1 (near-deterministic output)
- **Reasoning effort:** Low (balances quality and cost)
- **Max tokens:** 32,768–65,536 (accommodates 30-page reports)
- **Fallback:** Automatic fallback model if primary rate-limits
- **Provider:** Gemini by default; pluggable to Claude or ChatGPT

## Export Formats

| Format       | Available From                                  | Notes                                                    |
| ------------ | ----------------------------------------------- | -------------------------------------------------------- |
| PDF          | Assess, Health Check, Report Centre             | Server-rendered with Headless Chromium; pdfmake fallback |
| Word (.docx) | Assess, Report Centre                           | Full-fidelity Markdown-to-docx conversion                |
| PPTX         | Assess                                          | Presentation-ready slides                                |
| Styled HTML  | Assess, Health Check                            | Self-contained, printable                                |
| CSV          | Assess (risk register), Health Check (findings) | Spreadsheet-friendly                                     |
| JSON         | Health Check (summary)                          | Machine-readable for integrations                        |
| ZIP          | Assess, Health Check                            | Bundles multiple formats                                 |
| Email        | Assess, Health Check, Report Centre             | Direct delivery via Resend API                           |
| Share link   | Assess, Health Check                            | Read-only URL with optional download toggles             |

## Best Practices

- **Generate all three MSP reports together** — they're designed as a single package. The Technical Handover is the depth, the Executive Summary is the overview, and the Compliance Report is the evidence.
- **Review the AI output before sending** — the model is configured for accuracy, but always skim the report before customer delivery.
- **Use the Document Preview** — you can read the full report in-app before exporting.
- **Save to Report Centre** — reports are persisted with metadata, versioning, and quick-send capabilities.
- **Use scheduled reports** — for connector-fed customers, schedule weekly or monthly report regeneration automatically.
