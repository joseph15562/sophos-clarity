# Walkthrough: Integrations Hub

The Integrations Hub (`/api`) connects FireComply to your existing MSP toolstack — Sophos Central for fleet discovery, PSA tools for ticketing and billing, messaging platforms for alerts, and webhooks for automation.

## Sophos Central

**Status:** Core integration — most MSPs connect this first.

### What It Does

- Discovers all tenants (customers) and their firewalls from your Central partner account
- Pulls firmware version, HA status, managed state, alert counts, and geo-location per firewall
- Enriches Fleet Command with Central data alongside config-based analysis
- Powers the Mission Control alerts table and threat charts

### Setup

1. Open **Integrations Hub** → **Sophos Central** card
2. Enter your Central API credentials:
   - **Client ID** — from Sophos Central > Global Settings > API Credentials Management
   - **Client Secret** — generated alongside the Client ID
3. Select scope — Partner-level for multi-tenant MSPs
4. FireComply tests the connection and begins discovering tenants

### What Changes After Connecting

- **Fleet Command** shows firewalls from Central — even those you haven't assessed yet (appearing as "Unlinked")
- **Mission Control** populates the alerts table and threat chart with real Central data
- **Customer Directory** auto-populates customers from Central tenants
- **Assess Workbench** enriches analysis with firmware, HA, and alert context

## ConnectWise Cloud (Partner Cloud API)

**What It Does:** Syncs customer and device data from your ConnectWise Cloud environment using OAuth client credentials.

### Setup

1. Open **Integrations Hub** → **ConnectWise Cloud** card
2. Configure OAuth client credentials (Client ID + Secret)
3. Map ConnectWise companies to FireComply customers

### Use Cases

- Automatic customer discovery from ConnectWise
- Device inventory sync
- Customer metadata enrichment

## ConnectWise Manage

**What It Does:** Creates tickets from assessment findings in your ConnectWise Manage PSA.

### Setup

1. Open **Integrations Hub** → **ConnectWise Manage** card
2. Enter your Manage API credentials (company, public key, private key)
3. Configure ticket mapping — board, status, priority mapping from finding severity

### Use Cases

- **Bulk ticket creation** from the Assess workbench — select findings and push them to Manage as tickets
- Remediation tracking through your existing PSA workflow
- Customer billing integration

## Datto Autotask PSA

**What It Does:** Similar to ConnectWise Manage — creates tickets from assessment findings in your Autotask PSA.

### Setup

1. Open **Integrations Hub** → **Datto Autotask** card
2. Enter Autotask API credentials
3. Configure ticket mapping

### Use Cases

- Ticket creation from findings
- Remediation tracking
- Integration with existing MSP workflows

## Slack

**What It Does:** Sends FireComply notifications to Slack channels.

### Notifications Include

- Assessment completion alerts
- Score change notifications
- Critical finding alerts
- Agent offline warnings

### Setup

1. Open **Integrations Hub** → **Slack** card
2. Authorise the Slack integration (OAuth flow)
3. Select the channel for notifications
4. Configure which event types to send

## Microsoft Teams

**What It Does:** Sends FireComply notifications to Teams channels via incoming webhooks.

### Setup

1. Open **Integrations Hub** → **Microsoft Teams** card
2. Configure the Teams webhook URL
3. Select which event types to send

### Notifications

Same event types as Slack — assessment complete, score changes, critical findings, agent status.

## Webhooks

**What It Does:** Sends HTTP POST requests to any endpoint when events occur — use this for custom integrations, RMM tools, or internal dashboards.

### Event Types

| Event                 | When it fires                                             |
| --------------------- | --------------------------------------------------------- |
| `assessment_complete` | An assessment finishes (manual upload or connector agent) |
| `score_change`        | A firewall's score changes between assessments            |
| `critical_finding`    | A new critical-severity finding is detected               |
| `agent_offline`       | A connector agent stops sending heartbeats                |

### Setup

1. Open **Integrations Hub** → **Webhooks** tab
2. Add a webhook endpoint URL
3. Select which events to subscribe to
4. Optionally add a secret for HMAC signature verification
5. View the delivery log to debug failed deliveries

## Scoped Service Keys

**What It Does:** Generates org-level API keys for programmatic access — useful for RMM integrations, custom scripts, or third-party tooling.

### Setup

1. Open **Integrations Hub** → **Scoped Service Keys** section
2. Create a new key with a descriptive name
3. Set permissions/scope
4. Copy the key — it's only shown once

## Connector Agents (Agents Tab)

The Agents tab in the Integrations Hub shows all registered connector agents:

| Column            | Detail                                    |
| ----------------- | ----------------------------------------- |
| Hostname          | Machine where the agent is installed      |
| Status            | Online/offline based on heartbeat         |
| Connector version | Compared against latest available version |
| Last heartbeat    | When the agent last checked in            |
| Firewalls         | Count of firewalls the agent monitors     |
| Activity          | Recent assessment runs from this agent    |

### Agent Management

- Register new agents (generates API key)
- Monitor heartbeat status
- Check for version updates
- View activity history

## API Reference (API Tab)

The API tab provides reference documentation for FireComply's own API:

- Endpoint reference (`API_REFERENCE_ENDPOINTS`)
- Usage charts (mock/demo)
- API explorer patterns

## How MSPs Use the Integrations Hub

### Day 1 Setup

1. **Sophos Central** — connect first for fleet discovery
2. **Connector Agents** — install on customer networks for automated config collection
3. **Slack or Teams** — connect for real-time notifications
4. **PSA** — connect ConnectWise or Autotask for ticket workflow

### Ongoing

- Monitor agent health in the Agents tab
- Check webhook delivery logs for failed notifications
- Rotate service keys periodically
- Update PSA mappings when board/queue structures change

## In-App Guided Tour

Click the **?** button → select "Integrations" tour for a step-by-step walkthrough of the configuration options.
