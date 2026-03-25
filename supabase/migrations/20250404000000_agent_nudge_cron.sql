-- Schedule agent-nudge to run daily at 03:00 UTC via pg_cron + pg_net.
-- Nudges stale agents (no submission in 24 h) with a run-assessment command
-- and marks agents offline after 48 h of silence.
--
-- pg_cron and pg_net must be enabled in Supabase Dashboard > Database > Extensions.
-- This migration is idempotent: safe to re-run after enabling the extensions.

do $$
begin
  -- Only attempt scheduling if pg_cron is available
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'agent-nudge-daily',
      '0 3 * * *',
      $job$
      select net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/agent-nudge',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $job$
    );
    raise notice 'agent-nudge-daily cron job scheduled';
  else
    raise notice 'pg_cron not enabled — skipping agent-nudge schedule. Enable it in Supabase Dashboard.';
  end if;
end
$$;
