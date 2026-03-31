-- Claim pending job_outbox rows for worker (FOR UPDATE SKIP LOCKED).
-- Service role / SECURITY DEFINER only; no grants to anon/authenticated.

CREATE OR REPLACE FUNCTION public.claim_job_outbox_batch(batch_size integer)
RETURNS SETOF public.job_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 500 THEN
    RAISE EXCEPTION 'batch_size must be between 1 and 500';
  END IF;

  RETURN QUERY
  UPDATE public.job_outbox AS j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    updated_at = now()
  FROM (
    SELECT jo.id
    FROM public.job_outbox AS jo
    WHERE jo.status = 'pending'
      AND jo.next_run_at <= now()
    ORDER BY jo.next_run_at ASC
    LIMIT batch_size
    FOR UPDATE OF jo SKIP LOCKED
  ) AS sub
  WHERE j.id = sub.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_job_outbox_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_job_outbox_batch(integer) TO service_role;

COMMENT ON FUNCTION public.claim_job_outbox_batch IS
  'Atomically claims up to batch_size pending jobs; bumps attempts and sets status=processing.';

-- Keep updated_at fresh on manual updates (worker sets columns explicitly; trigger covers other paths).
CREATE OR REPLACE FUNCTION public.job_outbox_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_outbox_updated_at_trigger ON public.job_outbox;
CREATE TRIGGER job_outbox_updated_at_trigger
  BEFORE UPDATE ON public.job_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.job_outbox_set_updated_at();
