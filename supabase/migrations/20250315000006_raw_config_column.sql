-- Add raw_config JSONB column to agent_submissions
-- Stores the complete parsed firewall configuration (all entity types)
-- so the web app can display full config details per entity type.

alter table public.agent_submissions
  add column if not exists raw_config jsonb default null;

comment on column public.agent_submissions.raw_config is
  'Complete parsed firewall config — keyed by Sophos XML entity type (FirewallRule, NATRule, VPNIPSecConnection, etc.)';
