# Background jobs outline (742 — reports & email)

**Shipped (v1):** Due scheduled reports are **enqueued** in **`job_outbox`** by **`send-scheduled-reports`** (producer). **`process-job-outbox`** (worker) claims rows with **`claim_job_outbox_batch`** (`FOR UPDATE SKIP LOCKED`), sends via **Resend**, updates **`scheduled_reports`** on success, and retries with exponential backoff or moves rows to **`dead`**. See migrations [`20260330180000_job_outbox.sql`](../supabase/migrations/20260330180000_job_outbox.sql) and [`20260330190000_job_outbox_claim_fn.sql`](../supabase/migrations/20260330190000_job_outbox_claim_fn.sql).

Earlier, **send-scheduled-reports** sent email **inline** in one invocation; that pattern hits bottlenecks when send volume or Resend latency grows.

## Target shape

1. **Outbox table** (Postgres): `id`, `org_id`, `kind` (`scheduled_report`, `single_send`, …), `payload` (jsonb), `status` (`pending`, `processing`, `done`, `dead`), `attempts`, `next_run_at`, `last_error`.
2. **Producer**: cron or user action inserts rows instead of doing all SMTP work inline.
3. **Worker**: dedicated Edge function (or queue consumer) claims batches with `FOR UPDATE SKIP LOCKED`, sends via Resend, marks done or retries with backoff.
4. **DLQ**: after `N` attempts, move to `dead` and alert via `logJson` / drain.

## Why not ship full queue in the pilot PR

- Requires migration + idempotent send keys + operational runbooks.
- **741** Redis pilot proves cache; **742** should land with schema review and a single job kind first (e.g. scheduled reports only).

## Interim mitigations (historical)

- The worker still performs **batched** `agent_submissions` reads per claim batch (same shape as the old inline sender).
- **Observability:** **`send_scheduled_reports_*`** and **`process_job_outbox_*`** `logJson` events — see [observability.md](observability.md).

---

## Implementation plan v1 (scheduled reports only)

Use this as the engineering checklist; trim if you scope smaller.

1. **Migration:** create **`job_outbox`** (or agreed name) with columns from **Target shape** above + `created_at`, `updated_at`; RLS/service-role only. **Repo:** [`supabase/migrations/20260330180000_job_outbox.sql`](../supabase/migrations/20260330180000_job_outbox.sql) (apply before producer/worker work).
2. **Idempotency:** add **`idempotency_key`** (hash of org + report id + window) unique partial index to avoid duplicate sends on cron retry.
3. **Producer:** in **`send-scheduled-reports`**, replace inline Resend loop with **insert outbox rows** for due reports (transactional with “last run” marker if needed). Return **200** when enqueue completes.
4. **Worker:** **`process-job-outbox`** — RPC **`claim_job_outbox_batch`**, Resend, **`logJson`**, backoff, **`dead`** after **6** attempts. **Repo:** [`supabase/functions/process-job-outbox/index.ts`](../supabase/functions/process-job-outbox/index.ts).
5. **Cron:** Schedule **both** invocations (e.g. Supabase **pg_cron** + **pg_net**, GitHub Actions, or external cron). **Producer** on your due cadence (e.g. hourly); **worker** more frequently (e.g. every 1–5 minutes) so the queue drains quickly. Use **`Authorization: Bearer <CRON_SECRET>`** when **`CRON_SECRET`** is set on the functions.
6. **Runbook:** [SELF-HOSTED.md](SELF-HOSTED.md) § _Scheduled reports job queue_ — secrets, DLQ triage, replay SQL.
7. **Tests:** Deno tests for **handler** (OPTIONS) and **scheduled-report-email** helpers; extend with mocked DB/Resend as needed.

**Related plan:** [review-follow-on-from-REVIEW.md](plans/review-follow-on-from-REVIEW.md) §3.
