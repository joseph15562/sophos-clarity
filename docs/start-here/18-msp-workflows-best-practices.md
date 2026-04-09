# MSP Workflows & Best Practices

## Workflow 1: New Customer Onboarding (Most Common)

**Scenario:** You've signed a new managed firewall customer. You need a baseline assessment, compliance posture, and a professional deliverable for the customer within the first week.

### Steps

1. **Connect Sophos Central** (if not already done) — your partner credentials discover the customer's tenant and firewalls
2. **Install a Connector Agent** on a machine with network access to the customer's firewall(s)
3. The agent pulls the config automatically — or have the customer export and upload manually
4. **Set customer context** — environment type, country, compliance frameworks
5. **Run the full assessment** — deterministic analysis + AI reports (Technical Handover + Executive + Compliance)
6. **Save to Report Centre** — the customer's baseline is archived
7. **Configure the Client Portal** — brand it, set the vanity slug, add portal viewers
8. **Share the portal URL** — the customer has self-service access from day one
9. **Set up scheduled reports** — monthly or quarterly, auto-delivered

### Best Practices

- **Do the first assessment before the onboarding call.** Walking through a live, populated portal on the kick-off call makes a strong first impression.
- **Use the Technical Handover as your baseline document.** It records every rule, zone, and setting — refer back to it when the customer claims "nothing changed."
- **Set compliance frameworks early.** The right frameworks drive the right findings. UK Education → GDPR + Cyber Essentials + NCSC + DfE/KCSIE.
- **Install the Connector Agent, not just Central.** Central gives you inventory. The agent gives you config analysis and score tracking.

---

## Workflow 2: Quarterly Business Review (QBR)

**Scenario:** It's QBR season. You need to present security posture, compliance status, and improvement trajectory to 15 customers in the next two weeks.

### Steps

1. Open **Portfolio Insights** → set range to 90 days → screenshot the portfolio trends
2. For each customer:
   - Open their **Client Portal** (or search in **Fleet Command**)
   - Review the score trend — has it improved since last QBR?
   - Note top findings still open and any new critical issues
   - Pull the latest report from **Report Centre** (or generate a fresh one)
3. On the QBR call:
   - Share the Client Portal on screen — walk through score, history, findings
   - Reference improvement: "Your score has gone from 54% to 78% since we started"
   - Show compliance alignment: "You're meeting 12 of 15 Cyber Essentials controls"
   - Identify remaining gaps and agree on next steps
4. After the call — email the report from Report Centre with one click

### Best Practices

- **Use Portfolio Pulse in Customer Directory for the executive stat** — "72% of our managed estate is at Grade A or B" is a powerful number for boards.
- **Lead with improvement, not gaps.** Customers want to see progress. Show the score trend before diving into findings.
- **Use the Compliance Readiness Report for compliance-sensitive customers.** Board members care about framework alignment, not rule-by-rule detail.
- **Batch your QBRs.** The Report Centre and Fleet Command make it fast to switch between customers — you can prep 5 QBRs in an hour.

---

## Workflow 3: Responding to a Security Incident

**Scenario:** A customer reports suspicious activity. You need to check if their firewall config contributed to the exposure.

### Steps

1. Open **Mission Control** — check the recent alerts table for this customer
2. Open **Fleet Command** → search for the customer → review firewall status and score
3. Open **Drift Monitor** → select the customer's firewall → check recent snapshots:
   - Did the config change recently?
   - Were any rules added or removed?
   - Did the score drop?
4. Open the latest assessment in the **Assess Workbench** → review findings by severity
5. Generate a focused report if needed — the Technical Handover documents the state of the config at assessment time
6. If the PSA is connected — create tickets from findings for the remediation plan

### Best Practices

- **Drift Monitor is your timeline.** When the customer says "we didn't change anything", the snapshot history tells the truth.
- **Use the Assess workbench's AI Chat** to ask targeted questions: "Which rules allow traffic from any source to any destination?" or "Is DPI active on any WAN-facing rules?"
- **Save a snapshot report immediately.** If this becomes an insurance or legal matter, having a timestamped posture assessment is evidence.

---

## Workflow 4: Compliance Audit Preparation

**Scenario:** A customer's compliance officer needs evidence that their firewall configuration meets Cyber Essentials / GDPR / ISO 27001 requirements.

### Steps

1. Open the **Assess Workbench** → load the customer's config
2. Set the correct compliance frameworks (Cyber Essentials, GDPR, ISO 27001, etc.)
3. Review the deterministic compliance alignment in the posture scorecard
4. Generate the **Compliance Readiness Report** — this maps firewall configuration against each framework's controls:
   - Control-by-control evidence tables
   - Pass / Partial / Not Met status per control
   - Evidence citations from the actual config
   - Remediation impact notes
   - Residual risk register
5. Save to Report Centre and share with the compliance officer via:
   - Client Portal (they can download anytime)
   - Direct email from Report Centre
   - Shared link with Word/PDF download

### Best Practices

- **Select the right jurisdiction.** Per-firewall country and environment settings affect which controls are assessed.
- **Use the Compliance Readiness Report as formal evidence.** It includes provenance (tool identity, timestamp, limitations) — auditors expect this.
- **Run a fresh assessment before the audit.** Stale data undermines credibility. Use the Connector Agent's "scan now" capability or upload a fresh export.
- **Keep the Technical Handover as supplementary evidence.** If auditors want to see the underlying rule analysis, the handover provides it.

---

## Workflow 5: Upsell and Expansion

**Scenario:** You want to identify upsell opportunities across your customer base — additional Sophos licences, managed services, or remediation projects.

### Steps

1. Open **Portfolio Insights** → review the recommendations panel
2. Common upsell signals from the deterministic analysis:
   - **No DPI (SSL/TLS inspection)** → Xstream Protection conversation
   - **No web filtering on WAN rules** → web protection licensing
   - **No Sophos endpoints** (Synchronized Security check) → endpoint opportunity
   - **No MDR** → MDR upsell
   - **No DNS Protection** → DNS product conversation
3. Open **Fleet Command** → filter by **Weak scores (C–F)** → these customers have the most room for improvement
4. For each, open the assessment and review which product gaps drive the score down
5. Use the **Remediation Impact Simulator** on a call: "If we enable DPI and web filtering, your score goes from 52% to 71% — that's the impact of Xstream Protection"

### Best Practices

- **The score is a sales tool.** "Grade C" is something a customer understands. "You have 4 fully open rules" is technical. Lead with the grade, explain with the findings.
- **Use Fleet Command's CSV export** to build a pipeline report for your sales team — customer, score, critical findings, product gaps.
- **The Compliance Readiness Report drives compliance-driven purchases.** When the report shows "Not Met" against a framework the customer cares about, the remediation has a business justification.

---

## Workflow 6: Team Collaboration and Handoffs

**Scenario:** An engineer on your team is leaving, or you're sharing workload across a team.

### Steps

1. Everything is in the **workspace** — no data lives on individual machines (except Connector Agent installs)
2. Add team members via the **Management Panel** → **Team** section:
   - **Admin** — full access, can manage settings, integrations, and team members
   - **Viewer** — read-only access to Fleet, Customer Directory, Reports, Portals
3. All assessments, reports, and customer data are shared across the workspace
4. Saved reports in the Report Centre are visible to all team members
5. Client Portal configurations are org-wide — any team member can manage them

### Best Practices

- **Use viewer accounts for junior staff.** They can see everything but can't accidentally delete reports or change settings.
- **Use the Audit section** in Management Panel to track who did what.
- **Name scheduled reports clearly.** "Acme Monthly Posture" is better than "Schedule 1" when someone else needs to manage it.

---

## General MSP Best Practices

1. **Connect Sophos Central first, install agents second.** Central gives you instant fleet visibility; agents give you the config analysis. Together, they provide the complete picture.
2. **Set up Client Portals for every customer.** Even if the customer never logs in, having a branded portal ready for QBRs and ad-hoc requests saves time.
3. **Use scheduled reports as your retention tool.** Regular, automated deliverables remind customers why they pay you.
4. **Lead with the deterministic layer.** AI generates the reports, but the score, findings, and compliance mapping are computed locally. This is your credibility — same config always produces the same result.
5. **Anonymisation is your privacy story.** When customers ask about AI and data privacy, explain: data is anonymised before it leaves the browser, the AI never sees real hostnames or IPs, and real values are restored in the response stream.
6. **Check the Changelog** (`/changelog`) before customer meetings. Know what's new.
7. **Use the in-app guided tours** when onboarding team members. The "?" button provides page-by-page walkthroughs.
