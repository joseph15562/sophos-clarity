-- Secure config upload requests: SE generates a link, customer uploads entities.xml
-- Public reads/writes go through the api edge function using adminClient() (service role).

create table if not exists public.config_upload_requests (
  id             uuid primary key default gen_random_uuid(),
  se_user_id     uuid not null references public.se_profiles(id) on delete cascade,
  token          text not null unique default gen_random_uuid()::text,
  customer_name  text,
  customer_email text,
  se_email       text,
  expires_at     timestamptz not null,
  status         text not null default 'pending'
                   check (status in ('pending','uploaded','downloaded','expired')),
  config_xml     text,
  file_name      text,
  email_sent     boolean not null default false,
  reminder_sent  boolean not null default false,
  uploaded_at    timestamptz,
  downloaded_at  timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_config_upload_token
  on public.config_upload_requests(token)
  where token is not null;

create index if not exists idx_config_upload_se_user
  on public.config_upload_requests(se_user_id);

create index if not exists idx_config_upload_expires
  on public.config_upload_requests(expires_at)
  where status in ('pending', 'uploaded');

alter table public.config_upload_requests enable row level security;

create policy "se_insert_own" on public.config_upload_requests
  for insert with check (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
  );

create policy "se_select_own" on public.config_upload_requests
  for select using (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
  );

create policy "se_update_own" on public.config_upload_requests
  for update using (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
  );

create policy "se_delete_own" on public.config_upload_requests
  for delete using (
    se_user_id in (select id from public.se_profiles where user_id = auth.uid())
  );
