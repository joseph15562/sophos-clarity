-- Fix: the DELETE policy was comparing se_user_id (which is se_profiles.id)
-- directly to auth.uid() (which is auth.users.id).  Those are different UUIDs,
-- so the policy never matched and purge silently deleted zero rows.
-- Use the same subquery pattern as the SELECT / INSERT policies.

DROP POLICY IF EXISTS "SE can delete own health checks" ON public.se_health_checks;

CREATE POLICY "SE can delete own health checks"
  ON public.se_health_checks
  FOR DELETE
  USING (
    se_user_id IN (SELECT id FROM public.se_profiles WHERE user_id = auth.uid())
  );
