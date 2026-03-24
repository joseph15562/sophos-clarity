-- Enable Row Level Security on gemini_usage.
-- No user-facing policies: only service_role (used by parse-config) can read/write.
-- This prevents anon and authenticated roles from accessing token usage data
-- directly via the PostgREST API.

ALTER TABLE public.gemini_usage ENABLE ROW LEVEL SECURITY;
