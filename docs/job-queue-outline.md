# Background jobs outline (742 — reports & email)

Today, **send-scheduled-reports** and related email paths run as **synchronous Edge invocations** (cron triggers a function that loops orgs/reports). That is correct for moderate volume but becomes the first bottleneck when send volume or Resend latency grows.

## Target shape

1. **Outbox table** (Postgres): `id`, `org_id`, `kind` (`scheduled_report`, `single_send`, …), `payload` (jsonb), `status` (`pending`, `processing`, `done`, `dead`), `attempts`, `next_run_at`, `last_error`.
2. **Producer**: cron or user action inserts rows instead of doing all SMTP work inline.
3. **Worker**: dedicated Edge function (or queue consumer) claims batches with `FOR UPDATE SKIP LOCKED`, sends via Resend, marks done or retries with backoff.
4. **DLQ**: after `N` attempts, move to `dead` and alert via `logJson` / drain.

## Why not ship full queue in the pilot PR

- Requires migration + idempotent send keys + operational runbooks.
- **741** Redis pilot proves cache; **742** should land with schema review and a single job kind first (e.g. scheduled reports only).

## Interim mitigations

- Existing **batched** reads in **send-scheduled-reports** reduce N+1.
- **Observability**: keep **`send_scheduled_reports_*`** `logJson` events green before adding queue complexity.

---

## Implementation plan v1 (scheduled reports only)

Use this as the engineering checklist; trim if you scope smaller.

1. **Migration:** create **`job_outbox`** (or agreed name) with columns from **Target shape** above + `created_at`, `updated_at`; RLS/service-role only. **Repo:** [`supabase/migrations/20260330180000_job_outbox.sql`](../supabase/migrations/20260330180000_job_outbox.sql) (apply before producer/worker work).
2. **Idempotency:** add **`idempotency_key`** (hash of org + report id + window) unique partial index to avoid duplicate sends on cron retry.
3. **Producer:** in **`send-scheduled-reports`**, replace inline Resend loop with **insert outbox rows** for due reports (transactional with “last run” marker if needed). Return **200** when enqueue completes.
4. **Worker:** new function **`process-job-outbox`** (or second entry in same deploy) — **`SELECT … FOR UPDATE SKIP LOCKED`**, call Resend, **`logJson`** success/fail, backoff **`next_run_at`**, move to **`dead`** after **N** attempts.
5. **Cron:** Supabase **pg_cron** + **pg_net** (or dashboard cron) — **producer** on schedule; **worker** every minute or on completion trigger.
6. **Runbook:** document secrets, DLQ triage, and “replay dead row” SQL in [SELF-HOSTED.md](SELF-HOSTED.md) or ops doc.
7. **Tests:** Deno test **producer** with mocked DB (or stub client) and **worker** with mocked Resend.

**Related plan:** [review-follow-on-from-REVIEW.md](plans/review-follow-on-from-REVIEW.md) §3.
