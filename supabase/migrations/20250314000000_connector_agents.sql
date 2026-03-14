-- ============================================================
-- FireComply Connector Agent tables
-- ============================================================

-- 1. Agents (one per connector instance, scoped to org)
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  api_key_hash text not null,
  api_key_prefix text not null,
  tenant_id text,
  tenant_name text,
  firewall_host text not null,
  firewall_port integer not null default 4444,
  customer_name text not null default 'Unnamed',
  environment text not null default 'Unknown',
  schedule_cron text not null default '0 2 * * *',
  firmware_version text,
  firmware_version_override text,
  serial_number text,
  hardware_model text,
  last_seen_at timestamptz,
  last_score integer,
  last_grade text,
  status text not null default 'registered' check (status in ('registered', 'online', 'offline', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.agents enable row level security;

-- 2. Agent submissions (assessment results from agents)
create table if not exists public.agent_submissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  customer_name text not null default 'Unnamed',
  overall_score integer not null default 0,
  overall_grade text not null default 'F',
  firewalls jsonb not null default '[]'::jsonb,
  findings_summary jsonb not null default '[]'::jsonb,
  finding_titles text[] not null default '{}',
  threat_status jsonb,
  drift jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_submissions enable row level security;

-- 3. Add submission retention setting to organisations
alter table public.organisations
  add column if not exists submission_retention_days integer not null default 90;

-- ============================================================
-- RLS Policies — agents
-- ============================================================

drop policy if exists "Members can view org agents" on public.agents;
create policy "Members can view org agents"
  on public.agents for select
  using (org_id = public.user_org_id());

drop policy if exists "Admins can create agents" on public.agents;
create policy "Admins can create agents"
  on public.agents for insert
  with check (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

drop policy if exists "Admins can update agents" on public.agents;
create policy "Admins can update agents"
  on public.agents for update
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

drop policy if exists "Admins can delete agents" on public.agents;
create policy "Admins can delete agents"
  on public.agents for delete
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Allow Edge Functions (service role) to update agents via API key auth.
-- The service role bypasses RLS, so agent heartbeat/submit endpoints
-- authenticate via X-API-Key and use the service role client.

-- ============================================================
-- RLS Policies — agent_submissions
-- ============================================================

drop policy if exists "Members can view org submissions" on public.agent_submissions;
create policy "Members can view org submissions"
  on public.agent_submissions for select
  using (org_id = public.user_org_id());

drop policy if exists "Members can delete org submissions" on public.agent_submissions;
create policy "Members can delete org submissions"
  on public.agent_submissions for delete
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Submissions are inserted by the Edge Function (service role), not by
-- browser clients directly, so no insert policy is needed for auth.users.

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_agents_org_id on public.agents(org_id);
create index if not exists idx_agents_status on public.agents(status);
create index if not exists idx_agents_api_key_prefix on public.agents(api_key_prefix);
create index if not exists idx_agent_submissions_agent_id on public.agent_submissions(agent_id);
create index if not exists idx_agent_submissions_org_id on public.agent_submissions(org_id);
create index if not exists idx_agent_submissions_created_at on public.agent_submissions(created_at desc);

-- ============================================================
-- Submission retention cleanup function
-- Called by pg_cron or a scheduled Edge Function to purge old submissions.
-- ============================================================
create or replace function public.cleanup_expired_submissions()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  with expired as (
    delete from public.agent_submissions s
    using public.organisations o
    where s.org_id = o.id
      and s.created_at < now() - (o.submission_retention_days || ' days')::interval
    returning s.id
  )
  select count(*) into deleted_count from expired;

  return deleted_count;
end;
$$;
