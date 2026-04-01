# Observability — Edge API (`logJson`)

Supabase Edge Functions log to the platform logger. The `api` function uses `logJson` from `supabase/functions/_shared/logger.ts`: one JSON object per line with `level`, `message`, `ts`, and optional fields.

## Naming convention

- **Invalid JSON / Zod body:** `warn`, message ends with `_invalid_body` (or `_invalid_query` for query params). Includes `issues` (issue count) when from Zod.
- **Downstream / provider errors:** usually `error` with a stable `message` suffix like `_failed`.
- **Unhandled router errors:** `error`, `api_unhandled`.

## Alerting and drains

1. Configure a **log drain** (e.g. Logflare, Datadog) for your Supabase project’s function logs.
2. Save **saved searches** (or equivalent) on `message` values you care about.
3. Suggested **warn** thresholds (tune per org):
   - Spike in `*_invalid_body` events may indicate a broken client, attack traffic, or a bad deploy; alert if rate exceeds baseline (e.g. &gt; N/min sustained).
4. Suggested **error** thresholds:
   - Any `api_unhandled` in production (immediate page).
   - Sustained `send_report_email_provider_failed` (email delivery).

**Scale vs structure:** Use [SCALE-TRIGGERS.md](SCALE-TRIGGERS.md) to decide when Redis, job queues, or a Gemini throttle move ahead of ordinary client/API polish.

## Saved search examples (Logflare / SQL-style drains)

Use your provider’s query language; examples assume one JSON object per log line with a **`message`** field.

| Intent                             | Example filter                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Router crashes                     | `message = "api_unhandled"` or `api_public_unhandled` / `api_agent_unhandled` |
| Any Zod body rejection             | `message ~ "*_invalid_body"` or regex `invalid_body`                          |
| Autotask PSA only                  | `message ~ "autotask_psa_*_invalid_body"`                                     |
| Email send failures                | `message = "send_report_email_provider_failed"`                               |
| Scheduled report pipeline (worker) | `message ~ "^process_job_outbox_"` (batch claim, send, reap, dead-letter)     |
| Scheduled report producer          | `message ~ "^send_scheduled_reports_"` (enqueue / skip / complete)            |

**Spike alert (warn):** count events in a 5-minute window where `message` ends with `_invalid_body`; alert if count &gt; **K** (choose K from your baseline after a week of data).

**Edge error capture:** optional **Sentry** (or similar) for Edge requires a separate DSN and policy review (PII, retention). Document DSN scope in [SELF-HOSTED.md](SELF-HOSTED.md) if enabled.

**Implementation checklist (when you enable Edge Sentry):**

1. Create a **project/DNS** used **only** for Edge (never reuse the SPA DSN).
2. Initialise **after** `logJson` for request context; attach **function name** + **safe** org/user id if policy allows.
3. Set **sample rates** (e.g. 100% errors, low % transactions).
4. Add one **alert** on **new issue spike** or error rate vs baseline.
5. Cross-link saved searches in this doc with Sentry **issue** tags if your org uses both.

Placeholder hooks (no SDK dependency until DSN is set): [`supabase/functions/_shared/sentry-edge.ts`](../supabase/functions/_shared/sentry-edge.ts).

See [review-follow-on-from-REVIEW.md](plans/review-follow-on-from-REVIEW.md) §3b.

## Latency dashboards (Supabase / drain provider)

Use your host’s **Edge Function** HTTP metrics (Supabase Dashboard → Edge Functions → per-function invocations / duration, or exported metrics via drain).

| Chart / alert    | Suggested scope                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **p95 duration** | One series per hot function: `api`, `parse-config`, `api-public`, `api-agent`, `portal-data`.               |
| **Error rate**   | HTTP 5xx ratio per function; correlate with `api_unhandled`, `api_public_unhandled`, `api_agent_unhandled`. |
| **Volume**       | Invocations/min per function; spike + latency regression may indicate abuse or slow downstream.             |

`logJson` lines do not include request duration until you add an explicit field in handlers; prefer platform HTTP timing for p95 first.

## `api` router — `message` catalog

| `message`                                                | Level | Meaning                                    |
| -------------------------------------------------------- | ----- | ------------------------------------------ |
| `api_unhandled`                                          | error | Uncaught exception in router               |
| `agent_register_invalid_body`                            | warn  | Zod rejected agent register body           |
| `agent_heartbeat_invalid_body`                           | warn  | Zod rejected heartbeat body                |
| `agent_submit_invalid_body`                              | warn  | Zod rejected submit body                   |
| `agent_verify_identity_invalid_body`                     | warn  | Zod rejected verify-identity body          |
| `admin_reset_mfa_invalid_body`                           | warn  | Zod rejected reset-mfa body                |
| `auth_mfa_recovery_invalid_body`                         | warn  | Zod rejected MFA recovery body             |
| `assessments_list_invalid_query`                         | warn  | Zod rejected list query params             |
| `autotask_psa_company_mapping_put_invalid_body`          | warn  | Zod rejected Autotask mapping PUT          |
| `autotask_psa_company_mapping_delete_invalid_body`       | warn  | Zod rejected Autotask mapping DELETE       |
| `autotask_psa_credentials_post_invalid_body`             | warn  | Zod rejected Autotask credentials POST     |
| `autotask_psa_ticket_post_invalid_body`                  | warn  | Zod rejected Autotask ticket POST          |
| `connectwise_credentials_invalid_body`                   | warn  | Zod rejected ConnectWise Cloud credentials |
| `connectwise_manage_company_mapping_put_invalid_body`    | warn  | Zod rejected Manage mapping PUT            |
| `connectwise_manage_company_mapping_delete_invalid_body` | warn  | Zod rejected Manage mapping DELETE         |
| `connectwise_manage_credentials_post_invalid_body`       | warn  | Zod rejected Manage credentials POST       |
| `connectwise_manage_ticket_post_invalid_body`            | warn  | Zod rejected Manage ticket POST            |
| `config_upload_request_invalid_body`                     | warn  | Zod rejected config-upload-request body    |
| `health_check_team_invalid_body`                         | warn  | Zod rejected health-check team assignment  |
| `health_check_bulk_team_invalid_body`                    | warn  | Zod rejected bulk team assignment          |
| `health_check_followup_invalid_body`                     | warn  | Zod rejected follow-up body                |
| `passkey_register_verify_invalid_body`                   | warn  | Zod rejected passkey register-verify       |
| `portal_viewers_invite_invalid_body`                     | warn  | Zod rejected portal viewer invite          |
| `portal_viewers_invite_auth_failed`                      | warn  | Supabase auth invite error                 |
| `portal_viewers_auth_invite_error`                       | warn  | Unexpected error during auth invite        |
| `se_team_create_invalid_body`                            | warn  | Zod rejected SE team create                |
| `se_team_rename_invalid_body`                            | warn  | Zod rejected SE team rename                |
| `se_team_invite_invalid_body`                            | warn  | Zod rejected SE team invite                |
| `se_team_transfer_admin_invalid_body`                    | warn  | Zod rejected transfer-admin                |
| `send_report_invalid_body`                               | warn  | Zod rejected send-report body              |
| `send_report_email_provider_failed`                      | error | Resend API non-OK response                 |
| `service_key_issue_invalid_body`                         | warn  | Zod rejected service-key issue             |
| `service_key_revoke_invalid_body`                        | warn  | Zod rejected service-key revoke            |

## `api-public` — `message` catalog

| `message`              | Level | Meaning                                                   |
| ---------------------- | ----- | --------------------------------------------------------- |
| `api_public_not_found` | warn  | No route matched (`method`, `path`, `segments` in fields) |
| `api_public_unhandled` | error | Uncaught exception in router                              |

## `api-agent` — `message` catalog

| `message`                   | Level | Meaning                               |
| --------------------------- | ----- | ------------------------------------- |
| `api_agent_missing_api_key` | warn  | Request without `X-API-Key`           |
| `api_agent_invalid_api_key` | warn  | Key did not authenticate              |
| `api_agent_not_found`       | warn  | No matching route (`method`, `route`) |
| `api_agent_unhandled`       | error | Uncaught exception in handler         |

## Other Edge functions — `message` highlights

| Function                   | `message` (examples)                                                                                    | Level           | Notes                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| **parse-config**           | `parse_config_unhandled`                                                                                | error           | Top-level catch (in addition to existing Gemini/rate-limit events) |
| **parse-config**           | `parse_config_rate_limited`, `parse_config_gemini_*`, `parse_config_token_usage`                        | warn/info/error | See function source for full set                                   |
| **portal-data**            | `portal_data_config_lookup`, `portal_data_unexpected`                                                   | error           | Config resolution vs unexpected                                    |
| **sophos-central**         | `sophos_central_*`                                                                                      | warn            | Guest auth, MDR feed, etc.                                         |
| **send-scheduled-reports** | `send_scheduled_reports_start`, `send_scheduled_reports_complete`                                       | info            | Producer: `dueCount`, `enqueued`, `skippedDuplicate`, `failed`     |
| **send-scheduled-reports** | `send_scheduled_reports_enqueue`                                                                        | error           | Failed to insert `job_outbox` row                                  |
| **process-job-outbox**     | `process_job_outbox_claimed`, `process_job_outbox_complete`, `process_job_outbox_sent`                  | info            | Worker batch: `claimed`, `done`, `retried`, `dead`                 |
| **process-job-outbox**     | `process_job_outbox_resend`, `process_job_outbox_dead`, `process_job_outbox_claim`                      | error           | Resend failure, DLQ, RPC/claim errors                              |
| **process-job-outbox**     | `process_job_outbox_reap_stale`, `process_job_outbox_report_missing`, `process_job_outbox_build_failed` | warn/error      | Stale `processing` reap, bad payload / missing report              |
| **agent-nudge**            | `agent_nudge_start`                                                                                     | info            | Cron: `staleCandidates` before updates                             |
| **agent-nudge**            | `agent_nudge_complete`, `agent_nudge_fetch`                                                             | info/error      | Summary counts / DB fetch failure                                  |
| **regulatory-scanner**     | `regulatory_*`                                                                                          | warn/info       | RSS / Gemini / upsert                                              |

## Parity with the repo

To list every `logJson` event name currently in `supabase/functions`, run from the repo root:

```bash
rg 'logJson\("' supabase/functions -g '*.ts'
```

Use the output to extend this doc or your drain saved searches when adding new handlers.

## Log drains — operational checklist (REVIEW scalability)

1. **Boards:** p95 Edge invocation latency (platform metrics) + error rate by `message` for `api_*`, `api_public_*`, `process_job_outbox_*`, `send_scheduled_reports_*`.
2. **Alerts:** `api_unhandled` / `api_public_unhandled` any in prod; sustained `*_invalid_body` spike; `process_job_outbox_dead` or DLQ-style `dead` rows (see [job-queue-outline.md](job-queue-outline.md)).
3. **Job queue:** [OPS-SCHEDULED-REPORTS-QUEUE.md](OPS-SCHEDULED-REPORTS-QUEUE.md) — dual cron + worker health; optional **Edge Sentry** rules on uncaught errors ([SELF-HOSTED.md](SELF-HOSTED.md)).

## SPA product events (optional ingest)

Custom funnel events from `trackProductEvent` / `spa_page_view` when `VITE_ANALYTICS_INGEST_URL` is set — see [product-telemetry-events.md](product-telemetry-events.md) for a curated catalog.
