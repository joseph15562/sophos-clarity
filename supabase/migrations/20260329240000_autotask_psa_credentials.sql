-- Datto Autotask PSA (REST) — credentials for ticket create from findings.
-- Auth: headers Username, Secret, ApiIntegrationCode per Autotask REST docs.
-- Zone URL: e.g. https://webservices3.autotask.net (REST path /atservicesrest/v1.0 appended in Edge if omitted).

create table if not exists public.autotask_psa_credentials (
  org_id uuid primary key references public.organisations(id) on delete cascade,
  api_zone_base_url text not null,
  username text not null,
  encrypted_secret text not null,
  encrypted_integration_code text not null,
  default_queue_id integer not null,
  default_priority integer not null,
  default_status integer not null,
  default_source integer not null,
  default_ticket_type integer not null,
  connected_at timestamptz not null default now()
);

alter table public.autotask_psa_credentials enable row level security;

drop policy if exists "Admins can manage Autotask PSA credentials" on public.autotask_psa_credentials;
create policy "Admins can manage Autotask PSA credentials"
  on public.autotask_psa_credentials for all
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
