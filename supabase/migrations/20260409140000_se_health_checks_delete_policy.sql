-- Allow SEs to delete their own health check rows (data purge feature).
CREATE POLICY "SE can delete own health checks"
  ON public.se_health_checks
  FOR DELETE
  USING (se_user_id = auth.uid());
