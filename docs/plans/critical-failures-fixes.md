---
name: Critical Failures Fixes
overview: Fix all 8 critical failures from the war-room audit using a one-commit-per-fix strategy on a dedicated branch, with individual rollback capability for each fix.
todos:
  - id: branch
    content: Create critical-fixes branch from main
    status: pending
  - id: fix5
    content: "Fix 5: ScheduledReportSettings auth — use session.access_token instead of anonKey"
    status: pending
  - id: fix1
    content: "Fix 1: HMAC timing attack — replace === with manual constant-time XOR loop in crypto.ts (avoids Deno runtime compatibility risk)"
    status: pending
  - id: fix3
    content: "Fix 3: Email HTML injection — add escapeHtml() and apply to ~25 interpolation points across 6 files"
    status: pending
  - id: fix4
    content: "Fix 4: Internal error messages — add safeError() for catch blocks only, preserve intentional validation errors (e.g. 'Report not found', 'Unauthorized')"
    status: pending
  - id: fix2
    content: "Fix 2: AES key derivation — replace padEnd with HKDF, add legacy fallback, dry-run decrypt against real DB rows before deploying"
    status: pending
  - id: fix7
    content: "Fix 7: Portal-data slug entropy — enforce minimum length on NEW slug creation only, existing short slugs grandfathered"
    status: pending
  - id: fix8
    content: "Fix 8: npm audit fix — safe fixes first, evaluate breaking changes individually"
    status: pending
  - id: fix6
    content: "Fix 6: Deno test scaffold — create test files for crypto, email, auth middleware"
    status: pending
isProject: false
---

# Critical Failures Fix Plan

## Rollback Strategy

Since the last batch of changes broke production (commit `4776ba7` removed `--no-verify-jwt` flags), this plan uses **a dedicated branch (`critical-fixes`) with one commit per fix**. Each fix is deployed and smoke-tested individually. If any fix causes issues:

1. `git revert <commit-hash>` to undo just that one fix
2. Re-deploy only the affected functions: `supabase functions deploy <fn> --no-verify-jwt`
3. The other fixes remain intact

## Execution Order

Ordered by risk (lowest first) and dependency (utilities before consumers):

1. Fix 5 — ScheduledReport auth (15 min, frontend-only, zero risk)
2. Fix 1 — HMAC timing (30 min, small crypto change)
3. Fix 3 — escapeHtml emails (2 hrs, creates utility used later)
4. Fix 4 — Generic error messages (3 hrs, builds on shared utilities)
5. Fix 2 — AES key derivation (2 hrs, most complex due to data migration)
6. Fix 7 — Slug entropy (1 hr, independent)
7. Fix 8 — npm audit fix (2 hrs, independent)
8. Fix 6 — Deno tests (2-3 days, validates all previous fixes)

---

## Fix 1 — HMAC Timing Attack (30 min)

- **File:** [supabase/functions/\_shared/crypto.ts](supabase/functions/_shared/crypto.ts) line 13
- **Problem:** `hmacVerify` uses `computed === hash` (string equality), vulnerable to timing side-channel
- **Fix:** Use a manual constant-time XOR comparison loop (NOT `crypto.subtle.timingSafeEqual` which may not exist in Supabase Edge Functions' Deno runtime):

```typescript
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

- **Why not `timingSafeEqual`:** It's a Deno 1.38+ addition, not part of Web Crypto standard. If Supabase's Deno version doesn't have it, every HMAC verification crashes at runtime — breaking all connector/agent auth
- **Deploy:** Redeploy `api`, `api-agent`, `api-public` with `--no-verify-jwt`
- **Backout:** `git revert`, redeploy same 3 functions

## Fix 2 — Weak AES Key Derivation (2 hrs) — HIGHEST RISK

- **File:** [supabase/functions/\_shared/crypto.ts](supabase/functions/_shared/crypto.ts) line 29
- **Problem:** `centralDeriveKey()` uses `.padEnd(32, "0").slice(0, 32)` — pads short keys with predictable zeros, silently truncates long keys
- **Fix:** Replace with HKDF derivation via `crypto.subtle.deriveKey`
- **MIGRATION (critical):** Data encrypted with old derivation (Sophos Central creds in DB) won't decrypt with new derivation. Strategy:
  1. Keep old derivation as `centralDeriveKeyLegacy()`
  2. New `centralDecrypt` tries HKDF first, catches failure, falls back to legacy
  3. If legacy succeeds, re-encrypt with HKDF and update the DB row in place
  4. Both paths coexist until all rows are migrated
- **PRE-DEPLOY VALIDATION (mandatory):**
  1. Query the DB for all rows with encrypted Central credentials
  2. In a local/staging script, verify old `centralDecrypt` successfully decrypts each one
  3. Verify the new fallback path (HKDF fail → legacy succeed → re-encrypt) works end-to-end
  4. Only deploy after dry-run passes on real data
- **Deploy:** Redeploy `api-agent`, `api-public`
- **Backout:** Revert commit. Legacy path still works for all data. If any rows were re-encrypted with HKDF before revert, the reverted code won't read them — so revert ASAP if issues found

## Fix 3 — Email HTML Injection (2 hrs)

- **Files:** [supabase/functions/\_shared/email.ts](supabase/functions/_shared/email.ts) + 5 consumer files
- **Problem:** ~25 interpolation points across 6 files inject user/DB values into HTML email templates without escaping
- **Fix:** Add `escapeHtml()` to `_shared/email.ts`, wrap every user/DB-sourced value
- **CAREFUL DISTINCTIONS (to avoid breaking email rendering):**
  - **Escape these:** plain-text values interpolated into HTML context (names, dates, scores, titles)
  - **Do NOT escape these:** `bodyContent` param in `buildSophosEmailHtml` (intentional HTML built by callers), `centralNote` in `api-public` (pre-built HTML fragment) — instead, escape the individual values _before_ they are assembled into those fragments
  - **URLs in `href`:** validate starts with `https://` before interpolation (don't escape — would break the URL)
- **Consumer files:**
  - `supabase/functions/send-scheduled-reports/index.ts` — `buildEmailHtml` (`orgName`, `logoUrl`), `markdownToHtml` (finding titles)
  - `supabase/functions/api/routes/health-checks.ts` — follow-up email (`display_name`, `customer_name`, `checkedDate`, scores)
  - `supabase/functions/api/routes/send-report.ts` — report delivery email (`recipientGreeting`, `customer_name`, `signOffName`, `se_title`)
  - `supabase/functions/api/routes/se-teams.ts` — team emails (`joinerName`, `teamName`, `inviterName`)
  - `supabase/functions/api-public/index.ts` — `central_linked_firewall_name`, `customer_name`, `seName`
- **Deploy:** Redeploy `api`, `api-public`, `send-scheduled-reports`
- **Backout:** Revert commit, redeploy. No data impact

## Fix 4 — Internal Error Messages Leaked (3 hrs)

- **Files:** 21+ locations across all 8 edge functions
- **Fix:** Create `safeError()` utility in `_shared/`. Log real error server-side, return generic message
- **CAREFUL DISTINCTION (to avoid hiding useful validation feedback):**
  - **DO genericize:** `catch` block errors (unexpected exceptions), PostgREST `.message` (DB internals), upstream HTTP body leaks (Resend/Gemini response bodies)
  - **Do NOT genericize:** intentional validation errors that the user needs to see, e.g. "Unauthorized", "Report not found", "Invalid email", "Missing required field". These are deliberate 400/401/404 responses, not leaked internals
- **Three patterns to fix:**
  - Top-level `catch` blocks (7 files): `api`, `api-agent`, `api-public`, `sophos-central`, `parse-config`, `regulatory-scanner`, `send-scheduled-reports`
  - PostgREST `.message` leaks (9 route files): return "Database query failed" instead of raw PostgREST messages
  - Upstream HTTP body leaks (3 files): `send-report.ts` (Resend body), `parse-config` (Gemini body), `_shared/email.ts` (Resend body)
- **Deploy:** Redeploy all 8 functions
- **Backout:** Revert commit, redeploy all 8. No data impact

## Fix 5 — Wrong Auth in ScheduledReportSettings (15 min)

- **File:** [src/components/ScheduledReportSettings.tsx](src/components/ScheduledReportSettings.tsx) line 168-182
- **Problem:** `handleSendNow` uses `anonKey` as `Authorization: Bearer` token. `handlePreview` right below correctly uses `session.access_token`
- **Fix:** Match the `handlePreview` pattern — call `supabase.auth.getSession()` and use `session.access_token`
- **Deploy:** Frontend only (Vercel rebuild). No Supabase deploy
- **Backout:** Revert commit, push. Vercel auto-redeploys

## Fix 6 — Deno Test Scaffold (2-3 days)

- **Problem:** Zero test files under `supabase/functions/`. No Deno test infrastructure
- **Fix:** Create test files for critical paths:
  - `_shared/crypto_test.ts` — hmacHash, hmacVerify, encrypt/decrypt round-trip
  - `_shared/email_test.ts` — escapeHtml, isValidSophosXml
  - `api/auth_middleware_test.ts` — auth extraction, rejection for bad tokens
  - `api-agent/auth_test.ts` — API key validation
  - `api-public/routing_test.ts` — public route dispatch
- Add `deno.json` at `supabase/functions/` level, npm script `"test:deno"`
- **Deploy:** None needed (tests only)
- **Backout:** Delete test files. No production impact

## Fix 7 — Portal-Data Slug Entropy (1 hr)

- **File:** [supabase/functions/portal-data/index.ts](supabase/functions/portal-data/index.ts)
- **Problem:** Slugs can be any string (`acme-corp`, `client-1`). Guessable slugs allow enumeration of portal data
- **Fix (grandfathered approach — won't break existing portals):**
  - **Lookups (portal-data):** Accept all slugs regardless of length — existing portals keep working
  - **Creation (wherever slugs are set):** Enforce minimum 16-char slug or UUID format on _new_ portal creation. Auto-generate UUID-based slugs as default
  - This way no existing customer's portal breaks, but new portals are secure by default
- **Deploy:** Redeploy `portal-data` with `--no-verify-jwt`
- **Backout:** Revert commit, redeploy. No impact since lookup behavior unchanged

## Fix 8 — npm Audit Vulnerabilities (2 hrs)

- **Current state:** 16 vulns (5 critical, 2 high, 6 moderate, 3 low). Only 1 fixable without breaking changes
- **Fix in phases:**
  1. `npm audit fix` (safe — fixes `url-regex` high vuln)
  2. Evaluate `--force` fixes individually: `vite` bump (esbuild moderate), `jsdom` bump (form-data critical + others)
  3. Note: most critical/high vulns are in dev-only deps (jsdom, request) that don't ship to production
- **Deploy:** Frontend only after fix. Verify with `npm run build && npm test`
- **Backout:** `git checkout -- package.json package-lock.json && npm ci`
