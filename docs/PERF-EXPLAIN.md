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
