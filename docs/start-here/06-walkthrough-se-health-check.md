# Walkthrough: SE Health Check

The SE Health Check is a purpose-built tool for Sophos Sales Engineers. It streamlines the pre-sales and post-sales firewall review process into a repeatable, professional workflow.

## Accessing the Health Check

- Click the **stethoscope icon** in the workspace header (top bar)
- Or navigate directly to `/health-check`
- The first time you visit, an in-app guided tour starts automatically

## The Full Workflow

### 1. Request a Customer Config Upload

Instead of asking the customer to email you a config file, generate a secure upload link:

1. Click **"Request Config Upload"**
2. Fill in: Customer name, Contact person, Email address, Link expiry (1–30 days)
3. Click **Send** — the customer receives a branded email with:
   - Instructions to export their Sophos XGS config
   - A drag-and-drop upload portal
   - Optional Sophos Central API connection (Client ID + Secret)
   - The link expiry date

### 2. Customer Uploads (Their Side)

The customer's experience is simple:

1. They receive a professional email from FireComply
2. They click the link and see a branded upload page
3. They drag and drop their `entities.xml` file (or paste the HTML export)
4. Optionally, they enter Sophos Central API credentials — this enriches the analysis with firmware, HA status, managed state, and alerts
5. If Central is connected, they select which firewall to link
6. Done — they see a confirmation. No account needed.

### 3. SE Gets Notified

- You receive an email: "Configuration Uploaded" with an "Open FireComply" button
- The config appears in your **Upload Requests** panel with a "Load Config" button

### 4. Load and Review

1. Click **"Load Config"** — the analysis runs automatically
2. Everything pre-populates: customer name, firewall hostname, Central enrichment (if connected)
3. **Set the licence tier**: Xstream Protection, Standard Protection, or Individual Modules
   - This determines which of the 37 best-practice checks are applicable
   - Xstream includes all checks; Standard excludes Zero-Day and Central Orchestration modules

### 5. Qualifying Questions (The On-Call Conversation)

These toggles appear in the results and are designed to be used during a live call:

| Question                                              | Why It Matters                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Security Heartbeat excluded** (no Sophos endpoints) | If the customer has no Sophos endpoint estate, the Heartbeat check is excluded from scoring |
| **MDR threat feeds configured** (export gap)          | MDR config doesn't appear in the export — SE confirms verbally                              |
| **NDR Essentials enabled** (export gap)               | Same as above — confirm on the appliance                                                    |
| **DNS Protection configured** (export gap)            | DNS Protection IPs may not appear in the config export                                      |
| **DPI exclusion zones**                               | Select zones where deploying the signing certificate isn't practical (e.g., Guest WiFi)     |
| **Web filter exempt rules**                           | Rules intentionally excluded from web filter compliance                                     |

Each toggle adjusts the best-practice score in real-time. The customer sees the score change as you discuss each item.

### 6. Review the Score

The best-practice posture panel shows:

- **Score** (0–100) and **Grade** (A–F)
- **Passed / Failed / Verify** counts
- **Findings by severity**: Critical, High, Medium, Low, Info
- **Per-category breakdown**: Device Hardening, Visibility & Monitoring, Encryption & Inspection, etc.
- **Priority next steps**: Top 5 critical/high items with specific remediation instructions

### 7. SE Engineer Notes

The tool auto-generates first-person conversational notes:

> "I reviewed the configuration export as part of this health check. The appliance is licenced with Sophos Firewall Xstream Protection. Overall the appliance scored 66% against Sophos best practices, earning a Grade C..."

These are **template-generated** (not AI) — so the numbers are always mathematically accurate. Read them aloud on the call or include them in the report.

### 8. Export and Deliver

| Action               | Result                                                         |
| -------------------- | -------------------------------------------------------------- |
| **Send to customer** | Emails the branded PDF report directly to the customer's email |
| **Send to SE**       | Emails the report to the logged-in SE's email                  |
| **Share link**       | Generates a read-only URL the customer can bookmark            |
| **PDF**              | Download the full health check as a branded PDF                |
| **HTML**             | Download as a self-contained HTML file                         |
| **Summary JSON**     | Machine-readable summary for integration                       |
| **Findings CSV**     | Spreadsheet-friendly findings export                           |
| **ZIP**              | PDF + HTML bundled together                                    |

### 9. Save for Follow-Up

The health check is automatically saved. Return anytime to:

- Review the previous assessment
- Compare against a new upload
- Show improvement over time

## Assessment Scope Section

The report includes a formal "Assessment scope and exclusions" section documenting:

- DPI exclusion zones/networks selected
- Active threat response SE acknowledgements (MDR, NDR, DNS)
- Synchronized Security scope (Heartbeat exclusion)
- Web filter compliance mode (Strict vs Informational)
- Excluded rule names

This transparency is important for audit — it shows exactly what was and wasn't assessed.

## Tips

- **Use Central connection** whenever possible — it adds firmware version, HA cluster detection, and managed state to the report for free
- **The score is designed for conversation** — it's not a pass/fail. Grade C means "several areas that would benefit from attention," not "you failed"
- **Qualifying questions are upsell opportunities** — "Do you have MDR?" naturally opens a conversation
- **Send the report before the call ends** — the customer seeing it arrive in real-time is impressive
