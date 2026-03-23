-- Add follow-up reminder columns to se_health_checks
ALTER TABLE public.se_health_checks
  ADD COLUMN IF NOT EXISTS followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_sent boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_se_health_checks_followup
  ON public.se_health_checks(followup_at)
  WHERE followup_at IS NOT NULL AND followup_sent = false;

COMMENT ON COLUMN public.se_health_checks.followup_at IS
  'When the SE wants a reminder email to re-check this customer. NULL = no reminder.';
COMMENT ON COLUMN public.se_health_checks.followup_sent IS
  'True once the followup reminder email has been sent.';
