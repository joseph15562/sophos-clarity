# Sophos FireComply

**Firewall Configuration Assessment & Compliance Reporting**

Sophos FireComply transforms Sophos Firewall HTML configuration exports into branded, audit-ready documentation — technical reports, executive briefs, and compliance evidence packs — in minutes.

## What it does

1. **Upload** one or more Sophos XGS configuration HTML exports
2. **Analyse** — deterministic rule-based analysis runs instantly (web filtering gaps, logging, IPS, duplicates, MFA)
3. **Generate** — AI-powered reports with anonymised data (IPs, names, identifiers never leave the browser)
4. **Export** — download as Word (.docx), PDF, PowerPoint (.pptx), or bundled ZIP

## Report types

| Report | Description |
|--------|-------------|
| **Technical Report** | Per-firewall assessment: rules, NAT, interfaces, policies, security posture, NCSC-aligned recommendations |
| **Executive Brief** | Multi-firewall estate summary with risk matrix, cross-estate findings, strategic recommendations |
| **Compliance Evidence Pack** | Framework-mapped control evidence (Cyber Essentials, GDPR, PCI DSS, NIST, etc.) with gap analysis |

## Key features

- **Deterministic findings engine** — duplicate/overlapping rules, WAN rules without web filtering/IPS/app control, logging disabled, broad source/destination, MFA status, SSL/TLS inspection coverage
- **Inspection posture dashboard** — visual coverage bars for web filtering, IPS, and application control across WAN rules
- **Estate risk comparison** — per-firewall weighted risk ranking when multiple configs are loaded
- **Data anonymisation** — client-side replacement of IPs, customer names, and identifiers with RFC 5737 TEST-NET ranges before AI processing; real values restored locally in the final report
- **Multi-format export** — Word, PDF (styled HTML), PowerPoint, and ZIP bundles
- **Evidence verification** — extracted data counts shown alongside AI output for validation

## Tech stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase Edge Functions (Deno)
- **AI**: Google Gemini (via OpenAI-compatible API)
- **Branding**: Sophos brand guidelines (Zalando Sans typography, Sophos colour palette, Sophos Icon Library)

## Getting started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

# Start development server
npm run dev
```

## Target users

- MSP security engineers
- Sophos partners
- Network/security consultants
- vCISO / GRC consultants
- Post-sales assessment teams
