-- Sector / environment is scoped to the MSP "customer" (Sophos tenant or agent bucket), not per firewall.
-- Country/state remain per device on central_firewalls / agents.

alter table public.central_tenants
  add column if not exists compliance_environment text not null default '';

comment on column public.central_tenants.compliance_environment is
  'MSP sector (Education, Healthcare, …) for framework defaults; shared by all firewalls under this Central tenant';

create table if not exists public.agent_customer_compliance_environment (
  org_id uuid not null references public.organisations (id) on delete cascade,
  customer_bucket_key text not null,
  compliance_environment text not null default '',
  primary key (org_id, customer_bucket_key),
  constraint agent_customer_compliance_env_key_len check (
    char_length(customer_bucket_key) between 1 and 512
  )
);

comment on table public.agent_customer_compliance_environment is
  'MSP sector per agent-only customer bucket (assigned_customer_name / tenant_name grouping)';

create index if not exists idx_agent_customer_compliance_env_org
  on public.agent_customer_compliance_environment (org_id);

alter table public.agent_customer_compliance_environment enable row level security;

drop policy if exists "Members can view agent customer compliance environment"
  on public.agent_customer_compliance_environment;
create policy "Members can view agent customer compliance environment"
  on public.agent_customer_compliance_environment for select
  using (org_id = public.user_org_id());

drop policy if exists "Members can manage agent customer compliance environment"
  on public.agent_customer_compliance_environment;
create policy "Members can manage agent customer compliance environment"
  on public.agent_customer_compliance_environment for all
  using (org_id = public.user_org_id());

-- Agent RPC: jurisdiction only (environment uses agent_customer_compliance_environment).
drop function if exists public.update_agent_compliance_context(uuid, text, text, text);

create or replace function public.update_agent_compliance_context(
  p_agent_id uuid,
  p_country text,
  p_state text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agents
  set
    compliance_country = coalesce(nullif(trim(p_country), ''), ''),
    compliance_state = coalesce(nullif(trim(p_state), ''), '')
  where id = p_agent_id
    and org_id = public.user_org_id();
end;
$$;

revoke all on function public.update_agent_compliance_context(uuid, text, text) from public;
grant execute on function public.update_agent_compliance_context(uuid, text, text) to authenticated;
