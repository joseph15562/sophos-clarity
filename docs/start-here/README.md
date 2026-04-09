# Start Here — FireComply Documentation

Welcome to FireComply. This folder contains everything you need to get started, whether you're an MSP partner, a Sophos Sales Engineer, or evaluating the platform.

FireComply is primarily an **MSP platform** — a multi-tenant workspace for managing Sophos firewall security posture across your entire customer portfolio. It also includes a dedicated **SE Health Check** workflow for Sophos Sales Engineers conducting pre-sales and post-sales firewall reviews.

---

## Quick Start

| What you want       | Read this                                     |
| ------------------- | --------------------------------------------- |
| **30-second pitch** | [01 — Elevator Pitch](./01-elevator-pitch.md) |

---

## MSP Guides (Primary)

These guides cover the core MSP platform — the main use case for FireComply.

### Understanding the Platform

| Guide                                                                       | What it covers                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [10 — Why FireComply for MSPs](./10-why-firecomply-for-msps.md)             | Business value, commercial angle, what changes for your MSP practice      |
| [11 — MSP Customer Onboarding](./11-msp-customer-onboarding.md)             | End-to-end onboarding workflow: first assessment to continuous monitoring |
| [18 — MSP Workflows & Best Practices](./18-msp-workflows-best-practices.md) | QBR prep, incident response, compliance audits, upsell, team handoffs     |

### Feature Walkthroughs (MSP)

| Guide                                                                         | What it covers                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [05 — MSP Assessment Workbench](./05-walkthrough-msp-assess.md)               | Upload configs, run analysis, generate reports, manage compliance          |
| [12 — Fleet Command](./12-walkthrough-fleet-command.md)                       | Unified firewall view, search/filter, map, per-firewall detail             |
| [13 — Mission Control](./13-walkthrough-mission-control.md)                   | Dashboard KPIs, alerts, threat charts, portfolio health                    |
| [14 — Client Portal](./14-walkthrough-client-portal.md)                       | Branded customer portals: branding, sections, access control, vanity slugs |
| [15 — Drift Monitor & Portfolio Insights](./15-walkthrough-drift-insights.md) | Config change tracking, cross-customer analytics, trend reporting          |
| [16 — Integrations Hub](./16-walkthrough-integrations.md)                     | Sophos Central, ConnectWise, Autotask, Slack, Teams, webhooks, API keys    |
| [17 — Report Centre & Scheduled Reports](./17-walkthrough-report-centre.md)   | Report library, scheduling, email delivery, archives, bulk actions         |
| [07 — Connector Agent](./07-walkthrough-connector-agent.md)                   | Install the agent, add firewalls, automate config collection               |
| [08 — AI Reports & Deliverables](./08-walkthrough-ai-reports.md)              | Report types, prompt engineering, export formats, best practices           |

---

## SE Guides

These guides cover the SE Health Check workflow — a focused tool for Sophos Sales Engineers conducting one-off firewall reviews.

| Guide                                                                             | What it covers                                             |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [02 — Why FireComply for SEs](./02-why-firecomply-for-ses.md)                     | SE-specific benefits: speed, consistency, credibility      |
| [03 — SE Workflows & Best Practices](./03-se-workflows-and-best-practices.md)     | Pre-sales health check, improvement reviews, demo workflow |
| [04 — Using FireComply with a Customer](./04-using-firecomply-with-a-customer.md) | Before/during/after the meeting, customer FAQ              |
| [06 — SE Health Check](./06-walkthrough-se-health-check.md)                       | Request config, review on a call, deliver branded report   |

---

## Product Brief

The full product brief is available as:

- **PDF** — [`docs/Sophos FireComply — Product Brief.pdf`](../Sophos%20FireComply%20—%20Product%20Brief.pdf)
- **HTML** (with screenshots) — [`docs/Sophos FireComply — Product Brief.html`](../Sophos%20FireComply%20—%20Product%20Brief.html)

---

## Further Documentation

The [`docs/`](../) folder contains detailed technical and operational documentation:

### Product & Positioning

- [2-Minute Demo Script](../2_MINUTE_DEMO_SCRIPT.md) — scripted walkthrough for live demos
- [Product Assessment](../PRODUCT-ASSESSMENT.md) — feature-level product evaluation
- [Roadmap](../ROADMAP.md) — planned features and priorities

### Security & Privacy

- [Data Privacy](../DATA-PRIVACY.md) — how FireComply handles customer data
- [Threat Model (STRIDE)](../threat-model-stride-oneshot.md) — security threat analysis

### Operations & Infrastructure

- [Demo Account](../DEMO-ACCOUNT.md) — how the public demo mode works
- [Self-Hosted](../SELF-HOSTED.md) — self-hosting guide
- [Supported SFOS Versions](../SUPPORTED-SFOS-VERSIONS.md) — which firmware versions are supported
- [Scale Triggers](../SCALE-TRIGGERS.md) — when to scale infrastructure

### API & Integrations

- [API Reference](../api/) — OpenAPI spec and edge route documentation
- [Sophos Central Setup](../sophos-central-setup.md) — connecting to Sophos Central API
- [Firewall API Setup](../firewall-api-setup.md) — setting up the XML API for connector agents
- [Connector Agent SDK](../firecomply-connector-sophos-firewall-sdk.md) — connector technical details

### Feature Documentation

- [SE Health Check Report](../se-health-check-report.md) — report structure and content
- [Tenant Model](../TENANT-MODEL.md) — multi-tenancy architecture
- [UI Notifications](../UI-NOTIFICATIONS.md) — notification system design
- [Changelog Policy](../CHANGELOG-POLICY.md) — how in-app changelog is maintained

### Architecture Decision Records

- [`docs/adr/`](../adr/) — architectural decisions and rationale

### Plans & Specs

- [`docs/plans/`](../plans/) — feature plans, specs, and backlog items

---

## In-App Resources

FireComply also includes built-in documentation:

- **Guided Tours** — click the **?** button in the top bar to launch interactive step-by-step overlays for any page
- **Help Centre** — navigate to `/help` for in-app documentation
- **Changelog** — navigate to `/changelog` for release notes
- **Demo Mode** — click "Try Demo Mode" on the login page to explore without an account
