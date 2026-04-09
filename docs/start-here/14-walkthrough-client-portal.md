# Walkthrough: Client Portal

The Client Portal gives your customers a branded, self-service view of their firewall security posture. Customers see their score, findings, compliance alignment, and downloadable reports — without needing a FireComply workspace account.

## Setting Up a Portal

### From the Customer Directory

1. Open **Customer Directory** (`/customers`)
2. Click a customer's name to open the detail sheet
3. Click **Configure Portal**

### Branding Options

| Setting         | What it does                                                  | Default          |
| --------------- | ------------------------------------------------------------- | ---------------- |
| Company logo    | Shown in the portal header — upload your MSP or customer logo | FireComply logo  |
| Company name    | Displayed alongside the logo in the header                    | Your org name    |
| Accent colour   | Primary brand colour used throughout the portal               | `#2006F7` (blue) |
| Welcome message | Text shown on the portal landing/hero area                    | —                |
| SLA information | Response times, coverage hours displayed in the portal        | —                |
| Contact email   | Support email shown in the portal footer/contact section      | —                |
| Contact phone   | Support phone number shown in the portal                      | —                |
| Footer text     | Custom text in the portal footer                              | —                |
| Show branding   | Toggle branding elements on/off                               | On               |

### Visible Sections

Control what your customer can see. Toggle each section independently:

| Section    | What it shows                                                                  |
| ---------- | ------------------------------------------------------------------------------ |
| Score      | Posture gauge with overall score (0–100) and grade (A–F)                       |
| History    | Score trend chart over time                                                    |
| Findings   | Severity-filtered findings list with expandable details per firewall           |
| Compliance | Framework alignment indicators (Cyber Essentials, NCSC, ISO 27001, GDPR, etc.) |
| Reports    | Downloadable saved reports — PDF and Word export available                     |
| Feedback   | Customer satisfaction form (star rating + free text)                           |

### Vanity Slug

Each portal gets a unique URL:

- Auto-generated from the customer name with a random suffix
- Customisable — e.g., `acme-security` → `yourapp.com/portal/acme-security`
- Must be 12–48 characters, lowercase, hyphens allowed
- Slug is validated for uniqueness

### Portal Viewers (Access Control)

Portal access is controlled by email address:

1. In the portal configurator, click **Add Viewer**
2. Enter the customer's email addresses
3. Those users can access the portal by authenticating with their email — they don't need a FireComply workspace account
4. MSP workspace members (admins and viewers) always have access to any portal in their org

## What the Customer Sees

### Score Overview

A large gauge showing the current best-practice score and grade. Immediately communicates posture at a glance.

### Score History

A line chart showing how the score has changed over time. Useful for demonstrating improvement after remediation work. Each point corresponds to an assessment run (manual upload or connector agent scan).

### Findings

Findings are severity-coded (critical, high, medium, low, info) with:

- Title and category
- Detail description
- Remediation guidance
- Per-firewall labels when the customer has multiple devices

Customers can filter by severity. Findings expand to show full detail.

When the customer has an HA pair, the portal intelligently merges the pair for display — showing one logical firewall rather than confusing dual entries.

### Compliance

Framework alignment derived from findings. The portal maps finding titles against framework controls for:

- Cyber Essentials
- NCSC Guidelines
- ISO 27001
- GDPR

Shows a simple pass/partial/gap indicator per framework.

### Reports

Saved reports linked to this customer are available for download. Customers can download in PDF or Word format directly from the portal. Only non-archived reports are shown.

### Feedback

A simple satisfaction form — star rating and optional free text. Responses are submitted as toast notifications (lightweight feedback collection).

## How MSPs Use Client Portals

### Initial Customer Handoff

After completing the first assessment and generating reports:

1. Configure the portal with your branding
2. Set visible sections (typically all six for engaged customers)
3. Share the vanity URL with the customer's IT contact
4. Walk them through the portal on a call: "Bookmark this URL — your posture score, findings, and reports are always current here"

### QBR Support

Open the customer's portal and share your screen during the Quarterly Business Review:

- **Score** — "Your current posture is 82%, Grade B"
- **History** — "You've improved from 54% since we started 9 months ago"
- **Findings** — "3 medium-severity items remain — let's review"
- **Reports** — "Here's this quarter's report — I'll send the link after the call"

### Reducing Support Tickets

Before client portals, every "what's our current status?" request meant an email, a report attachment, and a follow-up. Now, direct customers to their portal: "Your posture is always available at this URL."

### White-Label Appearance

With your logo, accent colour, and custom messaging, the portal looks like your own product. Customers see your brand, not FireComply's.

## Portal Data Flow

Portal data stays current automatically:

- When a **Connector Agent** pushes a new config → score updates → portal reflects the new score
- When you **upload manually** in the Assess workbench → save the assessment → portal updates
- When you **save a report** to the Report Centre → it appears in the portal's Reports section
- **Archived reports** are hidden from the portal — use archiving to manage what customers see

## In-App Guided Tour

Click the **?** button → select "Client Portal" tour for a step-by-step walkthrough of the configurator and portal viewer experience.
