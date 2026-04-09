# Walkthrough: MSP Assessment Workbench

The Assess workbench is the core of FireComply for MSPs. It's where you upload firewall configs, run analysis, generate reports, and manage your customer portfolio.

## Step 1: Upload a Configuration

1. Navigate to the **Assess** tab (the default landing page)
2. Drag and drop a Sophos firewall export file:
   - **HTML export** — from the Sophos XGS web console (Backup & firmware > Export, or download from any config page)
   - **XML entities export** — from Backup & firmware, or from the Connector Agent
3. FireComply parses the config **client-side** in your browser — nothing is sent to a server at this stage
4. The **Extraction Summary** shows what was parsed: section count, coverage, and any parsing notes

**Tip:** You can upload multiple firewall configs at once for a multi-firewall estate assessment.

## Step 2: Set Customer Context

Before running analysis, set the compliance context:

1. **Customer name** — used in report headers and cover pages
2. **Environment type** — Education, Healthcare, Finance, Government, etc. (16 options)
3. **Country** — determines default compliance framework suggestions (20 countries + US state selection)
4. **Compliance frameworks** — select from 39 frameworks (GDPR, Cyber Essentials, NCSC, ISO 27001, PCI DSS, HIPAA, NIST, etc.)

FireComply auto-suggests relevant frameworks based on your environment and country selection. For example: UK + Education → GDPR, Cyber Essentials / CE+, NCSC Guidelines, DfE / KCSIE.

## Step 3: Review Deterministic Analysis

The analysis runs automatically after upload. Key panels:

### Hero Outcome Panel

- **Overall posture score** and grade (A–F)
- **Critical/High issue counts**
- **Compliance readiness indicator**
- **Report readiness status**
- **Top actions to improve score** — the highest-impact fixes

### Security Posture Scorecard

- 12 categories: Device Hardening, Visibility & Monitoring, Encryption & Inspection, Rule Hygiene, Network Protection, DoS & Spoof Protection, VPN Security, Active Threat Response, Synchronized Security, Web Protection, Zero-Day Protection, Central Orchestration
- Each category shows pass/fail/verify counts
- Expand any category to see individual check results with evidence

### Risk Widgets

- **Findings by severity** — critical, high, medium, low, info
- **Findings by category** — which areas have the most issues
- **Compliance alignment** — how findings map to selected frameworks

### Remediation Impact Simulator

- Toggle recommended fixes on/off
- Watch the score, grade, and coverage recalculate in real-time
- Use this on customer calls to prioritise remediation

## Step 4: Generate AI Reports

Click the **Generate Report** button to create AI-powered reports. Three report types are generated as a single combined document:

1. **Full Technical Handover** — Every rule, interface, zone, NAT entry, auth server, IPS engine, wireless network, SSL/TLS setting, and admin config, with per-section security recommendations and remediation steps (15–20 pages per firewall)
2. **Executive Summary** — Non-technical estate overview with per-firewall summary, risk matrix (severity-ranked), strategic recommendations, and appendix
3. **Compliance Readiness Report** — Framework-mapped evidence tables with control-by-control evidence mapping, pass/partial/fail status, evidence citations, residual risk statements, and best-practice recommendations

The AI provider (Gemini, Claude, or ChatGPT) receives anonymised config data — no hostnames, IPs, or credentials leave the browser until scrubbed.

## Step 5: Export and Deliver

From the document preview panel:

| Format                | How                                                                      |
| --------------------- | ------------------------------------------------------------------------ |
| **PDF**               | Click PDF icon — server-rendered with Headless Chromium                  |
| **Word (.docx)**      | Click Word icon — full-fidelity Markdown-to-docx                         |
| **PPTX**              | Click PowerPoint icon — presentation-ready slides                        |
| **Styled HTML**       | Click HTML icon — self-contained, printable                              |
| **ZIP (all formats)** | Click "Download All" — reports/ + presentations/ folders                 |
| **Share link**        | Click Share — generates a read-only link with optional Word/PDF download |
| **Email**             | Click Send — emails the report directly to a recipient                   |

## Step 6: Save to Report Centre

- Click **Save** to persist the assessment to your Report Centre library
- Saved reports appear in `/reports` with metadata, status, and quick actions
- Reports can be **scheduled** for automatic regeneration
- Reports can be **archived** for historical reference

## Step 7: AI Chat Assistant

After analysis, the AI Chat panel is available for follow-up questions:

- "Which rules have logging disabled?"
- "How does this config align with Cyber Essentials?"
- "What would you prioritise first for this education environment?"
- "Generate a 3-paragraph executive summary"

The assistant has full context of the analysis results and findings.

## In-App Guided Tour

Click the **?** button in the top bar → select "Assess" tour for a step-by-step overlay walkthrough of every panel and feature.
