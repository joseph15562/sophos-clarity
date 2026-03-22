-- SE Health Check: default "Prepared by" for reports (PDF/HTML), stored per SE profile.

alter table public.se_profiles
  add column if not exists health_check_prepared_by text;

comment on column public.se_profiles.health_check_prepared_by is
  'Optional display name for report cover (PDF/HTML). Falls back to display_name or email when null.';
