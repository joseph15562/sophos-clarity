---
name: Critical tactical fixes
overview: "Ship four tactical security/infrastructure fixes: add RLS to gemini_usage, implement real TOTP verification for agent MFA, replace in-memory rate limiting with DB-backed enforcement, and consolidate JWT verification config out of hidden deploy flags."
todos:
  - id: rls-migration
    content: Create gemini_usage RLS migration (enable RLS, no user policies)
    status: completed
  - id: totp-verify
    content: Replace fake verify-identity with real Supabase Auth MFA admin API verification
    status: completed
  - id: rate-limit-db
    content: Add user_id to gemini_usage, replace in-memory rate limiting with DB query
    status: completed
  - id: jwt-config
    content: Move --no-verify-jwt to config.toml, remove from deploy scripts, add auth matrix docs
    status: completed
isProject: false
---

# Critical Tactical Fixes

## Fix 1: Add RLS to `gemini_usage` (30 min)

**Problem:** The `gemini_usage` table has no Row Level Security enabled. While only the service role writes to it (from `parse-config`), the `anon` and `authenticated` roles can currently read/write directly via the PostgREST API.

**File:** New migration `supabase/migrations/20250403000000_gemini_usage_rls.sql`

**Plan:**
- Enable RLS on the table
- Add zero user-facing policies (service role bypasses RLS, so `parse-config` writes continue working)
- This effectively locks the table to service-role-only access

```sql
ALTER TABLE public.gemini_usage ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies: only service_role can access.
-- parse-config uses adminClient (service role) to insert usage rows.
```

Following the pattern established in [supabase/migrations/20250312000000_multi_tenant.sql](supabase/migrations/20250312000000_multi_tenant.sql) and 15+ other tables that already use RLS.

---

## Fix 2: Implement real TOTP verification (2-3 hours)

**Problem:** The `POST /api/agent/verify-identity` endpoint at [supabase/functions/api/index.ts:812-841](supabase/functions/api/index.ts) accepts any `totpCode` value and returns a fake session token. The endpoint is used by the Electron connector agent for MFA identity verification.

**Current behavior:** Checks that the user exists and belongs to the agent's org, then ignores the TOTP code and returns `crypto.randomUUID()` as a session token.

**Plan:** Replace the placeholder with real Supabase Auth MFA verification using the admin API (the same API already used for `admin/reset-mfa` at line 1040):

1. After confirming org membership, use `db.auth.admin.mfa.listFactors({ userId: targetUser.id })` to get the user's enrolled TOTP factors
2. If no TOTP factors are enrolled, return a `412 Precondition Failed` with a clear message
3. Use the **admin `generateChallenge` + `verify`** flow to validate the TOTP code:
   - `db.auth.admin.mfa.createChallenge({ factorId })` to get a challenge
   - `db.auth.admin.mfa.verify({ challengeId, code: totpCode })` to verify the code
4. On success, return the session token (keep the existing response shape for backwards compatibility with the Electron agent)
5. On failure, return `401 Invalid TOTP code`
6. Add audit log entry for successful verifications

**Key reference:** The `admin/reset-mfa` handler at line 1040 already demonstrates the pattern of listing/manipulating MFA factors via the admin API.

---

## Fix 3: DB-backed rate limiting (2-3 hours)

**Problem:** Rate limiting in [supabase/functions/parse-config/index.ts:28-39](supabase/functions/parse-config/index.ts) uses an in-memory `Map`. This resets on cold starts and doesn't work across multiple isolates/instances.

**Plan:** Replace with a `gemini_usage`-table-backed check (the table already records every request with timestamps):

1. Remove the `rateLimitMap` and `isRateLimited()` function
2. Add a new `checkRateLimit(userId: string)` function that queries `gemini_usage`:

```typescript
async function checkRateLimit(userId: string, db: SupabaseClient): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await db
    .from("gemini_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", windowStart);
  return (count ?? 0) >= MAX_REQUESTS_PER_WINDOW;
}
```

3. **Schema change:** Add a `user_id` column to `gemini_usage` (new migration) so rate limiting is per-user:

```sql
ALTER TABLE public.gemini_usage ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX idx_gemini_usage_user_rate ON public.gemini_usage(user_id, created_at DESC);
```

4. Update the insert in `parse-config` to include `user_id` from the authenticated user
5. The rate limit query filters by `user_id` and `created_at >= windowStart`, using the new index

**Trade-off:** This adds one DB query per request. The `gemini_usage` table with the composite index makes this fast (sub-ms). The benefit is correct cross-instance enforcement that survives cold starts.

---

## Fix 4: Consolidate JWT verification config (1 hour)

**Problem:** All three edge functions are deployed with `--no-verify-jwt` in [deploy.yml:57-59](.github/workflows/deploy.yml) and [staging.yml:56-58](.github/workflows/staging.yml), but only `parse-config` and `sophos-central` declare this in [supabase/config.toml](supabase/config.toml). The `api` function's JWT bypass is hidden in CI scripts with no documentation.

**Why `api` needs `verify_jwt = false`:** It serves mixed-auth routes - JWT (web app), API keys (connector agents), service role (cron), and public tokens (shared reports). Gateway-level JWT enforcement would break non-JWT routes. Full re-enablement requires splitting the API (#5 from the audit).

**Plan:**

1. **`supabase/config.toml`** - Add the `api` function with documentation:

```toml
[functions.api]
verify_jwt = false
# Mixed auth: JWT (web app), API keys (agents), service role (cron),
# public tokens (shared reports). Per-route auth enforced in handler.
# Re-enable after API split (see docs/plans/war-room-audit.md #5).
```

2. **`deploy.yml` and `staging.yml`** - Remove all `--no-verify-jwt` flags; let `config.toml` be the single source of truth:

```yaml
- name: Deploy Edge Functions
  run: |
    supabase functions deploy parse-config
    supabase functions deploy api
    supabase functions deploy sophos-central
```

3. **`supabase/functions/api/index.ts`** - Add a route auth matrix comment block at the top of the main router documenting which routes use which auth mechanism. This makes the security posture auditable at a glance.
