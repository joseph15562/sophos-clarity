# Sophos FireComply

[![CI + Deploy](https://github.com/joseph15562/sophos-firecomply/actions/workflows/deploy.yml/badge.svg)](https://github.com/joseph15562/sophos-firecomply/actions/workflows/deploy.yml)

**Multi-tenant MSP platform for Sophos firewall security posture management, compliance reporting, and automated assessment.**

> **159,200** lines of TypeScript | **626** automated tests | **39** compliance frameworks | **14** edge functions | **58** database migrations | **661** commits | **Solo developer**

FireComply gives MSPs a single pane of glass across their entire Sophos firewall estate — deterministic best-practice scoring, AI-generated reports, branded client portals, drift detection, and fleet-wide analytics. For Sophos SEs, a dedicated Health Check workflow turns manual 3-hour firewall reviews into 15-minute professional engagements.

**Live app:** [sophos-firecomply.vercel.app](https://sophos-firecomply.vercel.app) — click **"Try Demo Mode"** on the login page to explore with sample data, no account required.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Key Capabilities](#key-capabilities)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Privacy & Security](#privacy--security)
- [Demo Mode](#demo-mode)
- [Project by the Numbers](#project-by-the-numbers)
- [What Problem This Actually Solves](#what-problem-this-actually-solves)
- [Target Users](#target-users)
- [Engineering Decisions That Shaped the Project](#engineering-decisions-that-shaped-the-project)
- [Testing Strategy](#testing-strategy)
- [Lessons Learned](#lessons-learned)
- [The Development Journey — Building with AI as a Co-Developer](#the-development-journey--building-with-ai-as-a-co-developer)
- [Security Model](#security-model)
- [Accessibility](#accessibility)
- [What I Would Do Differently](#what-i-would-do-differently)
- [Licence](#licence)

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

### Continuous Integration (GitHub Actions)

Every push to `main` runs the full CI pipeline ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):

| Step                  | What it does                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **Deno format check** | Verifies `deno fmt` compliance on all edge function code                                  |
| **Deno tests**        | Runs Deno test suite for edge functions (auth, API routes, schemas)                       |
| **ESLint**            | Lints the entire frontend codebase                                                        |
| **TypeScript**        | Strict type-checking via `npm run typecheck` (`tsconfig.ci.json`)                         |
| **Vitest**            | Unit tests with coverage thresholds                                                       |
| **Build**             | Production Vite build with `VITE_E2E_AUTH_BYPASS=1` for E2E                               |
| **Bundle budget**     | Asserts JS bundle size stays within limits (`scripts/assert-bundle-budget.mjs`)           |
| **npm audit**         | Fails on moderate+ vulnerabilities in production dependencies                             |
| **Playwright E2E**    | 51 tests across smoke, journeys, signed-in flows, accessibility, and viewport breakpoints |

The pipeline also uploads Playwright HTML reports as build artifacts for debugging failures. Additional workflows handle connector agent builds ([`build-connector.yml`](.github/workflows/build-connector.yml)), dependency review on PRs ([`dependency-review.yml`](.github/workflows/dependency-review.yml)), and optional k6 load testing against staging ([`k6-sustained.yml`](.github/workflows/k6-sustained.yml)).

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

## Project by the Numbers

| Metric                        | Count                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Lines of TypeScript/TSX       | **159,200**                                                                   |
| Git commits                   | **661**                                                                       |
| React components              | **296**                                                                       |
| Custom hooks                  | **52**                                                                        |
| Pages / routes                | **50**                                                                        |
| Supabase Edge Functions       | **14**                                                                        |
| Database migrations           | **58**                                                                        |
| Vitest unit tests             | **461**                                                                       |
| Playwright E2E tests          | **51**                                                                        |
| Deno edge function tests      | **114**                                                                       |
| **Total automated tests**     | **626**                                                                       |
| Test files                    | **120**                                                                       |
| Documentation files           | **153**                                                                       |
| Architecture Decision Records | **4**                                                                         |
| Compliance frameworks         | **39**                                                                        |
| Best-practice analysis checks | **37** across 12 categories                                                   |
| Export formats                | **8** (PDF, Word, PPTX, HTML, CSV, JSON, ZIP, email)                          |
| Production dependencies       | **65**                                                                        |
| CI pipeline steps             | **9** (lint, typecheck, unit, Deno, build, bundle budget, audit, E2E, deploy) |

The entire codebase — frontend, backend, edge functions, tests, infrastructure, documentation — was built by a single developer over approximately 16 months, starting January 2025.

---

## What Problem This Actually Solves

A Sophos firewall security assessment done manually takes an experienced engineer **3+ hours**: export the config, read through hundreds of rules, check each category against best practices, map findings to whichever compliance framework the customer cares about, write the report, format it, and deliver it.

FireComply reduces this to **under 15 minutes**:

1. **Upload** the config export (30 seconds)
2. **Review** the deterministic analysis — every finding is already scored, categorised, and mapped to compliance controls (2 minutes)
3. **Generate** an AI report — the prompt includes all findings, evidence, and framework mappings so the output is specific to this firewall, not generic advice (3–5 minutes for streaming)
4. **Export** as PDF, Word, or branded portal link and deliver to the customer (1 minute)

For MSPs managing 20, 50, or 200+ firewalls across multiple customers, the multiplier effect is significant. Quarterly Business Reviews that required a week of preparation can be built from live Fleet Command data in an afternoon. Compliance evidence that was previously assembled manually from screenshots and spreadsheets is generated deterministically with full audit trails.

The SE Health Check workflow has an additional impact: it turns what was an informal, inconsistent process (every SE had their own approach) into a standardised, professional engagement with branded deliverables.

---

## Target Users

- **MSP security teams** — portfolio-wide posture management, compliance reporting, client portals
- **Sophos Sales Engineers** — pre-sales and post-sales health checks
- **Sophos channel partners** — customer assessments and compliance evidence
- **vCISO and GRC consultants** — framework-mapped compliance documentation

---

## Engineering Decisions That Shaped the Project

These are deliberate architectural choices — not defaults or accidents — each made to solve a specific problem.

**Client-side parsing, not server-side.** Firewall configs contain the most sensitive data in a network — every rule, every IP, every VPN peer, every admin account. The decision to parse configs entirely in the browser means raw configuration files never leave the user's machine. This is a harder engineering problem (browser-based XML/HTML parsing of multi-megabyte files, client-side section extraction, in-browser anonymisation) but it eliminates an entire class of data handling risk and makes the privacy story simple: your config never touches our servers.

**Deterministic scoring, AI narrative.** The analysis engine scores every firewall identically — same config, same score, every time. The AI writes the report prose but never decides whether a finding passes or fails. This separation means compliance evidence is auditable and reproducible, while reports still read like they were written by a consultant rather than generated by a template.

**Streaming de-anonymisation.** The anonymisation pipeline replaces real values with stable tokens before the data reaches the AI. The de-anonymisation layer runs on the SSE stream as chunks arrive, restoring real hostnames and IPs in real time. The user sees their actual infrastructure appearing in the report as it streams — not tokens, not a post-processing step. This required building a stateful stream transformer that handles token boundaries split across SSE chunks.

**Multi-model with a single interface.** The AI backend uses an OpenAI-compatible streaming endpoint, meaning the same prompt pipeline works with Gemini, Claude, or ChatGPT by changing a URL and API key. This was a deliberate hedge against model quality regressions and pricing changes — when Gemini 2.0 regressed on table formatting, switching to test against Claude took minutes, not a rewrite.

**Row-Level Security as the tenancy boundary.** Every database query is scoped by organisation via Supabase RLS policies. There is no application-level tenant filtering that could be bypassed — the database itself enforces isolation. This means a bug in application code cannot leak data across organisations.

**Feature removal as a feature.** The war-room review identified half-built features (attestation workflow, custom framework builder, encryption overview, peer benchmarks, compliance calendar) that were adding cognitive load without delivering value. Removing them — deleting working code — was one of the highest-impact improvements. The remaining features are more polished and the codebase is more maintainable.

---

## Testing Strategy

The project has **626 automated tests** across three test runners and four test layers, all enforced in CI. No code reaches production without passing every layer.

### Unit Tests — Vitest (461 tests)

Business logic, data transformations, and utility functions tested in isolation with `vitest` and `happy-dom`. Key coverage areas:

- **Analysis engine** — deterministic scoring and grading across all 37 checks. Tests verify that the same config always produces the same score, grade, and findings.
- **PDF generation** — the `pdfmake` document definition builder is tested against known inputs to ensure table structures, page breaks, and content ordering are correct. Tests run with mocked fonts to avoid loading the 4 MB vfs_fonts bundle.
- **HTML report rendering** — sanitisation, markdown-to-HTML conversion, data-URI image handling, and compliance table generation are all tested independently of the browser.
- **Anonymisation pipeline** — token replacement and restoration tested with round-trip assertions (anonymise → de-anonymise must produce the original input).
- **Config extraction** — DOM parsing of Sophos XML configs tested against fixture files covering edge cases (empty sections, malformed XML, massive rule tables).

### Edge Function Tests — Deno (114 tests)

Every Supabase Edge Function has co-located `*_test.ts` files run with `deno test`. These cover:

- **API route handlers** — request validation, authentication gates, response schemas, and error codes for every REST endpoint.
- **Auth and crypto** — JWT verification, passkey challenge generation, service key validation, HMAC signing.
- **Email rendering** — scheduled report email templates tested against expected HTML output.
- **Schema validation** — Zod schemas for inbound API payloads tested with valid and invalid inputs.

### End-to-End Tests — Playwright (51 tests)

Full browser tests against a built application (`vite preview`), run on Chromium in CI:

- **Smoke tests** — every page loads, renders its heading, and returns no console errors.
- **Viewport tests** — responsive layout assertions at mobile (375px), tablet (768px), and desktop (1280px) breakpoints for all pages.
- **Accessibility tests** — axe-core scans on every page with zero-tolerance for WCAG 2.1 AA violations. These have caught real bugs: colour contrast failures, missing button labels, links indistinguishable from body text.
- **User journey tests** — multi-step flows (config upload → analysis → report generation → PDF download) tested end-to-end with realistic interactions.
- **API hub tests** — API Explorer tab rendering, endpoint documentation, and interactive elements.

### CI Pipeline Enforcement

Tests are not advisory — they gate deployment:

1. **Lint** (ESLint) → 2. **Type check** (tsc --noEmit) → 3. **Unit tests** (Vitest) → 4. **Deno tests** → 5. **Build** (Vite) → 6. **Bundle budget** (fail if JS > 5 MB) → 7. **npm audit** (fail on high/critical) → 8. **E2E tests** (Playwright) → 9. **Deploy**

Any failure at any step stops the pipeline. The bundle budget check prevents performance regressions from accumulating. The npm audit step ensures known vulnerabilities are addressed before deployment, not after.

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

### The Production Prompts — What Actually Talks to Gemini

The war-room prompt audited the project. But the project itself runs on a separate set of carefully engineered prompts that power the AI features. All production prompts live in [`supabase/functions/parse-config/index.ts`](supabase/functions/parse-config/index.ts) and are assembled server-side — the client never sees or controls prompt text.

**Four report system prompts**, each tuned for a different audience:

| Prompt                   | Lines | Audience             | Key constraints                                                                                                                                                                      |
| ------------------------ | ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Technical Handover**   | ~59   | Engineers, auditors  | Full firewall rule tables (every row, every column except excluded list), severity emojis, per-section Summary / Findings / Best Practice, cap at 150 rules with summary placeholder |
| **Executive Summary**    | ~27   | IT managers, C-suite | Multi-firewall overview, Risk Matrix as numbered list (not table, max 10), DPI emphasis, mandatory Limitations paragraph                                                             |
| **Compliance Readiness** | ~54   | Compliance officers  | Fixed section order, per-framework control mapping table (Met / Partial / Not Met / N/A), residual risk table, evidence must not be raw JSON                                         |
| **Chat Assistant**       | ~16   | In-app users         | 200–400 word answers, no invented configuration, mirrors assessment rules for consistency                                                                                            |

**Shared Assessment Rules** (~11 lines) are appended to every report prompt. These encode domain-specific logic that the AI must follow — for example, only flagging missing web filtering on WAN-bound HTTP/HTTPS/ANY rules, treating Central management as satisfying external logging requirements, and handling read-only API service accounts as accepted exceptions under ISO 27001, Cyber Essentials, and PCI DSS rather than MFA violations.

**Dynamic context assembly** (~180 lines of code) builds the rest of the prompt at request time: customer name, environment, selected compliance frameworks, per-firewall jurisdiction scope, Central enrichment data (alerts, firmware, HA status) injected as fenced JSON blocks, and web filter compliance mode (strict vs informational).

**Client-side token saving** — before the payload reaches the prompt, `stream-ai.ts` strips 80+ low-value section types (DHCP, QoS, schedules, services, FQDN hosts, admin profiles, etc.) from the extracted config, cutting 30–50% of input tokens. This list is maintained in sync with the server-side prompt's "Omitted sections" instruction.

Beyond the core report pipeline, a smaller prompt in [`supabase/functions/regulatory-scanner/index.ts`](supabase/functions/regulatory-scanner/index.ts) classifies Sophos security advisory RSS items as relevant or irrelevant to firewall compliance, returning structured JSON for the in-app threat feed.

### E2E Testing a Client-Side SPA on CI Is Fragile by Nature

The Playwright E2E suite runs 50+ tests against a Vite preview build on GitHub Actions free-tier runners. Several hard-won lessons:

- **Environment parity matters** — the API hub test failed for weeks on CI because `VITE_SUPABASE_URL` wasn't set in the E2E build, causing a `.replace()` call on `undefined` deep inside a tab component. Locally it worked fine because the developer always has the env var set. Defensive fallbacks (`|| ""`) on every `import.meta.env` access in rendering paths are now mandatory.
- **Timeouts must account for CI runner speed** — PDF generation via pdfmake that takes 5 seconds locally can take 120+ seconds on a constrained CI runner. Assertions need generous timeouts, and test-level timeouts need to be even more generous than assertion timeouts.
- **Accessibility testing catches real bugs early** — axe-core assertions in E2E tests caught colour contrast failures, missing button labels, and links that weren't visually distinguishable from surrounding text — all genuine WCAG violations that would have shipped without automated checks.

---

## The Development Journey — Building with AI as a Co-Developer

This project was built from the first commit with AI pair programming (Cursor + Claude, later Gemini). This is not a "generated" project — every feature was designed, reviewed, and iterated by a human developer — but AI fundamentally changed the velocity and ambition of what a single developer could ship.

**What AI made possible:**

- Standing up 296 components, 52 hooks, and 14 edge functions in 16 months as a solo developer would not have been achievable with traditional development alone. AI accelerated boilerplate (forms, tables, CRUD routes), suggested patterns (streaming SSE, RLS policies), and caught bugs during development (type errors, missing edge cases).
- The compliance mapping logic across 39 frameworks required understanding regulations I had no prior expertise in. AI helped research control requirements, but every mapping was then manually verified against the published framework documents — AI was the starting point, not the answer.
- Test coverage at 626 automated tests was possible because AI generated test scaffolding quickly, freeing time to focus on the hard tests (E2E flows, edge function integration tests, accessibility assertions).

**What AI got wrong (and what I learned from it):**

- AI confidently generates plausible-but-incorrect compliance mappings. Early in the project, I trusted AI-generated framework mappings without verification and discovered errors weeks later during manual review. This taught me that AI is unreliable for compliance accuracy — the deterministic scoring engine exists specifically because of this lesson.
- AI-generated components often looked correct but had subtle UX issues: missing loading states, no error boundaries, no empty-state handling, inconsistent keyboard navigation. The war-room review quantified this: 26 of 28 findings were in AI-assisted code. The fix was developing a mental checklist for every component that goes beyond "does it compile."
- Prompt engineering was iterative over months, not a one-shot effort. The first version of the technical report prompt produced generic security advice. It took 15+ iterations to get domain-specific output — specific Sophos feature references, correct severity classifications, compliance-aware language, proper table formatting. Each iteration required generating reports from real configs and comparing them section by section.

**The meta-lesson:** AI is transformative for developer productivity but dangerous for domain accuracy. The architecture of this project — deterministic analysis engine for correctness, AI layer for narrative — directly reflects learning where AI helps and where it hurts.

---

## Security Model

| Layer              | Implementation                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication** | Supabase Auth with email/password, magic links, and passkey (WebAuthn) support                                                                           |
| **Authorisation**  | Row-Level Security on every table; organisation-scoped policies enforce tenant isolation at the database level                                           |
| **Config privacy** | Client-side parsing — raw firewall configs are never uploaded to the server                                                                              |
| **Anonymisation**  | Deterministic token replacement of IPs, hostnames, and identifiers before data reaches the AI; stable tokens allow de-anonymisation on the return stream |
| **API security**   | Service key authentication for edge functions; CORS restricted to known origins; rate limiting on AI endpoints                                           |
| **Portal access**  | Time-limited, token-authenticated portal links for read-only customer views — no account required for the end customer                                   |
| **Secrets**        | All credentials in environment variables / Supabase Vault; no secrets in source code (enforced by CI audit step)                                         |

---

## Accessibility

The application targets WCAG 2.1 AA conformance:

- **Automated enforcement:** Every page is tested with axe-core via Playwright E2E tests. Accessibility violations fail the CI pipeline — they are treated as bugs, not warnings.
- **Keyboard navigation:** All interactive elements are reachable and operable via keyboard. Tab ordering follows visual layout.
- **Colour contrast:** Minimum 4.5:1 contrast ratio enforced. The changelog page had a contrast violation caught by automated tests and fixed before shipping.
- **Semantic HTML:** Heading hierarchy (`h1` → `h2` → `h3`), landmark regions, form labels, and ARIA attributes are used throughout. Missing `h1` elements on three pages were caught by E2E viewport tests.
- **Screen reader support:** Interactive elements have accessible names. A `button-name` violation on the customer sort dropdown was caught and fixed with `aria-label`.

---

## What I Would Do Differently

Building this project over 16 months as a solo developer taught me as much about what not to do as what to do. If I started again:

**Start with fewer features, ship them better.** The initial version tried to build everything at once — 50 pages, PSA integrations, drift detection, portfolio analytics, and compliance mapping for 39 frameworks. The war-room review revealed that breadth had come at the cost of polish: missing loading states, inconsistent error handling, half-built features that confused users. A tighter MVP with 5 polished surfaces would have been more impressive and more usable than 15 surfaces at 70%.

**Write E2E tests from week one.** The E2E suite was added late in the project and immediately found real bugs — accessibility violations, broken pages when environment variables were missing, layout issues on mobile. Every bug found by E2E tests was a bug that could have been caught months earlier. The cost of adding E2E tests late was debugging issues that had been silently present for weeks.

**Design the prompt pipeline before writing prompts.** The current prompt assembly code (~180 lines) grew organically as requirements were added. If I had designed the pipeline architecture first — context assembly, token budgets, section selection, anonymisation, formatting rules — the code would be cleaner and the prompts would be more consistent. Instead, each new report type required retrofitting the pipeline.

**Invest in observability earlier.** The application has error boundaries and console logging, but lacks structured production telemetry (Sentry, LogRocket, or similar). When users reported issues, debugging required reproducing the problem locally. Structured error tracking would have cut diagnostic time significantly.

**Document API contracts formally.** The REST API documentation exists in-app but the edge functions don't have formal OpenAPI specs. For a project of this size, maintaining OpenAPI definitions would have made the API more discoverable and testable, and would have caught breaking changes automatically.

---

## Licence

Released under the [MIT licence](LICENSE).
