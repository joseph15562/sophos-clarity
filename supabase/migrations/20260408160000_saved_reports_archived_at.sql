-- Report Centre: persist "archive" in Supabase (soft archive — row stays, hidden from main library).

alter table public.saved_reports
  add column if not exists archived_at timestamptz null;

comment on column public.saved_reports.archived_at is
  'When set, the saved package is treated as archived in Report Centre (main library vs Archives).';

create index if not exists idx_saved_reports_org_archived_at
  on public.saved_reports (org_id, archived_at desc nulls last);
