-- Replace invite_code with email-based team invites.

-- New invites table
create table if not exists public.se_team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.se_teams(id) on delete cascade,
  invited_by  uuid not null references public.se_profiles(id),
  email       text not null,
  token       text not null unique default gen_random_uuid()::text,
  status      text not null default 'pending'
                check (status in ('pending', 'accepted', 'expired')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_se_team_invites_token
  on public.se_team_invites(token);

create index if not exists idx_se_team_invites_team
  on public.se_team_invites(team_id);

alter table public.se_team_invites enable row level security;

create policy "se_team_invites_select_admin"
  on public.se_team_invites for select
  using (
    team_id in (
      select team_id from public.se_team_members
      where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
        and role = 'admin'
    )
  );

create policy "se_team_invites_insert_admin"
  on public.se_team_invites for insert
  with check (
    team_id in (
      select team_id from public.se_team_members
      where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
        and role = 'admin'
    )
  );

create policy "se_team_invites_delete_admin"
  on public.se_team_invites for delete
  using (
    team_id in (
      select team_id from public.se_team_members
      where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
        and role = 'admin'
    )
  );

-- Drop invite_code from se_teams (no longer needed)
alter table public.se_teams drop column if exists invite_code;
