-- Optional MSP-chosen customer bucket: groups agents together and overrides Central tenant for assessment customer_name when set.
alter table public.agents add column if not exists assigned_customer_name text;

comment on column public.agents.assigned_customer_name is
  'When set, groups this agent with others sharing the same label (Management, fleet, Customer directory) and sets assessment/submission customer_name to this value, overriding Sophos Central tenant for that purpose. Site/location remains in customer_name.';
