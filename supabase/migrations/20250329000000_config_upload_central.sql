-- Add Sophos Central integration columns to config_upload_requests
alter table public.config_upload_requests
  add column if not exists central_client_id_enc     text,
  add column if not exists central_client_secret_enc text,
  add column if not exists central_data              jsonb,
  add column if not exists central_connected_at      timestamptz,
  add column if not exists central_linked_firewall_id   text,
  add column if not exists central_linked_firewall_name text;
