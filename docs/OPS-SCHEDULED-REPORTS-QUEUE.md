# Scheduled reports queue — deployment verification

Use this after code changes or when onboarding a new Supabase project.

## 1. Database

- [ ] Migrations applied: **`20260330180000_job_outbox.sql`**, **`20260330190000_job_outbox_claim_fn.sql`** (`supabase db push` or equivalent).
- [ ] In SQL editor, confirm **`job_outbox`** exists and **`claim_job_outbox_batch`** is callable (service role).

## 2. Edge functions

- [ ] Deploy **`send-scheduled-reports`** and **`process-job-outbox`** (`supabase functions deploy … --no-verify-jwt` matches [CI workflows](../../.github/workflows/deploy.yml)).
- [ ] Secrets: **`SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`**, **`RESEND_API_KEY`**, optional **`REPORT_FROM_EMAIL`**, optional **`SENTRY_EDGE_DSN`**.
- [ ] Optional **`CRON_SECRET`**: set on **both** functions; callers must send **`Authorization: Bearer <CRON_SECRET>`**.

## 3. Schedules (two jobs)

- [ ] **Producer** — invoke **`send-scheduled-reports`** on your due cadence (e.g. hourly).
- [ ] **Worker** — invoke **`process-job-outbox`** more often (e.g. every 1–5 minutes) so the outbox drains.

See [SELF-HOSTED.md](SELF-HOSTED.md) § _Scheduled reports job queue_ and [job-queue-outline.md](job-queue-outline.md).

## 4. Smoke check

- [ ] **`process-job-outbox`** with empty queue returns **`claimed: 0`** (200).
- [ ] Logs show **`send_scheduled_reports_*`** / **`process_job_outbox_*`** events per [observability.md](observability.md).
