# When to start the scale program (Redis, queues, Gemini)

Structural work (TanStack Query, smaller files, OpenAPI) is **not** blocked on caching or background jobs. Use this checklist to decide when to **prioritise** the Tier 3 items in [REVIEW.md](REVIEW.md) (Upstash Redis, email/report queue, Gemini retry queue).

## Triggers (any sustained pattern)

1. **Edge p95 / timeout pressure** — Hot routes (`parse-config`, `api/health-checks`, `api/se-teams`) exceed your SLO in Supabase Edge metrics or log drain HTTP latency charts. Use [PERF-EXPLAIN.md](PERF-EXPLAIN.md) and [observability.md](observability.md) latency table first to rule out slow SQL.
2. **Cron or sender backlog** — `send-scheduled-reports`, `regulatory-scanner`, or similar show growing lag (rows pending, duplicate runs, or operator complaints).
3. **Provider rate limits** — Repeated Gemini (or other LLM) **429** / quota errors in function logs with user-visible failures.
4. **Concurrency ceiling** — Supabase or platform limits on concurrent Edge invocations become the bottleneck during normal business load (not a single spike).

## What to ship first (order of operations)

1. **Dashboards** — Saved searches / boards on stable `logJson` `message` values ([observability.md](observability.md)); confirm you can see rate and latency before adding infrastructure.
2. **Hot-path cache (Redis)** — Read-mostly, cacheable responses with explicit TTL and invalidation story; avoid caching per-user secrets.
3. **Durable work (queue)** — Email and large report generation that should survive retries and deploys without blocking the HTTP response.
4. **Gemini queue** — Serialize or throttle AI calls with backoff; keep idempotency keys where the same job could be retried.

## Out of scope for “scale program”

- Replacing direct Supabase client reads in the SPA (client data layer) — that remains the default **architecture maturity** track ([client-data-layer.md](api/client-data-layer.md)).
