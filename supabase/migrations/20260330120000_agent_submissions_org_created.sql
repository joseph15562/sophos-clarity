-- Composite for org-scoped time-range counts (fleet panel 7d activity, similar dashboards).
create index if not exists idx_agent_submissions_org_created_at
  on public.agent_submissions (org_id, created_at desc);

comment on index public.idx_agent_submissions_org_created_at is
  'Supports org_id + created_at range filters; validate with EXPLAIN on prod-like data (PERF-EXPLAIN.md).';
