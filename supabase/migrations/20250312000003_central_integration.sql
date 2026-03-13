-- ============================================================
-- Sophos Central API Integration tables
-- ============================================================

-- 1. Encrypted API credentials (one per org)
create table if not exists public.central_credentials (
  org_id uuid primary key references public.organisations(id) on delete cascade,
  encrypted_client_id text not null,
  encrypted_client_secret text not null,
  partner_id text not null default '',
  partner_type text not null default 'partner' check (partner_type in ('partner', 'organization', 'tenant')),
  api_hosts jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);

alter table public.central_credentials enable row level security;

drop policy if exists "Members can view Central credentials" on public.central_credentials;
create policy "Members can view Central credentials"
  on public.central_credentials for select
  using (org_id = public.user_org_id());

drop policy if exists "Admins can manage Central credentials" on public.central_credentials;
create policy "Admins can manage Central credentials"
  on public.central_credentials for all
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

-- 2. Cached tenant list from Sophos Central
create table if not exists public.central_tenants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  central_tenant_id text not null,
  name text not null default '',
  data_region text not null default '',
  api_host text not null default '',
  billing_type text not null default '',
  synced_at timestamptz not null default now(),
  unique (org_id, central_tenant_id)
);

alter table public.central_tenants enable row level security;

drop policy if exists "Members can view Central tenants" on public.central_tenants;
create policy "Members can view Central tenants"
  on public.central_tenants for select
  using (org_id = public.user_org_id());

drop policy if exists "Service can manage Central tenants" on public.central_tenants;
create policy "Service can manage Central tenants"
  on public.central_tenants for all
  using (org_id = public.user_org_id());

-- 3. Cached firewall details from Sophos Central
create table if not exists public.central_firewalls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  central_tenant_id text not null,
  firewall_id text not null,
  serial_number text not null default '',
  hostname text not null default '',
  name text not null default '',
  firmware_version text not null default '',
  model text not null default '',
  status_json jsonb not null default '{}'::jsonb,
  cluster_json jsonb,
  group_json jsonb,
  external_ips jsonb not null default '[]'::jsonb,
  geo_location jsonb,
  synced_at timestamptz not null default now(),
  unique (org_id, firewall_id)
);

alter table public.central_firewalls enable row level security;

drop policy if exists "Members can view Central firewalls" on public.central_firewalls;
create policy "Members can view Central firewalls"
  on public.central_firewalls for select
  using (org_id = public.user_org_id());

drop policy if exists "Service can manage Central firewalls" on public.central_firewalls;
create policy "Service can manage Central firewalls"
  on public.central_firewalls for all
  using (org_id = public.user_org_id());

-- 4. Config-to-firewall persistent links
create table if not exists public.firewall_config_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  config_hostname text not null default '',
  config_hash text not null default '',
  central_firewall_id text not null,
  central_tenant_id text not null,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  unique (org_id, config_hash)
);

alter table public.firewall_config_links enable row level security;

drop policy if exists "Members can view firewall links" on public.firewall_config_links;
create policy "Members can view firewall links"
  on public.firewall_config_links for select
  using (org_id = public.user_org_id());

drop policy if exists "Members can manage firewall links" on public.firewall_config_links;
create policy "Members can manage firewall links"
  on public.firewall_config_links for all
  using (org_id = public.user_org_id());

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_central_tenants_org on public.central_tenants(org_id);
create index if not exists idx_central_tenants_tenant on public.central_tenants(central_tenant_id);
create index if not exists idx_central_firewalls_org on public.central_firewalls(org_id);
create index if not exists idx_central_firewalls_tenant on public.central_firewalls(central_tenant_id);
create index if not exists idx_central_firewalls_serial on public.central_firewalls(serial_number);
create index if not exists idx_central_firewalls_hostname on public.central_firewalls(hostname);
create index if not exists idx_firewall_config_links_org on public.firewall_config_links(org_id);
