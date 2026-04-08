-- Optional MSP map pins for Fleet Command world map (WGS84). Not overwritten by Central sync.
alter table public.central_firewalls
  add column if not exists map_latitude double precision,
  add column if not exists map_longitude double precision;

comment on column public.central_firewalls.map_latitude is
  'Optional MSP-set latitude (-90..90) for fleet map; overrides country centroid when set with map_longitude.';
comment on column public.central_firewalls.map_longitude is
  'Optional MSP-set longitude (-180..180) for fleet map; overrides country centroid when set with map_latitude.';

alter table public.agents
  add column if not exists map_latitude double precision,
  add column if not exists map_longitude double precision;

comment on column public.agents.map_latitude is
  'Optional MSP-set latitude (-90..90) for fleet map (agent-only firewalls).';
comment on column public.agents.map_longitude is
  'Optional MSP-set longitude (-180..180) for fleet map (agent-only firewalls).';

drop function if exists public.update_agent_compliance_context(uuid, text, text);

create or replace function public.update_agent_compliance_context(
  p_agent_id uuid,
  p_country text,
  p_state text,
  p_map_latitude double precision,
  p_map_longitude double precision
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
    map_latitude = p_map_latitude,
    map_longitude = p_map_longitude
  where id = p_agent_id
    and org_id = public.user_org_id();
end;
$$;

revoke all on function public.update_agent_compliance_context(uuid, text, text, double precision, double precision) from public;
grant execute on function public.update_agent_compliance_context(uuid, text, text, double precision, double precision) to authenticated;
