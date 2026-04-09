# Walkthrough: FireComply Connector Agent

The Connector Agent is a lightweight Electron app that runs on-premises and automates firewall configuration collection. Instead of manually uploading configs, the agent connects to your Sophos XGS firewalls via their XML API, pulls the config on a schedule, runs analysis, and pushes results to your FireComply workspace.

## Why Use the Connector?

| Manual Upload                          | Connector Agent                                |
| -------------------------------------- | ---------------------------------------------- |
| Someone remembers to export the config | Automated on a schedule (daily, weekly, etc.)  |
| Config sits on someone's desktop       | Results push directly to FireComply            |
| Assessments go stale between reviews   | Fleet and Mission Control update automatically |
| One firewall at a time                 | Monitor dozens of firewalls per agent          |
| No drift detection                     | Drift Monitor catches changes between scans    |

## Setup

### Step 1: Register the Agent in FireComply

1. In the FireComply web app, go to **Management Panel → Settings → Connector Agents**
2. Click **"Register Agent"**
3. Enter a name for the agent (e.g., "London Office Agent")
4. Copy the generated **API key** — you'll paste this into the connector during setup

### Step 2: Prepare Each Firewall

Each firewall the agent will monitor needs a **read-only API user**. The connector includes a built-in setup guide with annotated screenshots, but here's the summary:

1. **Create a read-only admin profile**
   - On the Sophos XGS, go to **Profiles → Device Access**
   - Click **Add** → name it `API read only`
   - Set all permissions to read-only

2. **Create an API user**
   - Go to **Authentication → Users**
   - Add a new administrator: username `firecomply-api`
   - Assign the `API read only` profile
   - Set a strong password
   - Enable **API access** for this user

3. **Enable API access**
   - Go to **Administration → Admin Settings**
   - Ensure the API is enabled on the relevant interface/port (default: port 4444)

### Step 3: Install the Connector

- Download the installer for your platform (Windows, macOS, or Linux)
- Run the installer and enter the **API key** from Step 1
- The agent connects to your FireComply workspace and shows "Connected" with a live heartbeat

### Step 4: Add Firewalls

1. In the connector, click **Settings** (or the gear icon)
2. Click **"+ Add Firewall"**
3. Enter:
   - **Label** — friendly name (e.g., "Sophos Wall")
   - **Host / IP** — the firewall's hostname or IP
   - **Port** — API port (default: 4444)
   - **API Username** — `firecomply-api`
   - **API Password** — the password you set
   - **SNMP Community** (optional) — for serial number retrieval
4. Click **"Test API"** to verify connectivity
5. Click **"Test SNMP"** to verify SNMP (optional)

### Step 5: Run a Scan

- Click **"Run Now"** to trigger an immediate scan
- Watch the **Logs** panel to see the agent:
  1. Authenticate with the firewall API
  2. Fetch device info (firmware version, model, serial)
  3. Export all config entities (typically 100–163 sections)
  4. Run analysis
  5. Push results to FireComply
- Subsequent scans run automatically on your configured schedule

## What Happens After a Scan

When a connector pushes new results:

- **Fleet** updates with the latest posture scores
- **Mission Control** KPIs recalculate
- **Drift Monitor** detects changes since the last scan
- **Stale assessment alerts** clear automatically
- The connector's heartbeat timestamp updates in the web app's **Connector Agents** panel

## The Web App Agents Panel

In the FireComply web app, the **Connector Agents** panel (accessible from the API hub or Management Panel) shows:

- All registered agents with hostname, IP, firmware version, model, and score
- **Last heartbeat** timestamp for each agent
- **Remote scan trigger** — click to request an immediate scan from the web app
- Agent status (online/offline)
- Per-agent firewall count

## Troubleshooting

| Issue                                 | Solution                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| "Auth failed" in logs                 | Verify API username/password. Ensure the user has API access enabled in Admin Settings.                  |
| "Connection refused"                  | Check the firewall IP/hostname and port. Ensure the API port (4444) is reachable from the agent machine. |
| SNMP timeout                          | SNMP is optional. Ensure SNMP is enabled on the firewall and the community string matches.               |
| Agent shows "Disconnected"            | Check network connectivity. The agent needs outbound HTTPS to your FireComply workspace.                 |
| Scan completes but no data in web app | Check the agent's API key is correct and the workspace hasn't rotated keys.                              |
