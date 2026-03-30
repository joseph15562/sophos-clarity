# STRIDE snapshot — Sophos FireComply SPA + Supabase Edge

One-page orientation for security reviews (Phase G). Not a formal pen-test substitute.

| Threat                     | Example in this stack              | Mitigations (high level)                                                                       |
| -------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Spoofing**               | Fake Central or Supabase caller    | JWT on **`api`** routes; connector **`X-API-Key`**; service role only inside Edge              |
| **Tampering**              | Altered portal slug / shared token | Strong slug entropy; HMAC service keys; Zod on **`api`** bodies                                |
| **Repudiation**            | “We didn’t send that email”        | Structured **`logJson`** + drain retention; Resend provider logs                               |
| **Information disclosure** | Error bodies, IDOR                 | **`safeError`** / **`safeDbError`**; portal resolves by secret slug; optional Sentry scrubbing |
| **Denial of service**      | Cron or portal hammering           | Rate limits where configured; **portal-data** optional Redis TTL cache; cron auth              |
| **Elevation of privilege** | Cross-org reads                    | RLS + org scoping in handlers; never trust client-only checks                                  |

**Follow-ups:** Edge Sentry separate DSN ([SELF-HOSTED.md](SELF-HOSTED.md)), dependency review automation in CI, and periodic re-read of **`api`** / **`api-public`** auth matrix in [edge-routes.md](api/edge-routes.md).
