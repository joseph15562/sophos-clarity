-- ============================================================
-- Feature tables: finding_snapshots, remediation_status,
-- shared_reports, alert_rules
-- ============================================================

-- 1. Finding snapshots for history and regression detection
create table if not exists public.finding_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  hostname text not null,
  titles text[] not null default '{}',
  score integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.finding_snapshots enable row level security;

create policy "Org members can view snapshots"
  on public.finding_snapshots for select
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create policy "Org members can insert snapshots"
  on public.finding_snapshots for insert
  with check (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create index idx_finding_snapshots_org_host on public.finding_snapshots(org_id, hostname, created_at desc);

-- 2. Remediation status tracking
create table if not exists public.remediation_status (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  playbook_id text not null,
  customer_hash text not null,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz not null default now(),
  constraint uq_remediation_playbook unique (org_id, customer_hash, playbook_id)
);

alter table public.remediation_status enable row level security;

create policy "Org members can view remediation"
  on public.remediation_status for select
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create policy "Org members can insert remediation"
  on public.remediation_status for insert
  with check (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create policy "Org members can delete remediation"
  on public.remediation_status for delete
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create index idx_remediation_status_org_hash on public.remediation_status(org_id, customer_hash);

-- 3. Shared reports (time-limited public links)
create table if not exists public.shared_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  share_token text not null unique,
  markdown text not null,
  customer_name text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.shared_reports enable row level security;

create policy "Org members can manage shared reports"
  on public.shared_reports for all
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

-- Public read access via share_token is handled by Edge Function (no RLS needed for public reads)

create index idx_shared_reports_token on public.shared_reports(share_token);
create index idx_shared_reports_org on public.shared_reports(org_id);

-- 4. Alert rules for email/webhook notifications
create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  event_type text not null check (event_type in (
    'licence_expiry_warning', 'score_drop', 'new_critical_finding',
    'central_disconnected', 'agent_drift_detected', 'agent_offline'
  )),
  channel text not null check (channel in ('email', 'webhook')),
  config jsonb not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.alert_rules enable row level security;

create policy "Org members can view alert rules"
  on public.alert_rules for select
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create policy "Admins can manage alert rules"
  on public.alert_rules for all
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() and role = 'admin' limit 1));

create index idx_alert_rules_org on public.alert_rules(org_id);
