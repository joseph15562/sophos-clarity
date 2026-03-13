-- ============================================================
-- Audit Log for enterprise compliance (ISO 27001 / SOC 2)
-- ============================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null default '',
  resource_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists "Members can view audit log" on public.audit_log;
create policy "Members can view audit log"
  on public.audit_log for select
  using (org_id = public.user_org_id());

drop policy if exists "Members can insert audit entries" on public.audit_log;
create policy "Members can insert audit entries"
  on public.audit_log for insert
  with check (org_id = public.user_org_id());

create index if not exists idx_audit_log_org on public.audit_log(org_id);
create index if not exists idx_audit_log_created on public.audit_log(created_at desc);
create index if not exists idx_audit_log_action on public.audit_log(action);
