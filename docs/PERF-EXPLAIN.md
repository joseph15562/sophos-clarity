# Postgres `EXPLAIN ANALYZE` (Tier 3)

Use this when Tier 2 observability shows slow Edge handlers or Supabase reports high DB time.

1. Capture the exact SQL (Supabase dashboard → query insights, or log `logJson` with query hints — avoid logging raw customer data).
2. In SQL editor (service role or sufficient privileges), run:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
-- paste SELECT / INSERT / UPDATE here
```

3. Look for sequential scans on large tables, nested loops with high row counts, or missing indexes on filter columns (`org_id`, `user_id`, `created_at` ranges).
4. Add composite indexes only when `EXPLAIN` shows a clear win; re-run after migration.

Reference: [Supabase Postgres best practices](https://supabase.com/docs/guides/database/database-linter) and project ADRs under `docs/adr/`.

## Operational checklist (indexes on prod-like data)

1. **Snapshot workload** — Use Supabase Query Insights (or `logJson`-tagged slow paths) to list the top 5 statements by total time when traffic matches a typical MSP org size.
2. **Run `EXPLAIN (ANALYZE, BUFFERS)`** for each on a **staging** database restored from anonymised prod-like data (or a large seed), not on customer rows in production SQL editors.
3. **Land migrations** — Add indexes only when `EXPLAIN` shows sequential scans or nested loops on hot filters (`org_id`, `user_id`, `created_at` ranges, foreign keys used in joins). Prefer composite indexes that match exact `WHERE` + `ORDER BY` patterns.
4. **Re-verify** — Re-run `EXPLAIN` after `supabase db push` / migration apply; update [docs/api/client-data-layer.md](api/client-data-layer.md) or ADRs if a new query pattern becomes dominant.
5. **Correlate with k6** — After index changes, re-run [`scripts/k6/sustained.js`](../scripts/k6/sustained.js) against a staging `BASE_URL` to ensure p95 and error rate thresholds still pass.
