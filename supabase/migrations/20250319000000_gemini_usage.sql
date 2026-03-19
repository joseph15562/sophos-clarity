-- Gemini API token usage for parse-config (free tier: 250k TPM).
-- Query to check usage: SELECT SUM(total_tokens) FROM gemini_usage WHERE created_at > now() - interval '1 minute';
create table if not exists public.gemini_usage (
  id uuid primary key default gen_random_uuid(),
  total_tokens integer not null,
  prompt_tokens integer,
  completion_tokens integer,
  model text,
  is_chat boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_gemini_usage_created_at on public.gemini_usage(created_at desc);

-- Only Edge Function (service role) writes; no RLS policies so anon cannot read/write.
comment on table public.gemini_usage is 'Token usage per parse-config Gemini request; for checking against 250k TPM free tier.';
