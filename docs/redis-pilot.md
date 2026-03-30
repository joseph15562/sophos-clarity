# Redis pilot (portal-data cache)

Optional **Upstash Redis REST** caches successful **`portal-data`** GET responses so repeat portal loads skip the heavy Supabase aggregation.

## Configuration

Set Supabase Edge secrets (not `VITE_*`):

- `UPSTASH_REDIS_REST_URL` — Upstash REST API URL
- `UPSTASH_REDIS_REST_TOKEN` — Upstash REST token

If either is unset, the function skips Redis entirely (same behaviour as before the pilot).

## Behaviour

- Cache key: `portal_data:v2:` + org id + stable hash of query inputs (slug/org_id, flags).
- TTL: **45 seconds** (short — balances flash-traffic relief with freshness).
- Invalidation: TTL only for this pilot; document org-level purge if you extend TTL or add write-through invalidation later.

## Operations

- Watch hit rate via your Redis/Upstash dashboard and **`portal-data`** `logJson` timings.
- Pair with [docs/SCALE-TRIGGERS.md](SCALE-TRIGGERS.md) when raising TTL or adding more cached routes.
