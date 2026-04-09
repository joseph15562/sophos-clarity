# Walkthrough: Mission Control

Mission Control is the MSP dashboard — a high-level overview of your entire portfolio's security posture, alerts, and activity. Open it first thing in the morning.

## KPI Row

Four cards across the top provide headline metrics:

### 1. Total Customers

- Count of customers in your directory
- Subline shows how many have a risk score vs how many are awaiting their first assessment
- **Sparkline:** 90-day trend of assessment runs per day — shows whether you're consistently assessing or falling behind

### 2. Fleet Devices

- Total firewall count across all customers
- Subline splits online vs not-online
- **Sparkline:** Current device count trend

### 3. Critical Alerts

- Count of critical/high-severity alerts from Sophos Central
- Only populated when the Central integration is connected
- **Sparkline:** Alert volume over the last 90 days — useful for spotting escalation patterns

### 4. Compliance Score

- Ring chart showing the average posture score across your portfolio
- Only includes customers with at least one assessment (score > 0)
- Footnote shows sample size: "Based on X of Y customers"

## Threat / Activity Chart

A stacked area chart covering the last 30 days:

- **With Central connected:** Shows Sophos Central firewall alerts by type — threat alerts, IPS events, web blocking events
- **Without Central:** Falls back to **workspace activity** — assessment runs per day, showing your team's assessment cadence

This chart answers: "Is anything spiking?" and "Are we keeping up with assessments?"

## Recent Alerts Table

When Central is connected, shows the 12 most recent alerts:

| Column      | Detail                                              |
| ----------- | --------------------------------------------------- |
| Severity    | Critical, High, Medium, Low                         |
| Summary     | Alert description                                   |
| Customer    | Which tenant/customer the alert belongs to          |
| Device      | Hostname (from cached Central inventory)            |
| Time        | When the alert was raised                           |
| Investigate | Link to the Central alerts page for deeper analysis |

## Top Customers by Risk

A horizontal bar chart showing your highest-risk customers:

- **With Central:** Ranked by alert count per tenant — the noisiest customers bubble up
- **Without Central:** Falls back to customer directory scores — lowest scores (penalised by unassessed firewall count) appear at the top

Click a bar to drill into that customer.

## Fleet Health

Pie chart showing the status breakdown of your fleet:

- Online (green)
- Offline (red)
- Stale (amber)
- Unknown (grey)

A healthy MSP portfolio should be overwhelmingly green. Anything else needs investigation.

## Quick Actions

Shortcut buttons to the most common tasks:

| Action          | Goes to                           |
| --------------- | --------------------------------- |
| New assessment  | Assess workbench (`/`)            |
| Generate report | Report Centre (`/reports`)        |
| Add customer    | Customer Directory (`/customers`) |
| Playbooks       | Playbooks page (`/playbooks`)     |

## Recent Documents

Shows up to 8 recent non-archived saved reports:

- Customer name, firewall summary, date, section count
- **View** opens the saved report
- **Library** opens the full Report Centre

## How MSPs Use Mission Control

### Daily Standup

1. Open Mission Control
2. Check the KPI row — any spikes in critical alerts?
3. Scan the threat chart — any anomalous activity in the last 24 hours?
4. Review recent alerts — anything requiring immediate response?
5. Check fleet health — any devices gone offline overnight?

### Weekly Review

1. Review the compliance score ring — is it trending up?
2. Check the "Top customers by risk" — are the same customers always at the top?
3. Scan recent documents — is the team generating and delivering reports consistently?
4. Use quick actions to plan the week's assessments

### Board / Leadership Reporting

Mission Control provides the top-level numbers that leadership cares about:

- Total customers managed
- Fleet size and availability
- Alert volumes and trends
- Portfolio compliance score

Screenshot or screen-share during internal reporting.

## Demo Mode

Guest users see Mission Control populated with realistic demo data — fictional customers, sample alerts, and mock trends. Use this for partner demonstrations.

## In-App Guided Tour

Click the **?** button → select "Mission Control" tour for a step-by-step walkthrough.
