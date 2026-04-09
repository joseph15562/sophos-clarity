# MSP Customer Onboarding Workflow

This guide walks through onboarding a new customer onto FireComply — from first assessment to continuous monitoring.

## Phase 1: Initial Assessment

### Option A: Manual Upload (Quickest Start)

1. Ask the customer to export their firewall config:
   - Sophos XGS web console → **Backup & firmware > Export** (HTML export)
   - Or use the XML entities export from Backup & firmware
2. Open the **Assess** workbench (`/` — the default landing page)
3. Drag and drop the config file(s) — multi-firewall uploads are supported
4. Set **customer context**:
   - Customer name (used in report headers and cover pages)
   - Environment type — Education, Healthcare, Finance, Government, Retail, etc.
   - Country (determines compliance framework defaults)
   - Compliance frameworks — FireComply auto-suggests based on environment + country
5. Review the deterministic analysis — posture score, findings, compliance alignment
6. Generate AI reports (Technical Handover + Executive Summary + Compliance Readiness)
7. Save to the Report Centre

### Option B: Connector Agent (Automated, Recommended for Ongoing)

1. Open the **Integrations Hub** (`/api`) → **Agents** tab
2. Click **Register Agent** to get an API key
3. Install the Connector Agent on a machine with network access to the customer's firewall(s):
   - Download for Windows, macOS, or Linux
   - Enter the API key during setup
4. In the agent, add the customer's firewall(s):
   - Hostname or IP address
   - API port (default 4444)
   - API username and password (read-only profile — see the built-in setup guide)
   - Optional SNMP community string for serial number
5. Test the connection — the agent verifies API access
6. The agent pulls the config automatically and pushes it to your workspace
7. Assessments appear in Fleet Command with score, grade, and status

### Option C: Sophos Central Integration

If the customer's firewalls are managed via Sophos Central:

1. Open the **Integrations Hub** → **Sophos Central** card
2. Enter your Central partner API credentials (Client ID + Secret)
3. FireComply discovers all tenants and their firewalls
4. Firewalls appear in Fleet Command with Central-enriched data (firmware, HA, alerts, managed state)
5. You can then upload configs manually or via Connector Agent to score them — Central provides the inventory, you provide the config analysis

## Phase 2: Customer Directory Setup

1. Navigate to **Customer Directory** (`/customers`)
2. Click **Add Customer** (or the customer appears automatically when you save an assessment)
3. Fill in details:
   - Customer name, sector, country
   - Contact email
   - Compliance environment
4. The customer card shows:
   - Score and grade (from latest assessment)
   - Firewall count (HA-aware logical count)
   - Health status (Healthy, At Risk, Critical, Overdue)
   - Last assessed date
   - Linked compliance frameworks
5. Pin important customers for quick access

## Phase 3: Client Portal Configuration

Give your customer a branded self-service view of their posture.

1. From the Customer Directory, click the customer's name → **Configure Portal**
2. Set branding options:
   - **Company logo** — upload your MSP logo or the customer's
   - **Accent colour** — match your brand (default: FireComply blue)
   - **Company name** — shown in the portal header
   - **Welcome message** — displayed on the portal landing page
   - **SLA information** — response times, coverage hours
   - **Contact details** — email and phone for support
   - **Footer text** — custom footer message
3. Choose **visible sections**:
   - Score overview — posture gauge and grade
   - Score history — trend chart over time
   - Findings — severity-filtered, expandable finding details
   - Compliance — framework alignment indicators
   - Reports — downloadable saved reports (PDF, Word)
   - Feedback — customer satisfaction form
4. Set the **vanity slug** — e.g., `acme-security` → `yourapp.com/portal/acme-security`
5. Add **portal viewers** — enter email addresses for customer staff who should have access. They authenticate via the portal without needing a workspace account.
6. Share the portal URL with the customer

## Phase 4: Continuous Monitoring

### Connector Agent Schedule

- Agents pull configs on a configurable schedule (daily, weekly, or custom)
- Each pull runs the deterministic analysis automatically
- Scores update in Fleet Command and the Customer Directory
- Drift Monitor captures snapshots for comparison

### Scheduled Reports

1. Open the **Management Panel** → **Settings** → **Scheduled Reports**
2. Create a schedule:
   - **Name** — e.g., "Acme Monthly Posture Report"
   - **Frequency** — weekly, monthly, or quarterly
   - **Report type** — one-pager, executive summary, or compliance
   - **Sections** — score overview, findings summary, compliance status, remediation plan
   - **Recipients** — customer email addresses
3. Enable the schedule — reports generate and deliver automatically
4. Use **Send now** for ad-hoc delivery, **Preview** to check before sending

### Drift Monitoring

1. Open **Drift Monitor** (`/drift`)
2. Select a firewall from the dropdown (populated from Connector Agents)
3. View the snapshot timeline — each connector scan creates a snapshot
4. Snapshots show:
   - Score before and after
   - Findings added (new issues)
   - Findings removed (resolved issues)
   - Specific config changes
5. Cross-customer drift history shows recent changes across your entire portfolio

### Alert Rules (Drift Monitor)

Set up rules to be notified when:

- Score drops below a threshold
- Critical findings are introduced
- Specific config sections change
- An agent goes offline

## Phase 5: Ongoing Customer Management

### Quarterly Business Reviews

1. Open the **Client Portal** for the customer — share your screen during the QBR
2. Walk through the score trend (visible in the portal's history section)
3. Reference saved reports from the Report Centre
4. Use **Portfolio Insights** (`/insights`) for cross-customer benchmarking — "Your score of 78% is above the portfolio average of 71%"
5. Highlight resolved findings since last QBR
6. Identify remaining gaps and agree on remediation priorities

### Customer Health Tracking

The Customer Directory shows health status per customer:

| Status       | Meaning                                                |
| ------------ | ------------------------------------------------------ |
| **Healthy**  | Recent assessment, score above threshold, no criticals |
| **At Risk**  | Medium-severity issues or declining score trend        |
| **Critical** | Critical findings or very low score                    |
| **Overdue**  | Assessment is stale — no recent scan or upload         |

Use the **Needs follow-up** filter to see only customers requiring attention.

### Portfolio Pulse

The Customer Directory includes a **Portfolio Pulse** bar showing what percentage of your customers are at Grade A or B. Use this for leadership or board-level reporting: "72% of our managed estate is at Grade A or B."

## Checklist: New Customer Onboarding

- [ ] Customer config obtained (manual upload, connector agent, or Central)
- [ ] Customer context set (name, environment, country, frameworks)
- [ ] Initial assessment complete — score and findings reviewed
- [ ] AI reports generated and saved to Report Centre
- [ ] Customer added to Customer Directory
- [ ] Client Portal configured with branding and vanity slug
- [ ] Portal viewers added (customer staff emails)
- [ ] Portal URL shared with customer
- [ ] Connector Agent installed (if ongoing monitoring)
- [ ] Scheduled reports configured (if automated delivery)
- [ ] Integrations set up (Central, PSA, Slack/Teams as needed)
