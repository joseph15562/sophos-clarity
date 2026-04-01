-- Scope portal viewer invites per client portal (vanity slug), not whole org.
alter table public.portal_viewers
  add column if not exists portal_slug text not null default '';

comment on column public.portal_viewers.portal_slug is
  'Matches portal_config.slug for this invite. Empty string = legacy org-wide invite before per-portal scoping.';

drop index if exists portal_viewers_org_email_idx;

create unique index if not exists portal_viewers_org_email_slug_idx
  on public.portal_viewers (org_id, email, portal_slug);
