-- Add SE title column to se_profiles (e.g. "Sophos Sales Engineer")

alter table public.se_profiles
  add column if not exists se_title text;

comment on column public.se_profiles.se_title is
  'Job title shown on report emails and exports (e.g. Sophos Sales Engineer). Freeform text.';
