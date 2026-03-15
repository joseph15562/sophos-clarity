-- ============================================================
-- E1: Score History for Trend/Historical Scoring Dashboard
-- ============================================================

create table if not exists public.score_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  hostname text not null,
  customer_name text not null default '',
  overall_score integer not null,
  overall_grade text not null default 'F',
  category_scores jsonb not null default '[]'::jsonb,
  findings_count integer not null default 0,
  assessed_at timestamptz not null default now()
);

alter table public.score_history enable row level security;

create policy "Members can view score history"
  on public.score_history for select
  using (org_id = public.user_org_id());

create policy "Members can insert score history"
  on public.score_history for insert
  with check (org_id = public.user_org_id());

create index if not exists idx_score_history_org on public.score_history(org_id);
create index if not exists idx_score_history_hostname on public.score_history(org_id, hostname);
create index if not exists idx_score_history_assessed on public.score_history(assessed_at desc);

-- ============================================================
-- E3: Multi-user RBAC — extend org_members roles
-- ============================================================

alter table public.org_members
  drop constraint if exists org_members_role_check;

alter table public.org_members
  add constraint org_members_role_check
  check (role in ('admin', 'member', 'engineer', 'viewer'));

-- Add role to org_invites so invited users get the correct role
alter table public.org_invites
  add column if not exists role text not null default 'member'
  check (role in ('admin', 'member', 'engineer', 'viewer'));

-- Update handle_new_user to use invited role
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  invite_record record;
begin
  select * into invite_record
  from public.org_invites
  where email = new.email
  limit 1;

  if invite_record is not null then
    insert into public.org_members (org_id, user_id, role)
    values (invite_record.org_id, new.id, coalesce(invite_record.role, 'member'));

    delete from public.org_invites where id = invite_record.id;
  end if;

  return new;
end;
$$;
