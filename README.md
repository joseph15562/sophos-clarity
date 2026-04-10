# Sophos FireComply

**Multi-tenant MSP platform for Sophos firewall security posture management, compliance reporting, and automated assessment.**

FireComply gives MSPs a single pane of glass across their entire Sophos firewall estate — deterministic best-practice scoring, AI-generated reports, branded client portals, drift detection, and fleet-wide analytics. For Sophos SEs, a dedicated Health Check workflow turns manual 3-hour firewall reviews into 15-minute professional engagements.

---

## What It Does

| Surface                | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Assess Workbench**   | Upload configs, run deterministic analysis, generate AI reports, manage compliance scope |
| **Fleet Command**      | Unified view of every firewall across every customer — scores, status, map, filters      |
| **Mission Control**    | MSP dashboard — KPIs, Central alerts, threat charts, portfolio health                    |
| **Customer Directory** | Customer portfolio management — health tracking, onboarding, risk scores                 |
| **Client Portal**      | Branded customer-facing portals with score, history, findings, compliance, reports       |
| **Drift Monitor**      | Config change detection between assessment snapshots                                     |
| **Portfolio Insights** | Cross-customer analytics, trend charts, risk matrix, recommendations                     |
| **Report Centre**      | Saved report library with scheduling, email delivery, archives, bulk actions             |
| **Integrations Hub**   | Sophos Central, ConnectWise, Autotask, Slack, Teams, webhooks, API keys                  |
| **Connector Agent**    | On-premises Electron agent for automated config collection via Sophos XML API            |
| **SE Health Check**    | Purpose-built SE workflow — secure upload link, qualifying questions, branded PDF        |

---

## Key Capabilities

### Deterministic Analysis Engine

37 best-practice checks across 12 categories (Device Hardening, Visibility & Monitoring, Encryption & Inspection, Rule Hygiene, Network Protection, DoS & Spoof, VPN Security, Active Threat Response, Synchronized Security, Web Protection, Zero-Day Protection, Central Orchestration). Scored 0–100 with grades A–F. Every finding is evidence-backed with extracted configuration facts.

### Compliance Framework Mapping

39 compliance frameworks (GDPR, Cyber Essentials, NCSC, ISO 27001, PCI DSS, HIPAA, NIST 800-53, NIS2, DfE/KCSIE, SOC 2, and 29 others) with control-by-control evidence mapping — pass / partial / not met status, evidence citations, and remediation guidance.

### Four AI Report Types

| Report                      | Audience                      | Length                   |
| --------------------------- | ----------------------------- | ------------------------ |
| **Full Technical Handover** | Engineers, auditors           | 15–20 pages per firewall |
| **Executive Summary**       | IT managers, C-suite          | 5–8 pages                |
| **Compliance Readiness**    | Compliance officers, auditors | 10–15 pages per firewall |
| **SE Health Check**         | Customers, SEs                | 10–13 pages              |

The three MSP reports generate as a single combined document. The SE Health Check report includes template-generated (not AI) Engineer Notes for numerical accuracy.

### Data Privacy by Architecture

- **Client-side parsing** — config files are parsed in the browser, never uploaded to a server
- **Anonymisation** — hostnames, IPs, and identifiers replaced with tokens before reaching the AI model
- **Streaming de-anonymisation** — real values restored in the response stream, never stored server-side
- **Row-Level Security** — all database access scoped by organisation via Supabase RLS

### Multi-Format Export

PDF (Headless Chromium), Word (.docx), PowerPoint (.pptx), styled HTML, CSV, JSON, ZIP bundles, email delivery (Resend), and shareable read-only links.

### Connector Agent

Lightweight Electron agent for Windows, macOS, and Linux. Connects to Sophos firewalls via the XML API, pulls config exports on a schedule, runs analysis, and pushes results to the workspace. Supports heartbeat monitoring, remote scan triggers, and auto-updates.

### Sophos Central Integration

Partner-level Central API integration for fleet discovery, firmware/HA/alert enrichment, tenant mapping, and geo-location. Powers Mission Control alerts and threat charts.

### PSA & Messaging Integrations

ConnectWise Cloud (OAuth), ConnectWise Manage (ticket creation), Datto Autotask (ticket creation), Slack, Microsoft Teams, webhooks (`assessment_complete`, `score_change`, `critical_finding`, `agent_offline`), and scoped service keys for RMM/API access.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                          │
│                                                                     │
│  Config Upload → Client-side Extraction → Anonymisation             │
│       ↓                                                             │
│  Deterministic Analysis Engine (37 checks, 39 frameworks)           │
│       ↓                                                             │
│  Anonymised JSON → Supabase Edge Function (Deno)                    │
│       ↓                                                             │
│  Gemini / Claude / ChatGPT → SSE Stream → De-anonymise → Render    │
│       ↓                                                             │
│  PDF / Word / PPTX / HTML / CSV / JSON / ZIP / Email / Share Link   │
├─────────────────────────────────────────────────────────────────────┤
│                    Supabase (PostgreSQL + Auth)                      │
│  RLS-scoped orgs · saved reports · scheduled jobs · portal configs  │
│  Central credentials (AES-GCM) · agent heartbeats · score history   │
├─────────────────────────────────────────────────────────────────────┤
│                    Connector Agent (Electron)                        │
│  On-prem · XML API → config export → analysis → push to workspace   │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions on Deno)
- **AI:** Google Gemini (default), pluggable to Claude or ChatGPT (OpenAI-compatible endpoint)
- **Export:** Headless Chromium (PDF), docx, pptxgenjs, JSZip
- **Agent:** Electron, Sophos XML API, SNMP
- **Email:** Resend API
- **CI/CD:** GitHub Actions, Husky, lint-staged, Vitest, Playwright
- **Design:** Sophos brand guidelines (Inter typography, Sophos colour palette)

---

## Documentation

### Start Here

The [`docs/start-here/`](docs/start-here/) folder contains everything you need to get started:

| Guide                                                                                      | What it covers                                                   |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **[Elevator Pitch](docs/start-here/01-elevator-pitch.md)**                                 | 10-second, 30-second, and audience-specific pitches              |
| **[Why FireComply for MSPs](docs/start-here/10-why-firecomply-for-msps.md)**               | Business value, commercial angle, what changes for MSPs          |
| **[MSP Customer Onboarding](docs/start-here/11-msp-customer-onboarding.md)**               | End-to-end onboarding: first assessment to continuous monitoring |
| **[MSP Workflows & Best Practices](docs/start-here/18-msp-workflows-best-practices.md)**   | QBR prep, incident response, compliance audits, upsell, handoffs |
| **[Why FireComply for SEs](docs/start-here/02-why-firecomply-for-ses.md)**                 | SE-specific benefits: speed, consistency, credibility            |
| **[SE Workflows & Best Practices](docs/start-here/03-se-workflows-and-best-practices.md)** | Pre-sales health check, improvement reviews, demo workflow       |
| **[Using with a Customer](docs/start-here/04-using-firecomply-with-a-customer.md)**        | Before/during/after the meeting, customer FAQ                    |

**Styled HTML version:** [`docs/start-here/FireComply — Documentation.html`](docs/start-here/FireComply%20—%20Documentation.html) — all guides in one browsable page with sidebar navigation.

### Feature Walkthroughs

| Guide                                                                        | Feature                                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [Assessment Workbench](docs/start-here/05-walkthrough-msp-assess.md)         | Upload, analyse, generate reports, manage compliance        |
| [Fleet Command](docs/start-here/12-walkthrough-fleet-command.md)             | Unified fleet view, map, search/filter, per-firewall detail |
| [Mission Control](docs/start-here/13-walkthrough-mission-control.md)         | Dashboard KPIs, alerts, threat charts, portfolio health     |
| [Client Portal](docs/start-here/14-walkthrough-client-portal.md)             | Branded portals: branding, sections, access control, slugs  |
| [Drift Monitor & Insights](docs/start-here/15-walkthrough-drift-insights.md) | Config change tracking, cross-customer analytics            |
| [Integrations Hub](docs/start-here/16-walkthrough-integrations.md)           | Central, ConnectWise, Autotask, Slack, Teams, webhooks      |
| [Report Centre](docs/start-here/17-walkthrough-report-centre.md)             | Report library, scheduling, email delivery, archives        |
| [Connector Agent](docs/start-here/07-walkthrough-connector-agent.md)         | Install, add firewalls, automate config collection          |
| [AI Reports & Deliverables](docs/start-here/08-walkthrough-ai-reports.md)    | Report types, prompt engineering, export formats            |
| [SE Health Check](docs/start-here/06-walkthrough-se-health-check.md)         | Request config, review on a call, deliver branded report    |

### Product Brief

- **[PDF](docs/Sophos%20FireComply%20—%20Product%20Brief.pdf)** — printable product brief
- **[HTML](docs/Sophos%20FireComply%20—%20Product%20Brief.html)** — interactive version with screenshots

### Technical & Operations

| Document                                                                | Topic                        |
| ----------------------------------------------------------------------- | ---------------------------- |
| [Data Privacy](docs/DATA-PRIVACY.md)                                    | How customer data is handled |
| [Threat Model (STRIDE)](docs/threat-model-stride-oneshot.md)            | Security threat analysis     |
| [Tenant Model](docs/TENANT-MODEL.md)                                    | Multi-tenancy architecture   |
| [Self-Hosted](docs/SELF-HOSTED.md)                                      | Self-hosting guide           |
| [Supported SFOS Versions](docs/SUPPORTED-SFOS-VERSIONS.md)              | Compatible firmware versions |
| [Scale Triggers](docs/SCALE-TRIGGERS.md)                                | When to scale infrastructure |
| [Sophos Central Setup](docs/sophos-central-setup.md)                    | Connecting to Central API    |
| [Firewall API Setup](docs/firewall-api-setup.md)                        | XML API for connector agents |
| [Connector Agent SDK](docs/firecomply-connector-sophos-firewall-sdk.md) | Agent technical details      |
| [SE Health Check Report](docs/se-health-check-report.md)                | Report structure and content |

### API

- **[OpenAPI Spec](docs/api/openapi.yaml)** — API schema
- **[Edge Routes](docs/api/edge-routes.md)** — Supabase Edge Function endpoints
- **[Client Data Layer](docs/api/client-data-layer.md)** — Frontend data access patterns

### Architecture Decision Records

- [`docs/adr/`](docs/adr/) — architectural decisions and rationale

### Plans & Specs

- [`docs/plans/`](docs/plans/) — feature plans, specs, and backlog items

### Other

| Document                                             | Topic                               |
| ---------------------------------------------------- | ----------------------------------- |
| [2-Minute Demo Script](docs/2_MINUTE_DEMO_SCRIPT.md) | Scripted walkthrough for live demos |
| [Product Assessment](docs/PRODUCT-ASSESSMENT.md)     | Feature-level product evaluation    |
| [Roadmap](docs/ROADMAP.md)                           | Planned features and priorities     |
| [Changelog Policy](docs/CHANGELOG-POLICY.md)         | How in-app changelog is maintained  |
| [UI Notifications](docs/UI-NOTIFICATIONS.md)         | Notification system design          |
| [Demo Account](docs/DEMO-ACCOUNT.md)                 | How public demo mode works          |

---

## Local Development

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (free tier works)
- A Google Gemini API key (for AI report generation)

### Setup

```bash
git clone https://github.com/joseph15562/sophos-firecomply.git
cd sophos-firecomply

npm install

cp .env.example .env
# Edit .env with your Supabase project URL and anon key

npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

#### Frontend (`.env`)

| Variable                        | Required | Description                     |
| ------------------------------- | -------- | ------------------------------- |
| `VITE_SUPABASE_URL`             | Yes      | Your Supabase project URL       |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes      | Supabase anon/public key        |
| `VITE_APP_VERSION`              | No       | Version string shown in reports |

#### Edge Functions (Supabase Dashboard → Edge Functions → Secrets)

| Variable                                      | Required | Description                                                |
| --------------------------------------------- | -------- | ---------------------------------------------------------- |
| `SUPABASE_URL`                                | Yes      | Same Supabase project URL                                  |
| `SUPABASE_SERVICE_ROLE_KEY`                   | Yes      | Service role key (admin access — never expose client-side) |
| `SUPABASE_ANON_KEY`                           | Yes      | Anon key for RLS-scoped queries                            |
| `GEMINI_API_KEY`                              | Yes      | Google Gemini API key                                      |
| `GEMINI_REPORT_MODEL`                         | No       | Model for reports (default: `gemini-2.5-flash`)            |
| `GEMINI_CHAT_MODEL`                           | No       | Model for chat (default: `gemini-2.5-flash-lite`)          |
| `GEMINI_REPORT_MAX_OUTPUT_TOKENS`             | No       | Max tokens for reports (default `32768`, max `65536`)      |
| `PARSE_CONFIG_STREAM_BUDGET_MS`               | No       | Wall-clock budget for streaming (default `138000` ~2.3m)   |
| `PARSE_CONFIG_MAX_REPORT_COMPLETIONS_PER_MIN` | No       | Per-user report rate limit (default off)                   |
| `PARSE_CONFIG_MAX_CHAT_COMPLETIONS_PER_MIN`   | No       | Per-user chat rate limit (default off)                     |
| `RESEND_API_KEY`                              | No       | Resend API key for email delivery                          |
| `REPORT_FROM_EMAIL`                           | No       | Sender address for emailed reports                         |
| `ALLOWED_ORIGIN`                              | No       | CORS origin restriction                                    |
| `CENTRAL_ENCRYPTION_KEY`                      | No       | AES-GCM encryption key for Central credentials             |

### Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run ESLint
npm test             # Run unit tests (Vitest)
npm run test:e2e     # Run end-to-end tests (Playwright)
npm run preview      # Preview production build locally
```

#### Supabase Edge Functions (Deno)

```bash
npm run format:deno        # Apply deno fmt
npm run format:check:deno  # Verify formatting (same as CI / pre-push)
npm run test:deno          # Deno tests for Edge code
```

Git pre-push (Husky) runs `npm run format:check:deno` automatically.

---

## Deployment

The frontend is a static SPA — deploy to any static hosting provider (Vercel, Netlify, Cloudflare Pages).

Edge functions are deployed to Supabase:

```bash
supabase functions deploy parse-config
supabase functions deploy api
```

Set edge function secrets via the Supabase Dashboard or CLI:

```bash
supabase secrets set GEMINI_API_KEY=your-key-here
```

---

## Privacy & Security

- **No credentials required** — works from HTML/XML configuration exports, not live firewall access
- **Client-side extraction** — config parsing happens in the browser; raw files are never uploaded
- **Data anonymisation** — IPs, hostnames, and identifiers replaced before AI processing
- **No data persistence** — reports are not stored server-side unless explicitly saved
- **Row Level Security** — all database access scoped by organisation via RLS
- **XSS-hardened rendering** — AI markdown sanitized via DOMPurify with FORBID_TAGS/FORBID_ATTR
- **CORS-restricted backend** — edge functions only accept requests from configured origins
- **Request validation** — body size limits (5 MB AI, 10 MB API), payload shape validation
- **Per-user rate limiting** — AI generation throttled per authenticated user
- **JWT authentication** — all AI and API endpoints require valid Supabase auth tokens
- **AES-GCM encryption** — Sophos Central credentials encrypted at rest with HKDF key derivation

---

## Demo Mode

Click **"Try Demo Mode"** on the login page to explore the full platform with sample data — no account required. Demo mode includes:

- Pre-loaded firewall config with deterministic analysis results
- Sample Fleet Command with 8 firewalls across 5 fictional customers
- Mission Control with mock KPIs, alerts, and charts
- Customer Directory with health tracking and portfolio pulse
- Report Centre with sample saved reports
- All feature surfaces populated with realistic demo data

The entire flow from demo config to exported report takes under 2 minutes.

---

## Target Users

- **MSP security teams** — portfolio-wide posture management, compliance reporting, client portals
- **Sophos Sales Engineers** — pre-sales and post-sales health checks
- **Sophos channel partners** — customer assessments and compliance evidence
- **vCISO and GRC consultants** — framework-mapped compliance documentation

---

## Lessons Learned

### AI Anonymisation Is Harder Than It Looks

Sending firewall configuration data to a large language model creates a real tension: the AI needs enough context to produce useful, specific recommendations, but the data contains sensitive infrastructure details — internal IP ranges, hostnames, VPN peer addresses, DNS names, Active Directory domains, and network topology.

The solution was a client-side anonymisation pipeline that replaces every identifiable value with a stable token (e.g. `HOST_1`, `NET_10.x.x.x/24` → `NET_TOKEN_3`) _before_ the data leaves the browser. The AI receives structurally accurate configuration with no real identifiers. A streaming de-anonymisation layer then restores the original values as the response arrives, so the final report references real hostnames, IPs, and zones — without those values ever reaching the model.

Getting this right required several iterations. Early versions were too aggressive (stripping values the AI needed for context, producing vague reports) or too lenient (leaking identifiable data in edge cases like base64-encoded certificate subjects or embedded SNMP community strings). The final implementation uses a multi-pass tokeniser with format-aware matchers for IPv4/v6, CIDR blocks, FQDNs, email addresses, SNMP strings, and certificate fields — each with stable token assignment so cross-references survive anonymisation.

### Compliance Framework Accuracy Demands Deterministic Logic, Not AI

The initial assumption was that the AI model could map firewall findings to compliance controls. In practice, this produced inconsistent results: the same configuration scored differently across runs, controls were mapped to the wrong framework clauses, and "partial" vs "not met" judgements were unreliable.

The shift was to make compliance mapping entirely deterministic. Each of the 39 frameworks has a hand-authored mapping table that connects specific analysis checks to specific control clauses — with explicit pass/partial/fail thresholds and evidence citations. The AI generates the _prose_ (executive narrative, remediation guidance, contextual explanations) but never decides the compliance _verdict_. The SE Health Check goes further: its Engineer Notes section is entirely template-generated with no AI involvement, ensuring numerical accuracy for scores, finding counts, and category breakdowns.

This separation — deterministic engine for facts, AI for narrative — turned out to be the most important architectural decision in the project. It means compliance evidence is reproducible, auditable, and defensible, while the reports still read naturally.

### Sophos Config Exports Are Enormous — Getting Them Into an AI Context Window Was a Battle

A Sophos XG/XGS firewall configuration export can be several megabytes of HTML or XML — hundreds of tables covering firewall rules, NAT policies, VPN tunnels, network objects, DHCP bindings, schedules, QoS profiles, web filter categories, certificate stores, and dozens more sections. Feeding this raw to an LLM would blow through context windows, cost a fortune in tokens, and produce unfocused reports because the model would give equal weight to DHCP lease tables and critical firewall rules.

The solution was a multi-stage extraction and reduction pipeline, all running client-side in the browser:

1. **Client-side DOM parsing** — the browser's native `DOMParser` handles even 5 MB HTML exports without loading them to a server. Tables, detail blocks, and text are extracted into a structured `ExtractedSections` object.
2. **Section stripping** — over 80 low-value section types (DHCP, QoS, schedules, services, FQDN hosts, Let's Encrypt, parent proxies, admin profiles, etc.) are dropped before the payload leaves the browser, saving 30–50% of input tokens on a typical config.
3. **Firewall rule capping** — configs with 200+ firewall rules get capped at 150 rows in the AI prompt, with a summary placeholder for the remainder, preventing the model from spending its entire output budget on rule tables.
4. **Body size guard** — the edge function enforces a 5 MB payload limit, rejecting configs that are still too large after stripping.
5. **Token budget in the prompt** — explicit instructions tell the model to balance depth across sections rather than front-loading detail into the first firewall's rules.

Getting this balance right took many iterations. Too much stripping and the AI missed critical context (e.g. removing network objects meant VPN findings lacked subnet detail). Too little and reports trailed off mid-section when the model hit its output token limit. The current pipeline is the result of testing against dozens of real-world configs ranging from small branch offices (50 rules) to enterprise estates (800+ rules across multiple firewalls).

### Prompt Engineering for Domain-Specific Reports Is Ongoing Work

Getting an LLM to produce a 15-page technical firewall assessment that a Sophos SE would actually present to a customer required extensive prompt iteration. Early outputs were generic ("consider enabling IPS"), missed critical findings, or hallucinated features that don't exist in SFOS. The prompts now include:

- A structured JSON payload with every analysis finding, extracted evidence, and framework mapping
- Explicit instructions on report structure, section ordering, and heading hierarchy
- Negative constraints ("do not recommend features unavailable in SFOS v20/v21", "do not invent configuration values")
- Token budget guidance to balance depth across sections rather than front-loading detail

Even so, AI report quality is a moving target. Model upgrades (Gemini 1.5 → 2.0 → 2.5) each changed output characteristics — some improved depth but regressed on formatting; others improved structure but produced shorter findings. The streaming architecture and model-agnostic endpoint (Gemini, Claude, ChatGPT via OpenAI-compatible API) help absorb these shifts, but prompt tuning remains a regular activity.

### Multi-Format Export Is a Deeper Problem Than Expected

Supporting PDF, Word, PowerPoint, HTML, CSV, JSON, ZIP, and email delivery sounds like a feature list. In practice each format has its own rendering model, and AI-generated markdown doesn't map cleanly to any of them.

- **PDF** required three fallback layers: headless Chromium (server-rendered with proper fonts and layout), pdfmake (client-side, handles data-URI images but needs font bundles), and finally browser print as a last resort. Each handles tables, page breaks, and images differently.
- **Word (.docx)** needed custom paragraph and table style mappings — markdown tables with merged cells, nested lists, and inline code don't have direct Word equivalents.
- **Data-URI images** (company logos embedded as base64 in markdown) regularly broke across formats. A PNG logo that rendered fine in HTML would corrupt in pdfmake if the base64 was line-wrapped, or disappear in Word if the URI exceeded a length threshold. The `markdown-data-uri-normalize` module exists solely to repair these edge cases across all export paths.

The lesson: if the product promises multi-format export, budget significant time for format-specific edge cases. The "last 10%" of making every export look professional took longer than building the first export path.

### Streaming AI Responses Over SSE Needs Defensive Engineering

A full technical report can take 60–90 seconds to stream from Gemini. That's a long time for things to go wrong — network interruptions, Supabase Edge Function timeouts (150s on free tier), Gemini rate limits (429s), and token budget exhaustion mid-sentence.

The streaming layer evolved from a simple `fetch` + `ReadableStream` into a defensive pipeline:

- **Wall-clock budget** (`PARSE_CONFIG_STREAM_BUDGET_MS`) that gracefully closes the stream before the hosting platform kills the worker, so the user gets a partial report rather than an error.
- **De-anonymisation on the fly** — real values are restored as each SSE chunk arrives, so the user sees real hostnames appearing in real time, not tokens.
- **Retry only on transient errors** (502/503/504), never on 429 — retrying a rate limit immediately burns more quota and confuses users.
- **Client-side abort signal merging** — the user can cancel generation, and the abort propagates through to the fetch, the timeout controller, and the stream reader simultaneously.

### The War-Room Prompt — Using AI to Audit Itself

One of the most impactful decisions in the project was running the entire codebase through a deliberately adversarial AI review — a single, structured prompt that roleplays a panel of world-class experts (a Google principal engineer, an Apple designer, a CrowdStrike security architect, a Netflix performance engineer, and a YC partner) conducting a joint audit with no encouragement and no softening. The prompt scores ten dimensions on a 1–10 scale with written justification, demands every finding include severity, exact location, and exact fix, and ends with a "brutal truth" verdict.

<details>
<summary>The full war-room prompt</summary>

```
You are a panel of world-class experts simultaneously — a principal engineer from Google,
a senior product designer from Apple, a cybersecurity architect from CrowdStrike, a
performance engineer from Netflix, and a brutal YC partner who has seen 10,000 startups
fail. You are doing a JOINT audit of my project. You do not encourage. You do not
compliment unless something is genuinely exceptional. You find problems. You find
weaknesses. You find the exact reasons this project would fail in production, fail with
real users, or fail to scale. Then you tell me precisely how to fix every single one.

This is not a friendly code review. This is a war room intervention.

════════════════════════════════════════════
GROUND RULES FOR YOUR ANALYSIS
════════════════════════════════════════════

- Never say "looks good" unless you can defend it with data or industry benchmarks
- Every finding must include: WHAT it is, WHY it matters, SEVERITY (Critical / High /
  Medium / Low), and EXACT fix with implementation detail
- If you reference a best practice, name the source (Google SRE Book, OWASP Top 10,
  Nielsen Heuristics, etc.)
- Do not group problems to make them look smaller — list every single one individually
- Score every dimension on a 1–10 scale with a written justification for the score
- At the end, give me a cold, honest verdict: is this project production-ready or not,
  and what stands between it and being truly exceptional

════════════════════════════════════════════
DIMENSIONS
════════════════════════════════════════════

1. CODE ARCHITECTURE & QUALITY — folder structure, SOLID, DRY, abstractions, naming,
   dead code, god objects, state management, onboardability
2. PERFORMANCE & EFFICIENCY — N+1 queries, memoisation, bundle size, memory leaks,
   pagination, debouncing, blocking operations, breaking points
3. SECURITY & VULNERABILITY — hardcoded secrets, input validation, auth/authz at every
   layer, OWASP Top 10, CVEs, error leakage, rate limiting, blast radius
4. UI/UX & PRODUCT DESIGN — visual language, Fitts's Law, Nielsen Heuristics, information
   hierarchy, state handling, responsiveness, WCAG 2.1 AA, onboarding
5. FUNCTIONALITY & BUSINESS LOGIC — edge cases, race conditions, error boundaries, form
   validation parity, half-built features, silent failures
6. TESTING & RELIABILITY — meaningful coverage, E2E critical paths, integration tests,
   unhappy paths, flaky tests, rollback strategy, MTTD/MTTR
7. DOCUMENTATION & KNOWLEDGE — README quality, inline comments, API docs, env var docs,
   architecture diagrams, decision records, changelog
8. DEVELOPER EXPERIENCE & TOOLING — local setup friction, linter, formatter, pre-commit
   hooks, CI/CD, dependency pinning, task scripts
9. SCALABILITY & SYSTEM DESIGN — bottlenecks, indexing, caching, architectural ceilings,
   statelessness, background jobs, observability, SPOFs
10. PRODUCT VISION & STRATEGIC QUALITY — value proposition clarity, feature bloat, polish
    distribution, trust signals, differentiation, fundability

FINAL VERDICT: Scorecard, critical failures, prioritised roadmap (Tier 1/2/3), brutal
truth paragraph, and 5 transformational moves to reach exceptional.
```

</details>

#### What It Found

The first run scored the project at roughly **63/100** and surfaced **8 critical/high severity findings** — real vulnerabilities and architectural problems that would have shipped to production:

| #   | Finding                                                              | Severity |
| --- | -------------------------------------------------------------------- | -------- |
| 1   | HMAC timing attack vulnerability in webhook signature verification   | Critical |
| 2   | Weak AES key derivation for Sophos Central credential encryption     | Critical |
| 3   | HTML injection in email templates via unsanitised user input         | High     |
| 4   | Internal error messages and stack traces leaked to API clients       | High     |
| 5   | Wrong auth token used in scheduled report settings                   | High     |
| 6   | Zero test coverage on edge functions (the security perimeter)        | High     |
| 7   | Portal data IDOR via predictable slug enumeration                    | High     |
| 8   | npm audit: 5 critical + 2 high known vulnerabilities in dependencies | High     |

Beyond security, it identified N+1 query patterns in fleet panels, missing empty states across 20+ surfaces, half-built features that should be removed entirely (attestation workflow, custom framework builder, encryption overview, peer benchmarks), no TypeScript strict mode, no structured logging, and no abort signal handling on fetches.

#### What Changed Because of It

The review became the project's engineering backlog. Every finding was tracked in [`docs/REVIEW.md`](docs/REVIEW.md) with severity, exact location, exact fix, and status. The work was organised into three tiers:

**Tier 1 (critical — fixed immediately):** All 8 security findings resolved — constant-time HMAC comparison, HKDF key derivation with auto-migration, HTML escaping on all email templates, generic error messages to clients, auth token fix, Deno test scaffold, portal slug entropy, and dependency audit cleanup.

**Tier 2 (significant — fixed over weeks):** TypeScript strict mode enabled across `src/`, N+1 queries batched, TanStack Query adopted for data fetching with abort signal support, empty states added to every surface, half-built features removed, Playwright E2E expanded with accessibility assertions, structured `logJson` on all edge functions, OpenAPI documentation, Zod validation on every API route, and 4 Architecture Decision Records.

**Tier 3 (polish — ongoing):** React.memo on expensive components, debounced search inputs, optional Redis caching pilot, job queue system, k6 load testing scripts, Sentry integration, and server-side PDF generation pathway documented.

The score moved from **~63** to **~84/100** over several weeks. More importantly, the review changed how the project was built — every new feature now has a mental checklist: is the input validated, is the error generic, is the fetch cancellable, is the empty state handled, is there a test?

The full living document is at [`docs/REVIEW.md`](docs/REVIEW.md) — scores, findings, fixes, and status for every item.

### E2E Testing a Client-Side SPA on CI Is Fragile by Nature

The Playwright E2E suite runs 50+ tests against a Vite preview build on GitHub Actions free-tier runners. Several hard-won lessons:

- **Environment parity matters** — the API hub test failed for weeks on CI because `VITE_SUPABASE_URL` wasn't set in the E2E build, causing a `.replace()` call on `undefined` deep inside a tab component. Locally it worked fine because the developer always has the env var set. Defensive fallbacks (`|| ""`) on every `import.meta.env` access in rendering paths are now mandatory.
- **Timeouts must account for CI runner speed** — PDF generation via pdfmake that takes 5 seconds locally can take 120+ seconds on a constrained CI runner. Assertions need generous timeouts, and test-level timeouts need to be even more generous than assertion timeouts.
- **Accessibility testing catches real bugs early** — axe-core assertions in E2E tests caught colour contrast failures, missing button labels, and links that weren't visually distinguishable from surrounding text — all genuine WCAG violations that would have shipped without automated checks.

---

## Licence

Released under the [MIT licence](LICENSE).
