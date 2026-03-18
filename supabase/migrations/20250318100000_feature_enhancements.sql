-- ============================================================
-- Feature enhancements: share permissions, webhooks, templates, connector visibility
-- ============================================================

-- 1. Shared reports: allow_download and optional custom expiry
alter table public.shared_reports
  add column if not exists allow_download boolean not null default true;

comment on column public.shared_reports.allow_download is 'When false, shared link is view-only (no export/download).';

-- 2. Organisations: webhook and report template for integrations
alter table public.organisations
  add column if not exists webhook_url text,
  add column if not exists webhook_secret text,
  add column if not exists report_template jsonb;

comment on column public.organisations.webhook_url is 'Optional URL to POST when report/assessment is saved (MSP integrations).';
comment on column public.organisations.webhook_secret is 'Optional secret for webhook signature (e.g. HMAC).';
comment on column public.organisations.report_template is 'Optional custom report template (sections/headings) for AI generation.';

-- Allow org members to update their org (e.g. webhook_url, report_template)
drop policy if exists "Members can update their org" on public.organisations;
create policy "Members can update their org"
  on public.organisations for update
  using (id = public.user_org_id());
