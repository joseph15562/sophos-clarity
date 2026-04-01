-- Default country at customer scope (Sophos tenant or agent bucket); firewalls can override per device.

alter table public.central_tenants
  add column if not exists compliance_country text not null default '';

comment on column public.central_tenants.compliance_country is
  'MSP default jurisdiction for this Central tenant; firewalls may override compliance_country on central_firewalls';

alter table public.agent_customer_compliance_environment
  add column if not exists compliance_country text not null default '';

comment on column public.agent_customer_compliance_environment.compliance_country is
  'MSP default jurisdiction for this agent customer bucket; agents may override on agents.compliance_country';
