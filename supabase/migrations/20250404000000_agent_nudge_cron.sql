-- Schedule agent-nudge to run daily at 03:00 UTC via pg_cron + pg_net.
-- Nudges stale agents (no submission in 24 h) with a run-assessment command
-- and marks agents offline after 48 h of silence.

select cron.schedule(
  'agent-nudge-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/agent-nudge',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
