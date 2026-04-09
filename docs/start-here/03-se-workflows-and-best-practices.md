# SE Workflows & Best Practices

## Workflow 1: Pre-Sales Health Check (Most Common)

**Scenario:** A prospect is evaluating Sophos or renewing. You want to show them the value of Xstream Protection by reviewing their current config.

### Steps

1. **Open SE Health Check** from the workspace header
2. **Click "Request Config Upload"** — enter customer name, contact, email, and set link expiry (7 days is typical)
3. **Customer receives a branded email** with instructions to export their config (`Backup & firmware > Export`) and upload via the secure link
4. **Customer uploads** — they can optionally connect Sophos Central by entering their API Client ID and Secret. This enriches the analysis with firmware, HA, and alerts.
5. **You get an email notification** when the config is uploaded — click "Open FireComply"
6. **Load the config** from the Upload Requests panel
7. **Everything pre-populates** — customer name, firewall details, Central data if connected
8. **Set the licence tier** — Xstream Protection, Standard, or individual modules. This determines which checks are applicable.
9. **Walk through qualifying questions** on the call:
   - Does the customer have Sophos endpoints? (Synchronized Security check)
   - MDR threat feeds active? (May not appear in export)
   - NDR Essentials enabled? (May not appear in export)
   - DNS Protection configured? (May not appear in export)
   - Any valid reasons for DPI exclusions?
10. **Share your screen** showing the best-practice score — each toggle adjusts it live
11. **Click "Send to customer"** to email the PDF report before the call ends
12. **Save the health check** — it's persisted for follow-up reviews

### Best Practices

- **Set the licence tier before the call.** The score changes significantly between Standard and Xstream — you don't want surprises on screen.
- **Use qualifying questions as talking points.** "I see MDR isn't in the export — is that configured on the appliance?" naturally leads into upsell conversations.
- **Keep DPI exclusion zones reasonable.** If the customer has Guest WiFi, excluding it from DPI is legitimate. If they've excluded everything, flag it.
- **Send the report during the call.** The customer seeing it land in their inbox while you're still talking is powerful.

---

## Workflow 2: Post-Sales Improvement Review

**Scenario:** You sold Xstream Protection 6 months ago. Time to show the customer their improvement.

### Steps

1. Open the customer's **previous health check** from the saved list
2. Request a **new config upload** (or use connector if installed)
3. Run the new analysis side by side
4. Walk through the **score improvement** — "Last time you were 52% Grade D, now you're 78% Grade B"
5. Highlight the **findings that were resolved** and any **new issues**
6. Send the updated report

### Best Practices

- **Reference the previous report.** "In our last review, we flagged 4 fully open rules — I can see you've resolved 3 of those."
- **Focus on the positive first.** Score improvements are motivating. Then address remaining gaps.
- **Use this as a renewal tool.** "Your score jumped 26 points after implementing our recommendations — that's the value of continued investment."

---

## Workflow 3: MSP Customer Onboarding Assessment

**Scenario:** An MSP is onboarding a new customer and needs a baseline security posture assessment.

### Steps

1. Open the **Assess** workbench (main workspace)
2. Upload the customer's config (HTML or XML export)
3. Set **customer context** — name, environment type (Education, Healthcare, etc.), country, compliance frameworks
4. Review the deterministic analysis — posture scorecard, risk widgets, compliance alignment
5. **Generate AI reports** — Technical Handover, Executive Summary, Compliance Readiness (all three in one click)
6. **Save to Report Centre** for the customer library
7. Set up the **Client Portal** for ongoing self-service access
8. Optionally install the **Connector Agent** for scheduled re-assessments

### Best Practices

- **Select the right compliance frameworks.** For UK Education, use GDPR + Cyber Essentials + NCSC + DfE/KCSIE. FireComply auto-suggests defaults based on environment and country.
- **Use the Technical Handover as your baseline.** It documents every rule, zone, and setting — use it as the onboarding record.
- **Set up the Client Portal early.** Branded portals with the customer's logo build trust and reduce "send me the latest report" emails.
- **Install the Connector Agent.** Automated daily/weekly scans mean you catch drift before the customer notices.

---

## Workflow 4: Quick Internal Demo

**Scenario:** You need to show a colleague or partner what FireComply does in 2 minutes.

### Steps

1. Go to the login page
2. Click **"Try Demo Mode"**
3. Walk through:
   - Hero outcome panel (score, critical issues, readiness indicators)
   - Security Posture Scorecard (deterministic, not AI)
   - Remediation Impact Simulator (toggle fixes, watch score improve)
   - Generate a report (AI-powered, ~30 seconds)
   - Show export options (PDF, Word, PPTX, ZIP)
4. If time: show Fleet, Customers, Mission Control with demo data

### Best Practices

- **Lead with the outcome, not the upload.** Demo mode skips the upload step and goes straight to results.
- **Use the 2-minute demo script** — see [`docs/2_MINUTE_DEMO_SCRIPT.md`](../2_MINUTE_DEMO_SCRIPT.md)
- **Don't deep-dive into settings.** The demo is about the value, not the configuration.

---

## General Best Practices

1. **Always use the in-app guided tours** when showing FireComply to someone for the first time. They provide context that screenshots can't.
2. **The deterministic layer is your credibility.** AI generates the reports, but the findings, scores, and evidence are all computed locally from the config data. Lead with this.
3. **Never share raw config data.** FireComply anonymises data before it leaves the browser for AI processing. Mention this to security-conscious customers.
4. **Use the Remediation Impact Simulator** on calls — it turns a static report into an interactive conversation about priorities.
5. **Check the Changelog** (`/changelog` in-app) before customer meetings to stay current on new features.
