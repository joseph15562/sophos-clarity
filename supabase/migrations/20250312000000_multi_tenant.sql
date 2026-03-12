-- ============================================================
-- Multi-Tenant MSP schema for Sophos FireComply
-- ============================================================

-- 1. Organisations (one per MSP)
create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.organisations enable row level security;

-- 2. Organisation members (links auth.users to an org)
create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (org_id, user_id)
);

alter table public.org_members enable row level security;

-- 3. Assessments (cloud-stored snapshots, scoped to org)
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  customer_name text not null default 'Unnamed',
  environment text not null default 'Unknown',
  firewalls jsonb not null default '[]'::jsonb,
  overall_score integer not null default 0,
  overall_grade text not null default 'F',
  created_at timestamptz not null default now()
);

alter table public.assessments enable row level security;

-- 4. Pending invites (admin invites by email before user signs up)
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

alter table public.org_invites enable row level security;

-- ============================================================
-- Helper: get the current user's org_id
-- ============================================================
create or replace function public.user_org_id()
returns uuid
language sql
stable
security definer
as $$
  select org_id from public.org_members where user_id = auth.uid() limit 1;
$$;

-- ============================================================
-- RLS Policies (drop + recreate for idempotency)
-- ============================================================

drop policy if exists "Members can view their org" on public.organisations;
create policy "Members can view their org"
  on public.organisations for select
  using (id = public.user_org_id());

drop policy if exists "Authenticated users can create orgs" on public.organisations;
create policy "Authenticated users can create orgs"
  on public.organisations for insert
  with check (auth.uid() is not null);

drop policy if exists "Members can view org members" on public.org_members;
create policy "Members can view org members"
  on public.org_members for select
  using (org_id = public.user_org_id());

drop policy if exists "Users can join orgs" on public.org_members;
create policy "Users can join orgs"
  on public.org_members for insert
  with check (
    user_id = auth.uid()
    or (
      org_id = public.user_org_id()
      and exists (
        select 1 from public.org_members
        where org_id = public.user_org_id()
        and user_id = auth.uid()
        and role = 'admin'
      )
    )
  );

drop policy if exists "Admins can remove members" on public.org_members;
create policy "Admins can remove members"
  on public.org_members for delete
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

drop policy if exists "Members can view org assessments" on public.assessments;
create policy "Members can view org assessments"
  on public.assessments for select
  using (org_id = public.user_org_id());

drop policy if exists "Members can create assessments" on public.assessments;
create policy "Members can create assessments"
  on public.assessments for insert
  with check (org_id = public.user_org_id() and created_by = auth.uid());

drop policy if exists "Members can update org assessments" on public.assessments;
create policy "Members can update org assessments"
  on public.assessments for update
  using (org_id = public.user_org_id());

drop policy if exists "Members can delete org assessments" on public.assessments;
create policy "Members can delete org assessments"
  on public.assessments for delete
  using (org_id = public.user_org_id());

drop policy if exists "Admins can view org invites" on public.org_invites;
create policy "Admins can view org invites"
  on public.org_invites for select
  using (org_id = public.user_org_id());

drop policy if exists "Admins can create invites" on public.org_invites;
create policy "Admins can create invites"
  on public.org_invites for insert
  with check (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

drop policy if exists "Admins can delete invites" on public.org_invites;
create policy "Admins can delete invites"
  on public.org_invites for delete
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

drop policy if exists "Invited users can see their invites" on public.org_invites;
create policy "Invited users can see their invites"
  on public.org_invites for select
  using (email = (select email from auth.users where id = auth.uid()));

-- ============================================================
-- Auto-join: when a user signs up, check for pending invites
-- ============================================================
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
    values (invite_record.org_id, new.id, 'member');

    delete from public.org_invites where id = invite_record.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- Indexes for performance
-- ============================================================
create index if not exists idx_org_members_user_id on public.org_members(user_id);
create index if not exists idx_org_members_org_id on public.org_members(org_id);
create index if not exists idx_assessments_org_id on public.assessments(org_id);
create index if not exists idx_assessments_created_at on public.assessments(created_at desc);
create index if not exists idx_org_invites_email on public.org_invites(email);
