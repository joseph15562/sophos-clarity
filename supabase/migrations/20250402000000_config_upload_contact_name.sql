-- Persist the contact name from config upload requests so it can
-- auto-fill the "Prepared For" field when loading a customer's config.

alter table public.config_upload_requests
  add column if not exists contact_name text;
