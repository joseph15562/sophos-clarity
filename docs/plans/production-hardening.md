---
name: Production Hardening Plan
overview: "Close the remaining production-readiness gaps identified in the SaaS audit: security headers (CSP, HSTS, X-Frame-Options), general API rate limiting via Upstash Redis, ops health endpoint, and ESLint warning burn-down."
todos:
  - id: security-headers
    content: Add security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and CSP to vercel.json
    status: completed
  - id: rate-limit-shared
    content: Create _shared/rate-limit.ts with Redis-backed sliding-window counter using existing Upstash client
    status: completed
  - id: rate-limit-wire
    content: Wire rate limiter into api, api-agent, api-public handlers; migrate public-demo-session from in-memory to Redis
    status: completed
  - id: healthz
    content: Create healthz edge function with optional DB ping; add to deploy workflows and config.toml
    status: completed
  - id: eslint-burndown
    content: "Burn down 227 ESLint warnings: auto-fix, remove unused vars, review exhaustive-deps, then escalate to error"
    status: completed
  - id: changelog-update
    content: Update changelog and platform-update-highlights with hardening work
    status: completed
isProject: false
---

# Production Hardening Plan

## P1 — Security Headers (immediate, low effort)

### 1a. Add security headers in `vercel.json`

Add a global headers block to [vercel.json](vercel.json) covering all non-asset paths:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

These sit alongside the existing `Cache-Control` rules and apply to every response from Vercel.

### 1b. Add Content Security Policy

Two options (both are additive):

- **Meta tag in [index.html](index.html)**: `<meta http-equiv="Content-Security-Policy" content="...">` — simple, no infra dependency, covers the SPA shell.
- **Vercel header in [vercel.json](vercel.json)**: applies to all HTML responses including error pages.

Recommended: use the Vercel header for consistency. The policy needs to allow:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'` (the FOUC theme script in index.html is inline)
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` (Tailwind + Google Fonts)
- `font-src 'self' https://fonts.gstatic.com`
- `img-src 'self' data: blob:` (data-URI logos, html-to-image blobs)
- `connect-src 'self' https://*.supabase.co https://*.sentry.io wss://*.supabase.co https://www.sophos.com`
- `frame-src 'none'`
- `object-src 'none'`
- `base-uri 'self'`

---

## P2 — General API Rate Limiting (medium effort)

### Approach

Leverage the existing [supabase/functions/\_shared/upstash-redis.ts](supabase/functions/_shared/upstash-redis.ts) Upstash client. Create a new shared module `_shared/rate-limit.ts` with a sliding-window counter pattern using `INCR` + `EXPIRE`:

- Key: `rl:{function}:{identifier}` (user ID or IP)
- Window: 60s
- Limits (env-tunable, with sensible defaults):
  - `api`: 120 req/min per user
  - `api-agent`: 60 req/min per API key
  - `api-public`: 30 req/min per IP (unauthenticated)
- Returns `429` with `Retry-After` header when exceeded
- No-ops gracefully when Upstash is not configured (same pattern as the cache)

Wire into the top of the request handler in:

- [supabase/functions/api/index.ts](supabase/functions/api/index.ts)
- [supabase/functions/api-agent/index.ts](supabase/functions/api-agent/index.ts)
- [supabase/functions/api-public/index.ts](supabase/functions/api-public/index.ts)

`parse-config` already has its own DB-backed limiter — leave it as-is.

### Fix demo rate limit

Replace the in-memory `Map` in [supabase/functions/public-demo-session/index.ts](supabase/functions/public-demo-session/index.ts) with the same Redis-backed helper. Falls back to the existing in-memory approach when Upstash is not configured.

---

## P3 — Ops Health Endpoint (low effort)

Create a new edge function `supabase/functions/healthz/index.ts`:

- `GET /healthz` returns `200 { "status": "ok", "ts": "..." }`
- Optionally pings Supabase DB with a lightweight query (`SELECT 1`) to confirm DB connectivity
- No auth required (`verify_jwt = false` in config.toml)
- Add to the deploy list in both [.github/workflows/deploy.yml](.github/workflows/deploy.yml) and [.github/workflows/staging.yml](.github/workflows/staging.yml)

This gives synthetic monitors (Uptime Robot, Vercel Checks, etc.) something to hit.

---

## P2 — ESLint Warning Burn-down (medium effort, can be incremental)

Current breakdown (227 total):

- **194** `@typescript-eslint/no-unused-vars` — bulk of the debt
- **23** `react-hooks/exhaustive-deps` — need manual review per case
- **7** `react-refresh/only-export-components` — trivial refactors
- **2** `null` (parser issues) — investigate
- **1** `@typescript-eslint/no-explicit-any` — single occurrence

Strategy:

- Run `npx eslint . --fix` to auto-fix the 2 fixable warnings
- For unused vars: batch removal by scanning the 194 instances, prefixing with `_` or removing dead code. Prioritise `src/lib/` and `src/hooks/` (already escalated to `error` in ESLint config) to keep those directories clean
- For `exhaustive-deps`: review each of the 23 cases individually — some need deps added, others need `// eslint-disable-next-line` with justification
- Once warnings are below ~20, escalate `no-unused-vars` and `no-explicit-any` to `error` globally in [eslint.config.js](eslint.config.js) and set `--max-warnings 0` in lint-staged

---

## Changelog and Platform Card

Update [src/pages/ChangelogPage.tsx](src/pages/ChangelogPage.tsx) and [src/data/platform-update-highlights.ts](src/data/platform-update-highlights.ts) with a single entry covering security headers, rate limiting, health endpoint, and lint clean-up.
