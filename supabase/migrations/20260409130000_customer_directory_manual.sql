-- Manual CRM-style customers for Customer Management (before first assessment / Central link).

create table if not exists public.customer_directory_manual (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  display_name text not null,
  contact_email text,
  environment text,
  compliance_country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_directory_manual_display_name_len check (
    char_length(trim(display_name)) >= 1 and char_length(display_name) <= 500
  )
);

create unique index if not exists idx_customer_directory_manual_org_lower_name
  on public.customer_directory_manual (org_id, lower(trim(display_name)));

create index if not exists idx_customer_directory_manual_org_id
  on public.customer_directory_manual (org_id);

comment on table public.customer_directory_manual is
  'MSP-created customer rows shown in Customer Management before assessments or connectors exist.';

alter table public.customer_directory_manual enable row level security;

drop policy if exists "Members can view customer_directory_manual"
  on public.customer_directory_manual;
create policy "Members can view customer_directory_manual"
  on public.customer_directory_manual for select
  using (org_id = public.user_org_id());

drop policy if exists "Members can insert customer_directory_manual"
  on public.customer_directory_manual;
create policy "Members can insert customer_directory_manual"
  on public.customer_directory_manual for insert
  with check (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
        and user_id = auth.uid()
    )
  );

drop policy if exists "Members can update customer_directory_manual"
  on public.customer_directory_manual;
create policy "Members can update customer_directory_manual"
  on public.customer_directory_manual for update
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
        and user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete customer_directory_manual"
  on public.customer_directory_manual;
create policy "Members can delete customer_directory_manual"
  on public.customer_directory_manual for delete
  using (
    org_id = public.user_org_id()
    and exists (
      select 1 from public.org_members
      where org_id = public.user_org_id()
        and user_id = auth.uid()
    )
  );

create or replace function public.customer_directory_manual_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_directory_manual_updated_at_trigger
  on public.customer_directory_manual;
create trigger customer_directory_manual_updated_at_trigger
  before update on public.customer_directory_manual
  for each row
  execute function public.customer_directory_manual_updated_at();
