-- FireComply resolved customer name ↔ ConnectWise Manage company ID (per org).
-- customer_key must match resolveCustomerName(...) / CustomerManagement grouping (see docs).

create table if not exists public.psa_customer_company_map (
  org_id uuid not null references public.organisations(id) on delete cascade,
  provider text not null default 'connectwise_manage',
  customer_key text not null,
  company_id integer not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, provider, customer_key),
  constraint psa_customer_company_map_customer_key_len check (char_length(customer_key) between 1 and 512)
);

create index if not exists idx_psa_customer_company_map_org on public.psa_customer_company_map(org_id);

alter table public.psa_customer_company_map enable row level security;

drop policy if exists "Admins can manage PSA customer company map" on public.psa_customer_company_map;
create policy "Admins can manage PSA customer company map"
  on public.psa_customer_company_map for all
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
