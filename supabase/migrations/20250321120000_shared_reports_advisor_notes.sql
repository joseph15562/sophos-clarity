-- Optional advisor-facing note shown on shared report view
alter table public.shared_reports
  add column if not exists advisor_notes text;

comment on column public.shared_reports.advisor_notes is 'Optional short note from the advisor; shown on the public shared report page.';
