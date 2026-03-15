-- ============================================================
-- Client Portal Configuration (per-org branding & settings)
-- ============================================================

create table if not exists public.portal_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  slug text unique,
  logo_url text,
  company_name text,
  accent_color text default '#2006F7',
  welcome_message text,
  sla_info text,
  contact_email text,
  contact_phone text,
  footer_text text,
  visible_sections jsonb default '["score","history","findings","compliance","reports","feedback"]'::jsonb,
  show_branding boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id)
);

alter table public.portal_config enable row level security;

-- Slug validation: lowercase alphanumeric + hyphens, 3-48 chars
alter table public.portal_config
  add constraint portal_config_slug_format
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9\-]{1,46}[a-z0-9]$');

-- Indexes
create index if not exists idx_portal_config_org_id on public.portal_config(org_id);
create index if not exists idx_portal_config_slug on public.portal_config(slug);

-- ============================================================
-- RLS Policies
-- ============================================================

-- Org members can read their own portal config
drop policy if exists "Members can view portal config" on public.portal_config;
create policy "Members can view portal config"
  on public.portal_config for select
  using (org_id = public.user_org_id());

-- Admins can insert portal config
drop policy if exists "Admins can create portal config" on public.portal_config;
create policy "Admins can create portal config"
  on public.portal_config for insert
  with check (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Admins can update portal config
drop policy if exists "Admins can update portal config" on public.portal_config;
create policy "Admins can update portal config"
  on public.portal_config for update
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Admins can delete portal config
drop policy if exists "Admins can delete portal config" on public.portal_config;
create policy "Admins can delete portal config"
  on public.portal_config for delete
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
      and user_id = auth.uid()
      and role = 'admin'
    )
  );

-- Public read for portal config by slug (branding only — no auth required)
-- The edge function handles assessment data separately with service-role key
drop policy if exists "Public can read portal config by slug" on public.portal_config;
create policy "Public can read portal config by slug"
  on public.portal_config for select
  using (slug is not null);

-- ============================================================
-- Auto-update updated_at timestamp
-- ============================================================
create or replace function public.portal_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_config_updated_at_trigger on public.portal_config;
create trigger portal_config_updated_at_trigger
  before update on public.portal_config
  for each row
  execute function public.portal_config_updated_at();
