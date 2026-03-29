-- G3.2 — Org-scoped service API keys (hash stored; prefix for display). Edge validation to be wired separately.
create table if not exists public.org_service_api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  label text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default array['api:read']::text[],
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index if not exists idx_org_service_api_keys_org on public.org_service_api_keys(org_id);

alter table public.org_service_api_keys enable row level security;

drop policy if exists "Org admins can view service keys" on public.org_service_api_keys;
create policy "Org admins can view service keys"
  on public.org_service_api_keys for select
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

drop policy if exists "Org admins can insert service keys" on public.org_service_api_keys;
create policy "Org admins can insert service keys"
  on public.org_service_api_keys for insert
  with check (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

drop policy if exists "Org admins can update service keys" on public.org_service_api_keys;
create policy "Org admins can update service keys"
  on public.org_service_api_keys for update
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
        and user_id = auth.uid()
        and role = 'admin'
    )
  );
