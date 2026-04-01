-- MSP compliance context per firewall (Fleet → Assess / Customer directory).
-- Stored on Central cache rows and agents separately (agents.environment stays connector metadata).

alter table public.central_firewalls
  add column if not exists compliance_country text not null default '',
  add column if not exists compliance_state text not null default '',
  add column if not exists compliance_environment text not null default '';

alter table public.agents
  add column if not exists compliance_country text not null default '',
  add column if not exists compliance_state text not null default '',
  add column if not exists compliance_environment text not null default '';

comment on column public.central_firewalls.compliance_country is 'MSP-set jurisdiction for reports/compliance defaults';
comment on column public.central_firewalls.compliance_state is 'US state when compliance_country is United States';
comment on column public.central_firewalls.compliance_environment is 'MSP sector (Education, Healthcare, …) for framework defaults';

comment on column public.agents.compliance_country is 'MSP-set jurisdiction for reports/compliance defaults';
comment on column public.agents.compliance_state is 'US state when compliance_country is United States';
comment on column public.agents.compliance_environment is 'MSP sector for framework defaults; distinct from agents.environment';

-- Org members may set compliance context on agents (RLS on agents UPDATE is admin-only).
create or replace function public.update_agent_compliance_context(
  p_agent_id uuid,
  p_country text,
  p_state text,
  p_environment text
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
    compliance_state = coalesce(nullif(trim(p_state), ''), ''),
    compliance_environment = coalesce(nullif(trim(p_environment), ''), '')
  where id = p_agent_id
    and org_id = public.user_org_id();
end;
$$;

revoke all on function public.update_agent_compliance_context(uuid, text, text, text) from public;
grant execute on function public.update_agent_compliance_context(uuid, text, text, text) to authenticated;
