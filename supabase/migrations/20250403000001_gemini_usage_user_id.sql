-- Add user_id to gemini_usage for per-user DB-backed rate limiting.
-- Replaces the in-memory Map that resets on cold starts and doesn't
-- work across multiple edge function isolates.

ALTER TABLE public.gemini_usage ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_gemini_usage_user_rate
  ON public.gemini_usage(user_id, created_at DESC);
