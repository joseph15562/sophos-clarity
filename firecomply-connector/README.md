# FireComply Connector

A standalone Electron desktop agent that connects to Sophos Firewalls (v18–v22) via the XML API, pulls configuration and threat telemetry, runs local analysis, and submits results to FireComply for continuous monitoring.

## Features

- **XML API integration** — authenticates to Sophos Firewall port 4444, retrieves all configuration entities
- **Version-aware** — auto-detects firmware version and adjusts capabilities (NDR for v21.5+ XGS, MDR for v21+, ATP for v19+)
- **Deterministic analysis** — runs the same analysis engine as the FireComply web app locally
- **Threat telemetry** — collects NDR/MDR/ATP status and third-party feed sync state
- **Drift detection** — server-side diff of findings between submissions
- **Offline queue** — queues submissions locally if FireComply API is unreachable
- **Multi-firewall** — monitor multiple firewalls from a single agent
- **System tray** — runs in the background with tray icon and context menu

## Prerequisites

1. **Sophos Firewall** with API access enabled:
   - Administration → Device Access → enable "API" on the LAN/management zone
   - Create a dedicated read-only API admin user
   - Whitelist the agent's IP in "Allowed Source IP"

2. **FireComply account** with an organisation and admin access

3. **Agent API key** — register the agent in FireComply (Settings → Connector Agents → Register Agent) and copy the API key

## Setup

### From GUI (recommended)

1. Download and install the agent for your OS
2. Launch — the Setup Wizard appears on first run
3. Paste your API key and FireComply API URL
4. Add your firewall(s) and test the connection
5. Choose a schedule and start monitoring

### From config file

1. Copy `config.example.json` to the OS user data directory:
   - Windows: `%APPDATA%/firecomply-connector/config.json`
   - macOS: `~/Library/Application Support/firecomply-connector/config.json`
   - Linux: `~/.config/firecomply-connector/config.json`
2. Edit the file with your API key, firewall details, and schedule
3. Launch the app

## Development

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
npm run dist          # All platforms
npm run dist:win      # Windows .exe
npm run dist:mac      # macOS .dmg
npm run dist:linux    # Linux .AppImage + .deb
```

## Security

- Firewall credentials stay on the local machine — only scores, finding titles, and threat status are transmitted
- The API key is shown once at registration and bcrypt-hashed in the database
- All communication to FireComply is over HTTPS
- Config is stored in the OS user data directory — protect with appropriate file permissions
- Self-signed firewall certificates are supported via `skipSslVerify`

## Configuration

| Field | Description | Default |
|-------|-------------|---------|
| `firecomplyApiUrl` | Supabase Edge Function base URL | Required |
| `agentApiKey` | API key from FireComply registration | Required |
| `firewalls` | Array of firewall targets | Required (min 1) |
| `firewalls[].label` | Display name for this firewall | Required |
| `firewalls[].host` | IP address or hostname | Required |
| `firewalls[].port` | XML API port | `4444` |
| `firewalls[].username` | API admin username | Required |
| `firewalls[].password` | API admin password | Required |
| `firewalls[].skipSslVerify` | Accept self-signed certs | `true` |
| `firewalls[].versionOverride` | Force API version string | `null` (auto-detect) |
| `schedule` | Cron expression for assessment runs | `0 2 * * *` (daily 2am) |
| `proxy` | HTTP proxy for outbound API calls | `null` |
| `logFile` | Log file path | `./firecomply-connector.log` |
| `logLevel` | Minimum log level | `info` |
