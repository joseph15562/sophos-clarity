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

To install Git hooks (run ESLint + Prettier on staged files before commit): `npx husky install` then add a pre-commit hook that runs `npx lint-staged`. Optional.

## Edge Function secrets (Supabase)

For the `api` Edge Function (agent registration and auth), set **AGENT_API_HMAC_SECRET** in Supabase Dashboard → Project Settings → Edge Functions → Secrets. Use a dedicated secret (e.g. 32+ byte hex) for signing/verifying agent API keys; do not reuse the service role key. Rotate this secret independently when needed.

## Related tools

**[Sophos Central MCP Server](https://github.com/Aaronjacobs000/sophos-central-mcp)** — An [MCP](https://modelcontextprotocol.io/) server that exposes **265 tools** across 14 Sophos Central API namespaces (firewalls, endpoints, alerts, policies, email, XDR, SIEM, etc.).

### Can it be integrated into FireComply?

| Approach | Summary |
|----------|--------|
| **Run MCP inside the app** | Not a good fit. FireComply already talks to Sophos Central via a **Supabase Edge Function** (per-org credentials, region routing, firewall/alert/licence APIs). The MCP server is a separate Node process aimed at **AI tool use** (Claude/Cursor), not at being called by a web app. Replacing or wrapping the Edge Function with the MCP server would duplicate auth and add operational complexity without clear benefit. |
| **Use MCP alongside FireComply (recommended)** | Use the MCP server in **Cursor** or **Claude** so the AI has Sophos Central context when you develop or debug FireComply. No change to the product; the app keeps using its existing Central integration. |
| **In-app AI that queries Central** | A possible future feature: an AI assistant inside FireComply that can list tenants, firewalls, alerts, etc. That would require a backend that runs an LLM with tool use and passes the user’s (or org’s) Central context securely. The MCP server could inform the **tool contract** (e.g. same operations), but you’d still implement auth and proxy in your own backend rather than running the MCP server directly in production. |

**Practical integration today:** add the MCP server to your IDE so the AI can use Sophos Central when working on this repo.

#### Adding to Cursor

1. **Create or edit the MCP config**
   - **Project-only:** create `.cursor/mcp.json` in this repo (you can commit it with placeholder env and use `${env:SOPHOS_CLIENT_ID}` so others don’t need your secrets).
   - **All projects:** create or edit `~/.cursor/mcp.json` (macOS/Linux) or `%USERPROFILE%\.cursor\mcp.json` (Windows; the `.cursor` folder is hidden by default—enable “Hidden items” in File Explorer or run `Win+R` → `%USERPROFILE%\.cursor`).

2. **Add the `sophos-central` server** — put this inside the `mcpServers` object (merge with any existing servers). Or copy `.cursor/mcp.json.example` to `.cursor/mcp.json` and set `SOPHOS_CLIENT_ID` and `SOPHOS_CLIENT_SECRET` in your environment (the example uses `${env:...}` so secrets stay out of the file).

   ```json
   {
     "mcpServers": {
       "sophos-central": {
         "command": "npx",
         "args": ["-y", "sophos-central-mcp-server"],
         "env": {
           "SOPHOS_CLIENT_ID": "your-client-id",
           "SOPHOS_CLIENT_SECRET": "your-client-secret",
           "TRANSPORT": "stdio"
         }
       }
     }
   }
   ```

   Replace `your-client-id` and `your-client-secret` with your [Sophos Central API credentials](https://github.com/Aaronjacobs000/sophos-central-mcp#creating-api-credentials). To avoid hardcoding secrets, use Cursor’s [config interpolation](https://cursor.com/docs/mcp): set `SOPHOS_CLIENT_ID` and `SOPHOS_CLIENT_SECRET` in your shell or system env, then use `"SOPHOS_CLIENT_ID": "${env:SOPHOS_CLIENT_ID}"` and the same for the secret.

3. **Restart Cursor** fully (quit and reopen) so it picks up the new MCP server.

4. **Confirm** — open **Settings → Features → Model Context Protocol** (or Cmd+Shift+J and check MCP). You should see `sophos-central` in the list. The AI can then use tools like `sophos_list_firewalls`, `sophos_list_alerts`, `sophos_partner_gap_analysis`, etc. when you’re working in this repo.

#### Claude Code (one-time)

```bash
claude mcp add sophos-central \
  -e SOPHOS_CLIENT_ID="your-client-id" \
  -e SOPHOS_CLIENT_SECRET="your-client-secret" \
  -e TRANSPORT="stdio" \
  -- npx -y sophos-central-mcp-server
```

## Target users

- MSP security engineers
- Sophos partners
- Network/security consultants
- vCISO / GRC consultants
- Post-sales assessment teams
