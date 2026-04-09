# Walkthrough: Drift Monitor & Portfolio Insights

## Drift Monitor

The Drift Monitor tracks configuration changes between assessment snapshots. When a rule is added, a setting is changed, or a score shifts, Drift Monitor captures exactly what happened.

### Prerequisites

Drift detection requires multiple assessment snapshots for comparison. The most effective setup:

- **Connector Agents** pushing configs on a schedule (daily or weekly)
- Each push creates a snapshot, and consecutive snapshots are compared

Without Connector Agents: the Drift Monitor shows an empty state with guidance to deploy agents.

### Firewall Selector

Choose a firewall from the dropdown — populated from your Connector Agents. Each firewall has its own drift timeline.

### Snapshot Timeline

Each row in the timeline represents a config change event:

| Column           | Detail                                          |
| ---------------- | ----------------------------------------------- |
| Date             | When the snapshot was captured                  |
| Score before     | Posture score from the previous snapshot        |
| Score after      | Posture score from this snapshot                |
| Findings added   | New findings that appeared since last snapshot  |
| Findings removed | Findings that were resolved since last snapshot |
| Config changes   | Specific configuration changes detected         |

### Snapshot Detail

Click any snapshot to see the full detail:

- Complete list of added findings with severity
- Complete list of removed findings
- Narrative description of config changes
- Before/after score comparison

### Compare Configs

Select two snapshots to compare side-by-side:

- Choose the baseline (earlier) and comparison (later) dates
- View a diff summary: sections changed, settings modified, rules added/removed

### Cross-Customer Drift History

Below the per-firewall view, a **drift history strip** shows recent config changes across your entire portfolio:

- Filter by customer
- Each marker shows when a score changed between consecutive assessment runs for a customer
- Useful for spotting unexpected activity across the estate

### Alert Rules

Configure notification rules for drift events:

- Score drops below a threshold
- Critical findings introduced
- Specific config sections change
- Agent goes offline

Alert rules are configured in the Drift Monitor UI and can trigger notifications via connected integrations (Slack, Teams, webhooks).

## Portfolio Insights

Portfolio Insights provides cross-customer analytics and trend data for your entire managed estate. Use it for strategic planning, board reporting, and identifying systemic risks.

### Time Range

Select the analysis window:

- **7 days** — recent activity
- **30 days** — monthly review
- **90 days** — quarterly review
- **12 months** — annual trends
- **Custom** — pick specific dates

### Risk Strip

Headline risk statistics across your portfolio:

- Total findings by severity
- Customers at risk
- Portfolio-wide compliance gaps

### Threat Landscape

A stacked area chart showing threat activity over time:

- **With Central:** Real alert data by type (firewall threats, IPS events, web blocking)
- **Without Central:** Assessment activity as a proxy for engagement

### Compliance & Sector Charts

- **Compliance alignment** across your customer base — how many customers meet, partially meet, or don't meet common frameworks
- **Sector breakdown** — score distribution by industry vertical (Education, Healthcare, Finance, etc.)

### Customer Risk Matrix

A scatter plot showing each customer positioned by:

- Score (x-axis)
- Exposure/risk metrics (y-axis)

Click any point to open a detail sheet with jump links to **Assess** and **Fleet Command** for that customer.

### Recommendations

AI-generated recommendations based on live portfolio data:

- Common gaps across multiple customers
- Systemic configuration weaknesses
- High-impact remediation opportunities
- Dismissible — remove recommendations you've addressed

### Report & Assess Activity

Panels showing:

- Assessment runs over time — are you maintaining a consistent assessment cadence?
- Report generation activity — how many reports delivered per period?

### Score Trend

Portfolio-wide score trend over time — shows whether your managed estate is improving overall.

## How MSPs Use These Tools

### Monthly Security Review

1. Open **Portfolio Insights** with a 30-day range
2. Review the threat landscape chart — any spikes?
3. Check the customer risk matrix — any customers that have worsened?
4. Review the recommendations — address the systemic ones first
5. Open **Drift Monitor** for any flagged customers — what changed?

### Annual Board Report

1. Set Portfolio Insights to **12 months**
2. Screenshot or export:
   - Score trend (showing year-over-year improvement)
   - Compliance charts (showing framework alignment progress)
   - Sector breakdown (showing which verticals are strongest/weakest)
3. Reference the Portfolio Pulse in Customer Directory for the "% at Grade A/B" headline

### Incident Investigation

When something breaks or a customer reports an issue:

1. Open **Drift Monitor** for their firewall
2. Check recent snapshots — did the config change?
3. Identify exactly what changed and when
4. Cross-reference with Central alerts (if connected) via Mission Control

## In-App Guided Tour

Click the **?** button → select "Drift Monitor" or "Portfolio Insights" tours for step-by-step walkthroughs.
