-- ============================================================
-- Make portal_config tenant-scoped for MSP customer portals
-- ============================================================

-- Add tenant_name column (nullable — null means org-wide default/template)
alter table public.portal_config
  add column if not exists tenant_name text;

-- Drop the old one-config-per-org constraint so we can have one per tenant
alter table public.portal_config
  drop constraint if exists portal_config_org_id_key;

-- Ensure at most one config per (org, tenant) combination
-- null tenant_name = org-wide default, specific tenant_name = tenant portal
alter table public.portal_config
  add constraint portal_config_org_tenant_unique unique (org_id, tenant_name);

comment on column public.portal_config.tenant_name is
  'Sophos Central tenant name. When set, this portal config is scoped to that tenant only. Null = org-wide default/template.';
