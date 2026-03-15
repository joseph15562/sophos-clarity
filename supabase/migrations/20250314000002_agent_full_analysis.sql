-- Add full_analysis JSONB column to agent_submissions
-- Stores the complete AnalysisResult so the web app can load
-- a full assessment view from agent-submitted data.

alter table public.agent_submissions
  add column if not exists full_analysis jsonb default null;

comment on column public.agent_submissions.full_analysis is
  'Complete AnalysisResult JSON from the connector agent — stats, findings with detail/remediation/evidence, inspection posture, rule columns, hostname.';
