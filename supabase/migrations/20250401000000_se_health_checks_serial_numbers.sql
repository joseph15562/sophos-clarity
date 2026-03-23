-- Add a lightweight serial_numbers column so queries can filter by firewall
-- without loading the ~260KB summary_json JSONB blob.

alter table public.se_health_checks
  add column if not exists serial_numbers text[] not null default '{}';

create index if not exists idx_se_health_checks_serials
  on public.se_health_checks using gin (serial_numbers)
  where (serial_numbers != '{}');

-- Backfill from existing summary_json → snapshot → files[].serialNumber
update public.se_health_checks
set serial_numbers = coalesce((
  select array_agg(distinct s)
  from jsonb_array_elements(summary_json -> 'snapshot' -> 'files') as f,
       lateral (select trim(f ->> 'serialNumber') as s) sub
  where s is not null and s != ''
), '{}')
where summary_json is not null
  and summary_json -> 'snapshot' -> 'files' is not null;
