-- ============================================================
-- MFA and Passkey Authentication
-- ============================================================

-- 1. Passkey credentials (WebAuthn)
create table if not exists public.passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_type text not null default 'platform' check (device_type in ('platform', 'cross-platform')),
  transports text[] not null default '{}',
  name text not null default 'Passkey',
  created_at timestamptz not null default now()
);

alter table public.passkey_credentials enable row level security;

drop policy if exists "Users can view own passkeys" on public.passkey_credentials;
create policy "Users can view own passkeys"
  on public.passkey_credentials for select
  using (user_id = auth.uid());

drop policy if exists "Users can create own passkeys" on public.passkey_credentials;
create policy "Users can create own passkeys"
  on public.passkey_credentials for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own passkeys" on public.passkey_credentials;
create policy "Users can delete own passkeys"
  on public.passkey_credentials for delete
  using (user_id = auth.uid());

drop policy if exists "Users can update own passkeys" on public.passkey_credentials;
create policy "Users can update own passkeys"
  on public.passkey_credentials for update
  using (user_id = auth.uid());

-- 2. MFA enforcement per org
alter table public.organisations
  add column if not exists mfa_required boolean not null default false;

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_passkey_credentials_user on public.passkey_credentials(user_id);
create index if not exists idx_passkey_credentials_cred_id on public.passkey_credentials(credential_id);
