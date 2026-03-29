-- ConnectWise Manage REST (tickets) — separate from Partner Cloud Services (connectwise_cloud_credentials).
-- Member auth: Basic base64("{integratorCompanyId}+{publicKey}:{privateKey}") per Manage REST docs.
-- Spike reference: https://developer.connectwise.com/products/manage/rest

create table if not exists public.connectwise_manage_credentials (
  org_id uuid primary key references public.organisations(id) on delete cascade,
  api_base_url text not null,
  integrator_company_id text not null,
  encrypted_public_key text not null,
  encrypted_private_key text not null,
  default_board_id integer not null,
  default_status_id integer not null default 1,
  connected_at timestamptz not null default now()
);

alter table public.connectwise_manage_credentials enable row level security;

drop policy if exists "Admins can manage ConnectWise Manage credentials" on public.connectwise_manage_credentials;
create policy "Admins can manage ConnectWise Manage credentials"
  on public.connectwise_manage_credentials for all
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

create table if not exists public.psa_ticket_idempotency (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  provider text not null default 'connectwise_manage',
  idempotency_key text not null,
  external_ticket_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, provider, idempotency_key)
);

create index if not exists idx_psa_ticket_idempotency_org on public.psa_ticket_idempotency(org_id);

alter table public.psa_ticket_idempotency enable row level security;

drop policy if exists "Admins can view PSA idempotency" on public.psa_ticket_idempotency;
create policy "Admins can view PSA idempotency"
  on public.psa_ticket_idempotency for select
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );
