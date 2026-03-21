-- SE Auth: separate profile + health-check history tables for Sophos Sales Engineers.
-- Only @sophos.com emails may register. The MSP auth (org_members) is untouched.

-- ── se_profiles ──────────────────────────────────────────────────────────────

create table if not exists public.se_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade unique,
  email       text not null,
  display_name text,
  created_at  timestamptz not null default now(),

  constraint se_profiles_sophos_domain check (email ~* '@sophos\.com$')
);

alter table public.se_profiles enable row level security;

create policy "se_profiles_select_own"
  on public.se_profiles for select
  using (user_id = auth.uid());

create policy "se_profiles_insert_own"
  on public.se_profiles for insert
  with check (user_id = auth.uid());

create policy "se_profiles_update_own"
  on public.se_profiles for update
  using (user_id = auth.uid());

create policy "se_profiles_delete_own"
  on public.se_profiles for delete
  using (user_id = auth.uid());

-- Trigger: double-check auth.users.email matches @sophos.com before insert
create or replace function public.verify_se_sophos_domain()
returns trigger
language plpgsql
security definer
as $$
declare
  user_email text;
begin
  select email into user_email from auth.users where id = new.user_id;
  if user_email is null then
    raise exception 'User not found in auth.users';
  end if;
  if user_email !~* '@sophos\.com$' then
    raise exception 'Only @sophos.com email addresses can create an SE profile';
  end if;
  -- Ensure stored email matches auth email
  new.email := user_email;
  return new;
end;
$$;

create trigger before_insert_se_profiles
  before insert on public.se_profiles
  for each row execute function public.verify_se_sophos_domain();

-- ── se_health_checks ─────────────────────────────────────────────────────────

create table if not exists public.se_health_checks (
  id              uuid primary key default gen_random_uuid(),
  se_user_id      uuid not null references public.se_profiles(id) on delete cascade,
  customer_name   text,
  overall_score   int,
  overall_grade   text,
  findings_count  int,
  firewall_count  int,
  checked_at      timestamptz not null default now(),
  summary_json    jsonb
);

alter table public.se_health_checks enable row level security;

create policy "se_health_checks_select_own"
  on public.se_health_checks for select
  using (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
  );

create policy "se_health_checks_insert_own"
  on public.se_health_checks for insert
  with check (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
  );

-- Index for quick lookups
create index if not exists idx_se_health_checks_user
  on public.se_health_checks(se_user_id, checked_at desc);
