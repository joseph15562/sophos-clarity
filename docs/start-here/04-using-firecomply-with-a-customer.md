# Using FireComply with a Customer

## Before the Meeting

### Preparation Checklist

- [ ] Know the customer's environment type (Education, Healthcare, Finance, etc.)
- [ ] Know their country and any specific compliance requirements
- [ ] Check if they have Sophos Central — if so, have them prepare API credentials (Client ID + Secret)
- [ ] Decide whether to request config upload in advance (recommended) or upload live on the call
- [ ] If pre-sales: know which licence tier they're evaluating (Standard vs Xstream)

### Requesting Config Upload in Advance

**Recommended for most meetings.** This lets you review the analysis before the call.

1. Open SE Health Check → "Request Config Upload"
2. Enter: customer name, contact person, their email, link expiry
3. The customer gets a professional, branded email with:
   - What they need to do (export config from their Sophos XGS)
   - Where to upload (secure drag-and-drop portal)
   - Optional Central API connection
   - Link expiry date
4. When they upload, you get a notification email
5. Load the config before the meeting so you're prepared

**Tip:** Set the link expiry to match your meeting timeline. 7 days is usually enough.

---

## During the Meeting

### Opening (2 minutes)

- Share your screen showing the SE Health Check results
- Start with the **best-practice score** — e.g., "Your firewall scored 66% against Sophos best practices, which is a Grade C"
- Frame it positively: "Out of 37 checks, 22 passed. Let me walk you through the 10 that didn't and the 5 we should verify on the console."

### Walking Through Findings (10–15 minutes)

- Use the **category view**: Device Hardening, Visibility & Monitoring, Encryption & Inspection, Rule Hygiene, Network Protection, VPN Security, Active Threat Response, Synchronized Security, Web Protection, Zero-Day Protection, DNS Protection, Resilience
- For each failed check, the tool shows:
  - What the check looks for
  - What it found in their config
  - The Sophos recommendation
  - How to remediate (with navigation paths in the XGS console)
- **Use qualifying questions as natural discussion points:**
  - "I see Security Heartbeat isn't configured on any WAN rules — do you have Sophos-managed endpoints?" → If yes, easy win. If no, sales opportunity.
  - "MDR threat feeds aren't in the export — is that something you've enabled?" → MDR conversation.
  - "There are no SSL/TLS decrypt rules — is there a reason DPI isn't active?" → DPI discussion.

### Adjusting the Score Live (2 minutes)

- Toggle the qualifying questions — the score recalculates in real-time
- This is powerful on screen: "If we acknowledge that MDR is configured and exclude the Guest zone from DPI, your score goes from 66% to 74%"
- Frame it as: "These are the quick wins. The remaining gaps are where we should focus."

### Closing (2 minutes)

- Click **"Send to customer"** — the branded PDF arrives in their inbox during the call
- Or share a **read-only link** they can bookmark
- Say: "I've sent you the full report with all findings, remediation steps, and the SE notes I just walked through. Let me know if you'd like to schedule a follow-up to work through the top 5 items."

---

## After the Meeting

### Follow-Up Actions

1. **Save the health check** — it's automatically persisted, but add any notes
2. **Book a remediation session** if the customer wants help implementing fixes
3. **Schedule a re-assessment** in 3–6 months to show improvement
4. **For MSPs:** Convert the one-off health check into an ongoing assessment in the main Assess workbench, set up a Client Portal, and consider installing the Connector Agent

### What to Send

| Audience           | What to Send                                            | Format                             |
| ------------------ | ------------------------------------------------------- | ---------------------------------- |
| Technical contact  | Full health check report                                | PDF (emailed from the tool)        |
| IT Manager         | Same report — the Executive Summary section is built-in | PDF                                |
| C-Suite / Board    | Executive Summary AI report (from MSP Assess)           | PDF or shared link                 |
| Compliance Officer | Compliance Readiness Report (from MSP Assess)           | PDF with framework evidence tables |

---

## Common Customer Questions (and Answers)

**"Is my config data safe?"**

> Yes. The config is parsed client-side in your browser. When AI reports are generated, the data is anonymised (hostnames, IPs replaced with tokens) before leaving the browser. The AI generates the report using anonymised data, and real values are restored in the response stream. No raw config is stored server-side.

**"Do I need a FireComply account?"**

> No. The upload portal works with just the secure link — no account required. The SE handles everything on their end.

**"Can we do this ourselves?"**

> The SE Health Check is designed for SE-led reviews. For ongoing self-service, we can set up the MSP Assessment Workbench with a Client Portal, where you can view your posture, findings, and reports anytime.

**"How does the score work?"**

> The score is based on 37 Sophos best-practice checks, weighted by category and severity. It's deterministic — same config always produces the same score. The AI is only used for the written report, not the score itself.

**"What firewalls are supported?"**

> Sophos XGS and SFOS (XG) firewalls. Both HTML exports (from the web console) and XML entities exports (from backup or API) are supported.
