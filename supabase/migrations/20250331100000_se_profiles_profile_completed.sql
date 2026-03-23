-- Track whether the SE has explicitly confirmed their display name.
-- Existing users default to false so they are prompted on next login.

alter table public.se_profiles
  add column if not exists profile_completed boolean not null default false;
