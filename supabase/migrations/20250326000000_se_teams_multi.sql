-- Multi-team SE scoping: teams, membership, and team_id on health checks + config uploads.

-- ── Create tables first (no RLS yet — policies reference both tables) ────────

create table if not exists public.se_teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.se_profiles(id) on delete cascade,
  invite_code text not null unique default substr(gen_random_uuid()::text, 1, 8),
  created_at  timestamptz not null default now()
);

create table if not exists public.se_team_members (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.se_teams(id) on delete cascade,
  se_profile_id uuid not null references public.se_profiles(id) on delete cascade,
  role          text not null default 'member' check (role in ('admin', 'member')),
  is_primary    boolean not null default false,
  joined_at     timestamptz not null default now(),
  unique(team_id, se_profile_id)
);

create index if not exists idx_se_team_members_profile
  on public.se_team_members(se_profile_id);

create index if not exists idx_se_team_members_team
  on public.se_team_members(team_id);

-- ── Enable RLS ───────────────────────────────────────────────────────────────

alter table public.se_teams enable row level security;
alter table public.se_team_members enable row level security;

-- ── se_teams policies ────────────────────────────────────────────────────────

create policy "se_teams_select_member"
  on public.se_teams for select
  using (
    id in (
      select team_id from public.se_team_members
      where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
    )
  );

create policy "se_teams_insert_se"
  on public.se_teams for insert
  with check (
    created_by in (select id from public.se_profiles where user_id = auth.uid())
  );

create policy "se_teams_update_admin"
  on public.se_teams for update
  using (
    id in (
      select team_id from public.se_team_members
      where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
        and role = 'admin'
    )
  );

create policy "se_teams_delete_admin"
  on public.se_teams for delete
  using (
    id in (
      select team_id from public.se_team_members
      where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
        and role = 'admin'
    )
  );

-- ── se_team_members policies ─────────────────────────────────────────────────

create policy "se_team_members_select_team"
  on public.se_team_members for select
  using (
    team_id in (
      select stm.team_id from public.se_team_members stm
      where stm.se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
    )
  );

create policy "se_team_members_insert_self"
  on public.se_team_members for insert
  with check (
    se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
  );

create policy "se_team_members_update_own"
  on public.se_team_members for update
  using (
    se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
  );

create policy "se_team_members_delete_own_or_admin"
  on public.se_team_members for delete
  using (
    se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
    or team_id in (
      select stm.team_id from public.se_team_members stm
      where stm.se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
        and stm.role = 'admin'
    )
  );

-- ── Add team_id to se_health_checks ──────────────────────────────────────────

alter table public.se_health_checks
  add column if not exists team_id uuid references public.se_teams(id) on delete set null;

create index if not exists idx_se_health_checks_team
  on public.se_health_checks(team_id)
  where team_id is not null;

drop policy if exists "se_health_checks_select_own" on public.se_health_checks;
create policy "se_health_checks_select_own_or_team"
  on public.se_health_checks for select
  using (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
    or (
      team_id is not null
      and team_id in (
        select team_id from public.se_team_members
        where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
      )
    )
  );

drop policy if exists "se_health_checks_insert_own" on public.se_health_checks;
create policy "se_health_checks_insert_own"
  on public.se_health_checks for insert
  with check (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
    and (
      team_id is null
      or team_id in (
        select team_id from public.se_team_members
        where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
      )
    )
  );

-- ── Add team_id to config_upload_requests ────────────────────────────────────

alter table public.config_upload_requests
  add column if not exists team_id uuid references public.se_teams(id) on delete set null;

create index if not exists idx_config_upload_team
  on public.config_upload_requests(team_id)
  where team_id is not null;

drop policy if exists "se_select_own" on public.config_upload_requests;
create policy "se_select_own_or_team"
  on public.config_upload_requests for select
  using (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
    or (
      team_id is not null
      and team_id in (
        select team_id from public.se_team_members
        where se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
      )
    )
  );
