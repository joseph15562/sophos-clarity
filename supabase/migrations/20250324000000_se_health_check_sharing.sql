-- Add sharing columns to se_health_checks for public share-via-link.
-- Public reads go through the api edge function (service role), not RLS.

alter table public.se_health_checks
  add column if not exists share_token text unique,
  add column if not exists share_expires_at timestamptz,
  add column if not exists shared_html text;

-- Allow the owning SE to update their own rows (needed for setting share columns).
create policy "se_health_checks_update_own"
  on public.se_health_checks for update
  using (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
  );

create index if not exists idx_se_health_checks_share_token
  on public.se_health_checks(share_token)
  where share_token is not null;
