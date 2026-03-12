-- ============================================================
-- Saved Reports table for Sophos FireComply
-- Stores AI-generated reports and/or pre-AI deterministic
-- analysis packages, scoped to MSP org via RLS.
-- ============================================================

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  customer_name text not null,
  environment text not null default '',
  report_type text not null default 'full',
  reports jsonb not null default '[]'::jsonb,
  analysis_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.saved_reports enable row level security;

drop policy if exists "Members can view org saved reports" on public.saved_reports;
create policy "Members can view org saved reports"
  on public.saved_reports for select
  using (org_id = public.user_org_id());

drop policy if exists "Members can create saved reports" on public.saved_reports;
create policy "Members can create saved reports"
  on public.saved_reports for insert
  with check (org_id = public.user_org_id() and created_by = auth.uid());

drop policy if exists "Members can update org saved reports" on public.saved_reports;
create policy "Members can update org saved reports"
  on public.saved_reports for update
  using (org_id = public.user_org_id());

drop policy if exists "Members can delete org saved reports" on public.saved_reports;
create policy "Members can delete org saved reports"
  on public.saved_reports for delete
  using (org_id = public.user_org_id());

create index if not exists idx_saved_reports_org_id on public.saved_reports(org_id);
create index if not exists idx_saved_reports_customer on public.saved_reports(customer_name);
create index if not exists idx_saved_reports_created_at on public.saved_reports(created_at desc);
