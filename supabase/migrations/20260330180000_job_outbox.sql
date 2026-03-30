-- Job outbox for async Edge work (scheduled reports, etc.). Service role / backend only.
-- See docs/job-queue-outline.md Implementation plan v1.

CREATE TABLE IF NOT EXISTS public.job_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations (id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_outbox_idempotency_key_unique
  ON public.job_outbox (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_outbox_status_next_run_idx
  ON public.job_outbox (status, next_run_at)
  WHERE status = 'pending';

ALTER TABLE public.job_outbox ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: enqueue/dequeue via service role only.

COMMENT ON TABLE public.job_outbox IS 'Async job queue outbox; processed by worker Edge function.';
