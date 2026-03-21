---
name: MSP Feature Ideas
overview: Feature ideas for MSP firewall compliance, prioritized by client value and feasibility, grouped into quick wins, medium-effort, and strategic additions.
todos: []
isProject: false
---

# MSP Feature Ideas for Firewall Compliance

## What You Already Have (Strong Foundation)

Analysis/scoring, compliance frameworks (NCSC, CE, PCI DSS, ISO 27001, GDPR), AI reports, multi-tenant dashboard, Sophos Central integration, connector agent, client portal, alerts, team management, cost of risk, remediation tracking, config diff/history, attestation workflow, change approval, evidence collection, rule analysis, SLA tracking.

That's a very complete platform. Here's what's missing:

---

## Tier 1: Quick Wins (High Value, Low Effort)

### 1. Scheduled Email Reports

MSPs need to auto-send monthly/quarterly compliance summaries to clients without logging in. A cron job or Supabase scheduled function that generates the executive one-pager and emails it as a PDF attachment on a configurable schedule (weekly/monthly/quarterly per customer).

**Why MSPs want this:** Recurring proof of value to clients. "You're paying us, here's what we're doing."

### 2. Firmware Compliance Check

You already pull firewall data from Central (including firmware version). Add a widget that compares the running firmware against the latest available Sophos XGS firmware and flags outdated versions with severity based on how many versions behind they are. Include CVE references for known vulnerabilities in older firmware.

**Why MSPs want this:** Firmware patching is a top compliance requirement across every framework.

### 3. Rule Expiry and Review Reminders

Add optional metadata to firewall rules: creation date, last reviewed date, expiry date, and owner. Flag rules that haven't been reviewed in 90/180/365 days. This is a common audit requirement (PCI DSS 1.1.7 requires annual rule review).

**Why MSPs want this:** Auditors specifically ask "when was each rule last reviewed?"

### 4. Evidence Pack Export

One-click export of a complete compliance audit bundle: current config snapshot, score report, findings list, attestation signatures, compliance gap analysis, remediation progress, and change history — all in a single ZIP with a cover page and table of contents.

**Why MSPs want this:** When a client gets audited, the MSP needs to produce evidence fast.

---

## Tier 2: Medium Effort (High Value)

### 5. Firewall Backup Verification

Track when the last config backup was taken (from Central or connector). Alert if backups are older than X days. Show backup history timeline. This is a basic but critical compliance item that every auditor checks.

### 6. Remediation Ticket Integration

You have PSA integration stubs already. Build out ConnectWise Manage and Autotask/Datto PSA integrations that auto-create tickets from critical/high findings. Include the finding details, remediation steps, and a link back to the Clarity assessment.

**Why MSPs want this:** Findings need to become tickets in their PSA to track resolution and bill time.

### 7. Risk Register

A formal risk register where MSPs can log accepted risks with: risk description, owner, mitigation plan, acceptance date, review date, and linked findings. Some findings are intentionally accepted (e.g., "client needs RDP open for legacy app") and the MSP needs to document that decision.

**Why MSPs want this:** Compliance frameworks require a risk register. Currently there's no way to formally accept and track risks.

### 8. Multi-Firewall Fleet Report

A single PDF report covering ALL firewalls for a customer (not just one), with a fleet summary page showing scores, common findings across firewalls, and per-firewall sections. The executive summary already merges, but a purpose-built fleet report would include comparative charts and cross-firewall analysis.

---

## Tier 3: Strategic (Differentiators)

### 9. Multi-Vendor Support

This is the big one. MSPs don't only manage Sophos firewalls. Adding even basic config parsing for FortiGate (FortiOS config files are plain text and well-structured) and Palo Alto (XML-based like Sophos) would massively expand the addressable market. Start with FortiGate since it has the largest market share.

### 10. Automated Remediation Scripts

Generate Sophos API commands or CLI scripts that would fix specific findings. For example, if a rule is missing IPS, generate the API call to enable it. The MSP reviews the script, gets client approval (you already have change approval workflow), then runs it.

### 11. Client Self-Service Requests

Let clients submit change requests through the portal (e.g., "I need port 8080 opened for a new application"). The MSP reviews, assesses the risk impact (using the score simulator you already have), approves or denies with documented reasoning.

### 12. Benchmark Database

Anonymously aggregate scores across all Clarity users to build industry benchmarks. Show clients where they rank against peers in their industry/size bracket. "Your firewall score is 54 — the average for Medium Technology companies is 67."

---

## Recommended Priority Order

If I were building for MSP adoption, I'd go:

1. **Scheduled Email Reports** — immediate perceived value, low effort
2. **Firmware Compliance Check** — data is already available from Central
3. **Evidence Pack Export** — audit season is a pain point, this solves it
4. **Rule Review Reminders** — maps directly to PCI DSS requirement
5. **PSA Ticket Integration** — bridges the gap between findings and action
6. **Risk Register** — compliance maturity play
7. **Multi-Vendor** — market expansion (start with FortiGate)

