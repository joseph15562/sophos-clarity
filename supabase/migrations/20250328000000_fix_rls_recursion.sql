-- Fix infinite recursion in RLS policies on se_team_members.
-- The se_team_members SELECT policy references itself, causing recursion
-- when other tables' policies (se_health_checks, config_upload_requests)
-- check team membership via se_team_members.

-- Create a SECURITY DEFINER function that bypasses RLS to get team IDs
create or replace function public.get_my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select stm.team_id
  from public.se_team_members stm
  join public.se_profiles sp on sp.id = stm.se_profile_id
  where sp.user_id = auth.uid();
$$;

-- Create a helper to check if the user is admin of a team
create or replace function public.is_team_admin(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.se_team_members stm
    join public.se_profiles sp on sp.id = stm.se_profile_id
    where sp.user_id = auth.uid()
      and stm.team_id = p_team_id
      and stm.role = 'admin'
  );
$$;

-- Fix se_team_members SELECT policy (was self-referencing)
drop policy if exists "se_team_members_select_team" on public.se_team_members;
create policy "se_team_members_select_team"
  on public.se_team_members for select
  using (
    team_id in (select public.get_my_team_ids())
  );

-- Fix se_team_members DELETE policy (was self-referencing for admin check)
drop policy if exists "se_team_members_delete_own_or_admin" on public.se_team_members;
create policy "se_team_members_delete_own_or_admin"
  on public.se_team_members for delete
  using (
    se_profile_id in (select id from public.se_profiles where user_id = auth.uid())
    or public.is_team_admin(team_id)
  );

-- Fix se_health_checks INSERT policy
drop policy if exists "se_health_checks_insert_own" on public.se_health_checks;
create policy "se_health_checks_insert_own"
  on public.se_health_checks for insert
  with check (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
    and (
      team_id is null
      or team_id in (select public.get_my_team_ids())
    )
  );

-- Fix se_health_checks SELECT policy
drop policy if exists "se_health_checks_select_own_or_team" on public.se_health_checks;
create policy "se_health_checks_select_own_or_team"
  on public.se_health_checks for select
  using (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
    or (
      team_id is not null
      and team_id in (select public.get_my_team_ids())
    )
  );

-- Fix se_teams SELECT policy
drop policy if exists "se_teams_select_member" on public.se_teams;
create policy "se_teams_select_member"
  on public.se_teams for select
  using (
    id in (select public.get_my_team_ids())
  );

-- Fix se_team_invites SELECT policy
drop policy if exists "se_team_invites_select_admin" on public.se_team_invites;
create policy "se_team_invites_select_admin"
  on public.se_team_invites for select
  using (public.is_team_admin(team_id));

-- Fix se_team_invites INSERT policy
drop policy if exists "se_team_invites_insert_admin" on public.se_team_invites;
create policy "se_team_invites_insert_admin"
  on public.se_team_invites for insert
  with check (public.is_team_admin(team_id));

-- Fix se_team_invites DELETE policy
drop policy if exists "se_team_invites_delete_admin" on public.se_team_invites;
create policy "se_team_invites_delete_admin"
  on public.se_team_invites for delete
  using (public.is_team_admin(team_id));
