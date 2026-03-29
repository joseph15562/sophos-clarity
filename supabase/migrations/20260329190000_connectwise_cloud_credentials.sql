-- ConnectWise Cloud Services API credentials (G3.1) — encrypted at rest; Edge exchanges OAuth client-credentials token.
-- Auth: https://developers.cloudservices.connectwise.com/Guides/Authentication

create table if not exists public.connectwise_cloud_credentials (
  org_id uuid primary key references public.organisations(id) on delete cascade,
  encrypted_public_member_id text not null,
  encrypted_subscription_key text not null,
  scope text not null default 'Partner' check (scope in ('Partner', 'Distributor')),
  public_id_suffix text not null default '',
  connected_at timestamptz not null default now(),
  last_token_ok_at timestamptz,
  last_error text
);

alter table public.connectwise_cloud_credentials enable row level security;

drop policy if exists "Admins can manage ConnectWise cloud credentials" on public.connectwise_cloud_credentials;
create policy "Admins can manage ConnectWise cloud credentials"
  on public.connectwise_cloud_credentials for all
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  )
  with check (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );
