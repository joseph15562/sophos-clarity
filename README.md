# Sophos FireComply

**AI-assisted firewall configuration assessment and compliance reporting for MSPs.**

Sophos FireComply transforms raw Sophos XGS firewall HTML configuration exports into client-ready documentation — technical reports, executive briefs, and compliance evidence packs — in minutes, not hours.

Upload a config. Get a professional assessment. Export it. Done.

## License

[MIT](LICENSE) — free to use, modify, and distribute subject to the license terms. Third-party dependencies remain under their own licenses (`node_modules/*/LICENSE`, `package.json` metadata).

---

## Problem

MSPs and security consultants spend hours manually reviewing Sophos firewall configurations, writing assessment reports, and mapping findings to compliance frameworks. The process is repetitive, error-prone, and doesn't scale across a fleet of managed firewalls.

## Solution

Sophos FireComply automates the entire workflow:

1. **Upload** — drag and drop one or more Sophos XGS configuration HTML exports
2. **Analyse** — a deterministic findings engine instantly identifies misconfigurations, security gaps, and best-practice violations
3. **Generate** — AI produces professional narrative reports with anonymised data (IPs, names, and identifiers never leave the browser)
4. **Export** — download as Word (.docx), PDF, PowerPoint (.pptx), or bundled ZIP

No firewall credentials. No API keys to Sophos Central required. No sensitive data sent to third parties.

---

## Key Features

### Deterministic Findings Engine

Rule-based analysis that surfaces real issues — duplicate/overlapping firewall rules, WAN rules without web filtering or IPS, logging gaps, broad source/destination patterns, MFA status, and SSL/TLS inspection coverage. Every finding is evidence-backed with extracted configuration facts.

### Inspection Posture Dashboard

Visual coverage bars showing web filtering, IPS, and application control coverage across all WAN-facing rules. See at a glance where protection is strong and where gaps exist.

### Sophos Best Practice Checks

70+ checks aligned to Sophos recommended configuration guidelines, covering network protection, web filtering, logging, admin security, VPN, wireless, and more. Results scored per-category with pass/partial/fail status and licence-aware scoping.

### Three Report Types

| Report                       | Purpose                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Technical Report**         | Per-firewall assessment: rules, NAT, interfaces, policies, security posture, and recommendations       |
| **Executive Brief**          | Multi-firewall estate summary with risk matrix, cross-estate findings, and strategic recommendations   |
| **Compliance Evidence Pack** | Framework-mapped control evidence (Cyber Essentials, GDPR, PCI DSS, NIST, ISO 27001) with gap analysis |

### Compliance Heatmap

Interactive matrix mapping extracted configuration facts to multiple compliance frameworks simultaneously. Each control is graded pass/partial/fail with evidence citations.

### Security Posture Scorecard

Deterministic scorecard grading 9 categories — Web Filtering, Intrusion Prevention, Application Control, Authentication, Logging, Rule Hygiene, Admin Access, Anti-Malware, and Network Security — as Good / Needs Review / High Risk. Each score is evidence-based with explanations referencing extracted configuration facts. Visible in the Overview tab alongside the risk gauge.

### Risk Scoring and Estate Comparison

Weighted risk scoring per firewall with category breakdowns. When multiple configs are loaded, compare firewalls side-by-side with finding deltas, score differences, and grade changes.

### Data Anonymisation

Client-side replacement of IP addresses, customer names, and network identifiers with RFC 5737 TEST-NET ranges before any data reaches the AI model. Real values are restored locally in the final rendered report. Sensitive configuration data never leaves the browser.

### Multi-Format Export

Word (.docx), PDF (styled HTML), PowerPoint (.pptx), and ZIP bundles with consistent formatting and branding.

### Demo Mode

One-click "Try Demo Config" button on the landing page loads a synthetic Sophos XGS configuration export so evaluators and judges can explore the full analysis and reporting experience without needing their own firewall config.

### Fleet Management (SE Health Check)

Purpose-built workflow for Sophos SEs to manage health check assessments at scale — upload requests, scheduled reports, saved baselines, config diff comparison, and assessment history tracking.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│                                                         │
│  HTML Upload → Client-side Extraction → Anonymisation   │
│       ↓                                                 │
│  Deterministic Analysis Engine (findings, scores, BP)   │
│       ↓                                                 │
│  Anonymised JSON → Supabase Edge Function (Deno)        │
│       ↓                                                 │
│  Google Gemini → Streaming Markdown → Rendered Report   │
│       ↓                                                 │
│  PDF / Word / PowerPoint / ZIP Export                    │
└─────────────────────────────────────────────────────────┘
```

### AI Workflow

1. The browser extracts structured data from HTML tables, detail blocks, and text elements
2. IP addresses and identifiers are replaced with anonymised placeholders client-side
3. Compact JSON is sent to a Supabase Edge Function
4. The edge function streams AI-generated markdown from Google Gemini back to the browser via SSE
5. The browser renders the markdown, restores original values, and makes the report available for export

The AI never sees real customer network data.

### Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions on Deno)
- **AI Model**: Google Gemini (streaming via OpenAI-compatible endpoint)
- **Export**: docx, pdfmake, pptxgenjs, JSZip
- **Design**: Sophos brand guidelines (Zalando Sans typography, Sophos colour palette)

---

## Local Development

### Prerequisites

- Node.js 18+
- npm
- A Supabase project (free tier works)
- A Google Gemini API key (for AI report generation)

### Setup

```bash
# Clone the repository
git clone https://github.com/joseph15562/sophos-firecomply.git
cd sophos-firecomply

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase project URL and anon key

# Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment Variables

#### Frontend (`.env`)

| Variable                        | Required | Description                                                     |
| ------------------------------- | -------- | --------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Yes      | Your Supabase project URL (`https://<project-ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes      | Supabase anon/public key (JWT with role `anon`)                 |
| `VITE_APP_VERSION`              | No       | Optional version string shown in reports                        |

#### Edge Functions (set via Supabase Dashboard → Edge Functions → Secrets)

| Variable                    | Required | Description                                                |
| --------------------------- | -------- | ---------------------------------------------------------- |
| `SUPABASE_URL`              | Yes      | Same Supabase project URL                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Service role key (admin access — never expose client-side) |
| `SUPABASE_ANON_KEY`         | Yes      | Anon key for RLS-scoped queries                            |
| `GEMINI_API_KEY`            | Yes      | Google Gemini API key                                      |
| `GEMINI_REPORT_MODEL`       | No       | Model for reports (default: `gemini-2.5-flash`)            |
| `GEMINI_CHAT_MODEL`         | No       | Model for chat (default: `gemini-2.5-flash-lite`)          |
| `RESEND_API_KEY`            | No       | Resend API key for email delivery                          |
| `REPORT_FROM_EMAIL`         | No       | Sender address for emailed reports                         |
| `ALLOWED_ORIGIN`            | No       | CORS origin restriction for edge functions                 |
| `CENTRAL_ENCRYPTION_KEY`    | No       | Encryption key for Sophos Central integration              |

### Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run ESLint
npm test             # Run unit tests (Vitest)
npm run test:e2e     # Run end-to-end tests (Playwright)
npm run preview      # Preview production build locally
```

### Supabase Edge functions (Deno)

Git **pre-push** (Husky) runs `npm run format:check:deno`, matching CI quality gates. If it fails, fix formatting then push again:

```bash
npm run format:deno        # apply deno fmt under supabase/functions
npm run format:check:deno  # verify (same as CI / pre-push)
npm run test:deno          # Deno tests for Edge code
```

Install [Deno](https://deno.land/) locally for these commands.

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

## Privacy and Security

- **No credentials required** — works entirely from HTML configuration exports, not live firewall access
- **Client-side extraction** — configuration parsing happens in the browser; raw HTML is never uploaded to a server
- **Data anonymisation** — IP addresses, hostnames, and customer identifiers are replaced with safe placeholders before reaching the AI model
- **No data persistence** — generated reports are not stored server-side unless the user explicitly saves them
- **Row Level Security** — all Supabase database access is scoped by organisation via RLS policies
- **XSS-hardened rendering** — all AI-generated markdown is sanitized via DOMPurify with explicit FORBID_TAGS/FORBID_ATTR before DOM injection
- **CORS-restricted backend** — edge functions only accept requests from configured origins (configurable via `ALLOWED_ORIGIN`)
- **Request validation** — body size limits (5 MB for AI, 10 MB for API), payload shape validation, and empty-section rejection
- **Per-user rate limiting** — AI report generation is throttled per authenticated user to prevent credit abuse
- **JWT authentication** — all AI and API endpoints require a valid Supabase auth token; unauthenticated requests are rejected

### Supabase Configuration Notes

The `supabase/config.toml` sets `verify_jwt = false` for `parse-config` and `sophos-central`. This is intentional — these functions handle CORS preflight (OPTIONS) requests that don't carry JWTs. Authentication is enforced inside each function via `supabase.auth.getUser()`.

To restrict origins in production, set the `ALLOWED_ORIGIN` secret to your deployed domain:

```bash
supabase secrets set ALLOWED_ORIGIN=https://your-domain.com
```

---

## Limitations

- Extraction coverage depends on the Sophos XGS firmware version and export format; some sections in newer firmware may not be fully parsed
- AI-generated recommendations are best-practice-aligned guidance, not formal security audits or compliance certifications
- The deterministic findings engine covers the most common misconfigurations but is not exhaustive across all possible Sophos features
- Large exports (many hundreds of rules) may produce larger-than-ideal AI payloads; the app handles this with chunking but generation time increases

---

## Target Users

- MSP security engineers and network consultants
- Sophos channel partners and SEs
- vCISO and GRC consultants
- Post-sales assessment and onboarding teams

---

## Roadmap

- [x] Demo mode with synthetic sample config for evaluators
- [x] Security Posture Scorecard (deterministic, evidence-based)
- [x] Extraction coverage reporting and unsupported section visibility
- [x] Backend abuse protection and rate limiting
- [x] XSS-hardened markdown rendering (DOMPurify)
- [x] Code splitting for improved initial load performance
- [ ] Model fallback / graceful degraded mode when AI backend is unavailable

---

## Demo Flow for Judges

If you are evaluating this app and do not have a Sophos firewall config export:

1. Visit the deployed app URL
2. Click **Try Demo Config** on the landing page — this loads a synthetic sample Sophos XGS configuration (no real customer data)
3. The deterministic analysis runs instantly — review findings, risk score, Security Posture Scorecard, inspection posture, and best-practice checks
4. Click **Generate Report** to see AI-assisted documentation streamed in real time
5. Export to Word, PDF, PowerPoint, or ZIP
6. Or use the **SE Health Check** flow at `/health-check` for the full SE-facing experience (requires auth)
7. Load a second config to see fleet comparison, estate risk ranking, and compliance heatmap

The entire flow from demo config to exported report takes under 2 minutes.

---

## Why This Stands Out

**For an AI build competition, Sophos FireComply demonstrates:**

1. **Privacy by architecture, not by policy** — customer IP addresses, hostnames, and identifiers are replaced with RFC 5737 documentation-range placeholders _before_ the AI model sees any data. Anonymisation is client-side and deterministic — the AI never receives real customer network information. This is a technical guarantee, not a policy promise.

2. **Deterministic facts + AI narrative — never the reverse** — a rule-based findings engine (70+ checks, 21 compliance frameworks, weighted risk scoring across 6 categories) runs entirely in the browser with zero AI involvement. AI is used only to transform those evidence-backed facts into professional prose. Findings are never hallucinated because the AI is writing about data it didn't generate.

3. **Real vertical AI, not a wrapper** — this is not a chatbot with a Sophos skin. It understands Sophos XGS configuration structure at the HTML-table level, extracts structured data from firmware exports, scores against Sophos-specific best practices, maps to real compliance frameworks (Cyber Essentials, PCI DSS, NIST 800-53, ISO 27001, HIPAA, NIS2, and 15 others), and produces reports that reference actual configuration evidence. The domain knowledge is in the code, not just the prompts.

4. **Two complete product surfaces** — the MSP assessment workbench (`/`) and the SE Health Check (`/health-check`) share infrastructure but serve different personas with different workflows, different data models, and different Sophos Central integration patterns. This is product thinking, not feature creep.

5. **Production-grade engineering** — streaming SSE with model fallback chains, AES-GCM encryption with HKDF key derivation, constant-time HMAC comparison, HTML injection prevention, CI/CD with lint + typecheck + 310 unit tests + Playwright E2E + npm audit + auto-deploy, and a desktop connector agent for automated config collection. This is not a prototype.

6. **Immediate, measurable value** — upload a config, get a professional assessment in under 2 minutes. The time savings are real: what takes hours of manual review becomes a click-and-export workflow. The demo config lets judges experience this without needing their own firewall.

---

## What I Learned

Building FireComply taught me more about AI engineering than any course or tutorial could have:

**Prompt engineering is system design, not copywriting.** The biggest improvement in report quality didn't come from tweaking prompts — it came from changing _what the AI sees_. Sending anonymised, pre-structured JSON with deterministic findings already computed produced dramatically better output than sending raw config data and asking the model to "analyse" it. The lesson: the best prompt is a well-shaped input.

**Streaming changes everything about UX.** The difference between waiting 60 seconds for a complete report and seeing the first paragraph appear in 2 seconds is the difference between "is it broken?" and "this is fast." Implementing SSE streaming end-to-end (Gemini API to edge function to browser with real-time de-anonymisation) was the single most impactful UX decision in the project.

**Security and AI are in tension.** I wanted to use AI for everything, but the security audit I ran on my own code revealed that every data path to the AI model is a potential leak vector. Building the anonymisation pipeline forced me to think about what the AI _needs to see_ versus what it _currently sees_ — and the answer was always "less than you think." Client-side anonymisation before any API call became a core architectural principle, not an afterthought.

**Building for two personas forces better architecture.** The SE Health Check and the MSP assessment started as the same codebase, but the moment I separated them into distinct workflows with distinct data models, the code quality of both improved. Shared infrastructure (auth, crypto, email, Central API) got cleaner because it had to serve two masters. Features that didn't serve either persona became obvious candidates for removal.

**Kill features, don't add them.** The hardest engineering work in this project was removing code. I built and then cut an assessment scheduler, a change approval workflow, a peer benchmarking widget, and several other features that sounded good in isolation but made the product feel unfocused. Every removal made the remaining features better. The discipline to subtract is harder than the discipline to build.

---

## Licence

Released under the [MIT licence](LICENSE).
