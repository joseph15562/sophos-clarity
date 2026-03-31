-- Phase 4: optional reviewer attestation on cloud assessment snapshots (RLS unchanged — same org update policy).
alter table public.assessments
  add column if not exists reviewer_signed_by text,
  add column if not exists reviewer_signed_at timestamptz,
  add column if not exists reviewer_signoff_notes text;

comment on column public.assessments.reviewer_signed_by is 'Display name or email of reviewer who attested this snapshot.';
comment on column public.assessments.reviewer_signed_at is 'UTC time of reviewer sign-off.';
comment on column public.assessments.reviewer_signoff_notes is 'Optional short annotation alongside sign-off.';
