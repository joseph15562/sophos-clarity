-- ============================================================
-- Scheduled email reports for automated client compliance delivery
-- ============================================================

create table if not exists public.scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  schedule text not null check (schedule in ('weekly', 'monthly', 'quarterly')),
  recipients text[] not null default '{}',
  report_type text not null default 'one-pager'
    check (report_type in ('one-pager', 'executive', 'compliance')),
  customer_name text,
  include_sections jsonb not null default '{
    "scoreOverview": true,
    "findingsSummary": true,
    "complianceStatus": true,
    "remediationPlan": true
  }'::jsonb,
  enabled boolean not null default true,
  last_sent_at timestamptz,
  next_due_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.scheduled_reports enable row level security;

create policy "Org members can view scheduled reports"
  on public.scheduled_reports for select
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create policy "Org members can insert scheduled reports"
  on public.scheduled_reports for insert
  with check (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create policy "Org members can update scheduled reports"
  on public.scheduled_reports for update
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create policy "Org members can delete scheduled reports"
  on public.scheduled_reports for delete
  using (org_id = (select org_id from public.org_members where user_id = auth.uid() limit 1));

create index idx_scheduled_reports_org on public.scheduled_reports(org_id);
create index idx_scheduled_reports_due on public.scheduled_reports(enabled, next_due_at)
  where enabled = true;
