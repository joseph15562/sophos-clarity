-- Portal viewers: customers invited by MSPs to view their client portal
create table if not exists public.portal_viewers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  name text,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  last_login_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked'))
);

-- Index for quick lookup by org
create index if not exists portal_viewers_org_id_idx on public.portal_viewers(org_id);
create unique index if not exists portal_viewers_org_email_idx on public.portal_viewers(org_id, email);

-- RLS
alter table public.portal_viewers enable row level security;

-- Org members can read/write their own org's viewers
create policy "org_members_manage_viewers" on public.portal_viewers
  for all using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

-- Portal viewers can read their own record
create policy "viewer_reads_own" on public.portal_viewers
  for select using (user_id = auth.uid());
