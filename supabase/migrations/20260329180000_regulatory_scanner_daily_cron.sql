-- Daily regulatory-scanner at 06:00 UTC (pg_cron + pg_net), same pattern as agent-nudge.
-- Requires app.settings.supabase_url and app.settings.service_role_key (Database > Custom Config).
-- Enable pg_cron + pg_net in Dashboard > Database > Extensions if needed.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('regulatory-scanner-daily');
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'regulatory-scanner-daily',
      '0 6 * * *',
      $job$
      select net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/regulatory-scanner',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{"action":"scan"}'::jsonb
      );
      $job$
    );
    raise notice 'regulatory-scanner-daily cron job scheduled (06:00 UTC)';
  else
    raise notice 'pg_cron not enabled — skipping regulatory-scanner schedule.';
  end if;
end
$$;
