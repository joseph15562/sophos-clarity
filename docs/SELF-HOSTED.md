# Self-hosted / single-tenant FireComply

This document is a **starting runbook** for teams that need dedicated infrastructure (data residency, sovereign cloud, or contractual isolation). Product defaults assume the shared Supabase-backed SaaS; self-hosted is an **optional XL** track.

## What you must operate

1. **Supabase-compatible stack** (or managed Supabase dedicated project): Postgres, Auth, Storage (if used), Edge Functions runtime.
2. **Secrets**: AI provider keys (if AI reports enabled), email, Sophos Central proxy secrets — injected as function secrets, not in the repo.
3. **`API_KEY_HMAC_SECRET`** (recommended): 32+ byte random string used to HMAC org service API keys. If unset, Edge Functions fall back to `SUPABASE_SERVICE_ROLE_KEY` so existing deployments keep working. **Rotation:** set the new secret, redeploy functions, then **re-issue** service keys from workspace settings (old signatures will no longer verify). Clear the old secret only after all keys are rotated.
4. **Connector releases**: Host GitHub Release binaries or an internal artefact registry; set `VITE_CONNECTOR_VERSION_LATEST` to match the bundle you distribute.

## High-level steps

1. Fork / clone the application and `supabase/` migrations; apply migrations to your database.
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for your project.
3. Deploy the SPA (e.g. static hosting + CDN) and Edge Functions (`supabase functions deploy` or CI).
4. Lock **CORS** and **Auth** providers to your domain; enable MFA policies per your org standard.
5. Optional: disable cloud-only features (AI, external Geo-IP) via product flags if you add them for your build.

## Product telemetry (optional)

- The SPA can **`POST` JSON events** to your own endpoint when **`VITE_ANALYTICS_INGEST_URL`** is set (see [`src/lib/product-telemetry.ts`](../src/lib/product-telemetry.ts)). Events are **no-op** when unset. In **dev**, events are also logged to the console. Point the URL at your collector (PostHog ingest proxy, internal API, etc.) and strip or hash identifiers per policy.
- **Route views:** the app emits **`spa_page_view`** with `pathname` when navigation changes (same ingest pipeline as other `trackProductEvent` calls).

## Portal read cache (optional)

- **Upstash Redis** (REST): set Edge secrets **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** to enable a short-TTL cache on **`portal-data`** GET responses. Omit both to disable. See [redis-pilot.md](redis-pilot.md).

## Feature flags (optional build)

- Use **`VITE_FEATURE_<NAME>=1`** (or `true`) and [`src/lib/feature-flags.ts`](../src/lib/feature-flags.ts) — call `isFeatureEnabled("my-feature")` (normalized to `VITE_FEATURE_MY_FEATURE`). Useful for staging rollouts alongside telemetry.

## Observability (optional)

- **Browser (Sentry):** If you use Sentry, set **`VITE_SENTRY_DSN`** on the static build. If unset, the app skips `Sentry.init` and sends nothing. Keep **PII off** in Sentry project settings; the client uses `sendDefaultPii: false`.
- **Edge:** Functions emit structured **`logJson`** events for many routes. Point your Supabase log drain (e.g. Logflare) at saved searches / alerts on stable `message` values. Full naming convention and catalog: [observability.md](observability.md). **Edge Sentry** (or similar) is optional and should use a **separate DSN** from the SPA after policy review (PII, retention).

## Scheduled reports job queue

Scheduled compliance emails use a small **outbox** so cron stays fast and sends can retry.

1. **Migrations:** `job_outbox` table plus **`claim_job_outbox_batch`** — see [job-queue-outline.md](job-queue-outline.md).
2. **Functions:** Deploy **`send-scheduled-reports`** (producer) and **`process-job-outbox`** (worker) with the rest of Edge Functions. Set secrets **`RESEND_API_KEY`**, **`REPORT_FROM_EMAIL`** (optional), and the usual **`SUPABASE_*`** keys.
3. **Cron:** Invoke **both** URLs on a schedule (e.g. producer hourly, worker every 1–5 minutes). If **`CRON_SECRET`** is set on the functions, send **`Authorization: Bearer <CRON_SECRET>`** on each request.
4. **DLQ / replay:** Rows in **`dead`** failed after retries. Inspect **`last_error`**, fix the underlying issue, then replay, for example:

```sql
UPDATE public.job_outbox
SET status = 'pending',
    attempts = 0,
    last_error = NULL,
    next_run_at = now(),
    updated_at = now()
WHERE id = '<job uuid>';
```

Stale **`processing`** rows (e.g. worker crash) are reset to **`pending`** after **15 minutes** on the next worker tick.

## Helm / Docker

- **Not shipped in-repo yet** — treat container images and Helm charts as follow-on work once baseline `Dockerfile` + compose for `web` + `functions` are published.
- Until then, use Vercel/Netlify-style static deploy for the UI and Supabase-hosted functions, or wrap the Vite build in your own OCI image.

## Support

Partner engineering typically assists with **reference architectures** and **security review** before production self-host. Contact your Sophos / FireComply program owner for a formal statement of support.
