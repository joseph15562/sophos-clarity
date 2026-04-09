# Why FireComply for Sales Engineers

## The Problem Today

As an SE, firewall health checks are a core part of pre-sales and post-sales. But the current process is painful:

- **Manual config review** — You open an HTML export in a browser, Ctrl+F through hundreds of rules, and mentally cross-reference against Sophos best practices. This takes 1–3 hours per firewall.
- **No consistent standard** — Every SE checks different things in a different order. The quality of a health check depends entirely on who does it.
- **Report writing** — After the analysis, you spend another hour formatting findings into a Word doc or PDF. The customer gets it days later.
- **No repeatability** — When the customer asks "how have we improved since last time?", you have no baseline to compare against.
- **Central data is separate** — You check the config export, then separately log into Central to check firmware, HA, alerts. Two tools, two contexts.

## What FireComply Changes

### Before: 3–4 Hours Per Health Check

1. Receive config export (or download from Central)
2. Open HTML in browser, manually review ~30 areas
3. Take notes in a spreadsheet
4. Write up findings in Word
5. Format, brand, send to customer
6. Repeat from scratch next time

### After: 15 Minutes Per Health Check

1. Request config via secure link (customer uploads themselves)
2. FireComply analyses against 37 best-practice checks automatically
3. Walk through the score on a call — qualifying questions adjust it live
4. Click "Send to customer" — branded PDF arrives in their inbox
5. Past reviews are saved — next time, compare drift

### Specific SE Benefits

**Consistency** — Every health check uses the same 37-check framework, scored against Sophos hardening guidance. No more "I check 20 things, you check 15."

**Speed** — The deterministic analysis runs in seconds. AI report generation takes ~30 seconds. You spend your time on the call, not the prep.

**Credibility** — The report includes provenance (tool identity, timestamps, limitations), a formal findings table with severity, and AI-generated SE Engineer Notes in your voice. It looks like you spent hours on it.

**Central enrichment** — When the customer optionally connects Central, the analysis enriches with firmware version, HA status, managed state, and alert count. No separate tab.

**Score as a conversation tool** — The best-practice score (0–100, Grade A–F) is designed for screen-sharing. Customers immediately understand "66% / Grade C — several areas need attention." The qualifying questions (MDR, endpoint, DPI exclusions) let you tailor the score on the fly.

**Saved history** — Every health check is persisted. When you return in 6 months, you can show the customer their improvement trajectory.

**No customer account needed** — The customer uploads their config through a secure, expiring link. They never need to create an account or install anything.

## What You'll Actually Use Day-to-Day

| Feature               | When You'll Use It                                           |
| --------------------- | ------------------------------------------------------------ |
| SE Health Check       | Every pre-sales or post-sales firewall review                |
| Request Config Upload | When you want the customer to self-serve the upload          |
| Best-Practice Score   | On every customer call — share screen, walk through findings |
| AI Engineer Notes     | Read aloud on the call as your summary                       |
| Email to Customer     | End of every call — instant branded report                   |
| Saved Health Checks   | Follow-up reviews to show improvement                        |
| Demo Mode             | Internal demos, training, partner presentations              |
| Central Integration   | When the customer has a Central-managed estate               |

## Getting Started

1. Go to the SE Health Check (accessible from the workspace header)
2. Try the built-in demo config to see the full flow
3. Use the in-app guided tour (the "?" button) for a step-by-step walkthrough
4. Read [SE Health Check Walkthrough](./06-walkthrough-se-health-check.md) for the detailed workflow
