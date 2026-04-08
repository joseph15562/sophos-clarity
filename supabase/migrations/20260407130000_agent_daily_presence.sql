-- One row per agent per UTC calendar day: server-side "touch-in" for the Assess
-- fleet **Agent Status (Last 7 Days)** timeline (see TenantDashboard). Does not
-- replace real connector heartbeats on `agents.last_seen_at`.

create table if not exists public.agent_daily_presence (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  constraint agent_daily_presence_agent_day unique (agent_id, day)
);

alter table public.agent_daily_presence enable row level security;

drop policy if exists "Members can view org agent daily presence" on public.agent_daily_presence;
create policy "Members can view org agent daily presence"
  on public.agent_daily_presence for select
  using (org_id = public.user_org_id());

-- Inserts run from Edge (service role); browser clients do not write here.

create index if not exists idx_agent_daily_presence_org_day
  on public.agent_daily_presence (org_id, day desc);

create index if not exists idx_agent_daily_presence_agent_day
  on public.agent_daily_presence (agent_id, day desc);

comment on table public.agent_daily_presence is
  'UTC calendar-day presence for connector agents; populated by agent-daily-presence cron for fleet timeline UI.';

-- Daily at 03:30 UTC (after agent-nudge at 03:00). Requires pg_cron + pg_net and
-- app.settings.supabase_url + app.settings.service_role_key in Database settings.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('agent-daily-presence-daily');
    exception
      when others then
        null;
    end;

    perform cron.schedule(
      'agent-daily-presence-daily',
      '30 3 * * *',
      $job$
      select net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/agent-daily-presence',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $job$
    );
    raise notice 'agent-daily-presence-daily cron job scheduled (03:30 UTC)';
  else
    raise notice 'pg_cron not enabled — skipping agent-daily-presence schedule.';
  end if;
end
$$;
