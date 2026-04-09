# Sophos FireComply

**AI-assisted firewall configuration assessment and compliance reporting — built for MSPs, SEs, and security consultants. Upload a config. Get a professional assessment. Export it. Done.**

|                       |                      |                |                      |
| --------------------- | -------------------- | -------------- | -------------------- |
| **39**                | **70+**              | **5**          | **0**                |
| COMPLIANCE FRAMEWORKS | BEST-PRACTICE CHECKS | EXPORT FORMATS | CREDENTIALS REQUIRED |

---

## WHAT'S INCLUDED

### AI-POWERED

**AI Report Generation**
Gemini-powered narrative reports from your firewall config — technical assessments, executive briefs, and compliance evidence packs. Data is anonymised before leaving the browser.

### ANALYSIS

**Deterministic Findings Engine**
Rule-based analysis that surfaces real issues — duplicate rules, WAN rules without web filtering or IPS, logging gaps, MFA status, SSL/TLS inspection coverage. Every finding is evidence-backed.

### COMPLIANCE

**39-Framework Compliance Mapping**
Interactive heatmap mapping configuration facts to Cyber Essentials, GDPR, PCI DSS, NIST 800-53, ISO 27001, NIS2, SOC 2, CIS, HIPAA, CMMC, and 29 more — with pass/partial/fail grading.

### MANAGEMENT

**MSP Fleet & Customer Management**
Multi-tenant customer directory, client portals, team management, and portfolio insights. Built for MSPs managing dozens of customers.

> Deploy on Vercel in minutes: connect Supabase for cloud features, or run entirely in-browser as a guest — no backend needed for core assessment.

© Copyright 2026. Sophos Ltd. All rights reserved. 2026-04 EN

---

# Sophos FireComply — Product Brief

## AI-POWERED

### AI Report Generation & Assistant

A contextual AI analyst powered by Google Gemini — automatically loaded with your firewall configuration data for assessment-quality narrative reports and interactive chat.

**What the AI can do**

| Capability                | Description                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Technical Reports**     | Per-firewall assessment: rules, NAT, interfaces, policies, security posture, and recommendations       |
| **Executive Briefs**      | Multi-firewall estate summary with risk matrix, cross-estate findings, and strategic recommendations   |
| **Compliance Evidence**   | Framework-mapped control evidence with gap analysis for any of 39 supported frameworks                 |
| **Interactive Chat**      | Route-aware AI assistant — ask questions about your config, get remediation guidance, generate queries |
| **Remediation Playbooks** | Step-by-step fix guides for every finding category with Sophos-specific CLI and console instructions   |

**Setup:** AI reports work out of the box with the hosted deployment. Self-hosted: set `GEMINI_API_KEY` in your Supabase Edge Function secrets. The assistant automatically loads your current analysis as context.

**Additional capabilities**

|                                                |                                              |
| ---------------------------------------------- | -------------------------------------------- |
| Server-rendered PDF export (headless Chromium) | Word (.docx), PowerPoint (.pptx), HTML, ZIP  |
| Score simulator & what-if comparison           | Baseline manager for tracking config drift   |
| Guided tours for every page                    | In-app help centre with illustrated guides   |
| Dark/light theme with system sync              | Keyboard shortcuts and Siri-style assist bar |

**Privacy:** All deterministic analysis runs in-browser. IP addresses, hostnames, and identifiers are anonymised before any AI call. No firewall credentials or Sophos Central API keys are required for core assessment.

© Copyright 2026. Sophos Ltd. All rights reserved. 2026-04 EN

---

# Sophos FireComply — Product Brief

## COVERAGE

### Two Surfaces, Full Lifecycle

FireComply serves two distinct workflows — the **MSP Assessment Workbench** for compliance reporting, and the **SE Health Check** for pre-sales and post-sales firewall reviews.

| CAPABILITY                                | MSP WORKBENCH | SE HEALTH CHECK |
| ----------------------------------------- | ------------- | --------------- |
| Config upload & analysis                  | ✅            | ✅              |
| Sophos best-practice scoring (70+ checks) | ✅            | ✅              |
| AI report generation (3 types)            | ✅            | ✅              |
| Compliance framework mapping (39)         | ✅            | —               |
| Risk score dashboard & posture scorecard  | ✅            | ✅              |
| Multi-firewall estate analysis            | ✅            | ✅              |
| Customer management & directory           | ✅            | —               |
| Client portal (branded, per-customer)     | ✅            | —               |
| Sophos Central integration                | ✅            | ✅              |
| Fleet command & drift monitoring          | ✅            | —               |
| Mission control dashboard                 | ✅            | —               |
| Portfolio insights & score trends         | ✅            | ✅              |
| Team management & collaboration           | ✅            | ✅              |
| Share via link / email to customer        | ✅            | ✅              |
| Connector agent (scheduled collection)    | ✅            | —               |
| PDF / Word / PPTX / HTML / ZIP export     | ✅            | ✅              |
| Demo mode                                 | ✅            | ✅              |

### Integrations

| Integration              | Purpose                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| **Sophos Central**       | Sync firewalls, endpoints, alerts, MDR, licensing, groups — enriches assessments with live data |
| **ConnectWise Manage**   | Create service tickets from findings                                                            |
| **Datto Autotask PSA**   | Create service tickets from findings                                                            |
| **Microsoft Teams**      | Push notifications and findings                                                                 |
| **Slack**                | Send alerts and assessment summaries                                                            |
| **Resend**               | Scheduled report emails and customer delivery                                                   |
| **FireComply Connector** | Electron agent for automated config collection from firewalls via XML API                       |

© Copyright 2026. Sophos Ltd. All rights reserved. 2026-04 EN

---

# Sophos FireComply — Product Brief

## ARCHITECTURE

### How It Works

Three layers working together — the browser for deterministic analysis, Supabase for cloud features, and Gemini AI for narrative intelligence.

```
🌐 Browser (React SPA)
Upload · Analyse · Dashboard · Reports · Compliance · Export
                    ↕
┌─────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Edge Functions)                 │
│  Auth, Assessments, Customers, Teams, Portals,          │
│  Central Sync, Scheduled Jobs, Connector API            │
├─────────────────────────────────────────────────────────┤
│  Google Gemini (LLM)          │  Vercel (Hosting)       │
│  Reports, Chat, Regulatory    │  SPA, PDF Renderer,     │
│  Analysis                     │  Advisories Proxy       │
└─────────────────────────────────────────────────────────┘
                    ↕
☁ Sophos Central
Your security environment — firewalls, endpoints, alerts, MDR, licensing
```

## GETTING STARTED

### Deploy in minutes

1. **Clone & Install** — `git clone`, `npm install`, `npm run dev` for local development.
2. **Deploy** — Push to Vercel (or Netlify/Cloudflare Pages) for instant hosting. SPA with zero server config.
3. **Connect Supabase** — Create a project, run migrations, set environment variables for cloud features.
4. **Configure AI** — Set `GEMINI_API_KEY` in Supabase Edge Function secrets for report generation.
5. **Connect or Demo** — Link Sophos Central for live data, or use Demo Mode for instant exploration.

### Who it's for

|                                                         |                                                        |
| ------------------------------------------------------- | ------------------------------------------------------ |
| **MSPs** — Multi-customer compliance reporting at scale | **SEs** — Pre-sales health checks and customer demos   |
| **vCISOs** — GRC evidence and compliance gap analysis   | **Consultants** — Post-sales assessment and onboarding |

### Technical requirements

- **Frontend:** Any modern browser (Chrome, Safari, Firefox, Edge)
- **Hosting:** Vercel, Netlify, Cloudflare Pages, or self-hosted (Helm chart available)
- **Backend:** Supabase project (PostgreSQL + Edge Functions)
- **AI:** Google Gemini API key (optional — core analysis works without it)
- **Central:** Sophos Central API credentials (optional — enriches assessments with live data)

### Repository

`github.com/joseph15562/sophos-firecomply`

© Copyright 2026. Sophos Ltd. All rights reserved. 2026-04 EN
