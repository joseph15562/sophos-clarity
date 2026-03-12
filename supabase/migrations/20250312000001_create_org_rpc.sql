-- Fix: RLS chicken-and-egg problem when creating an org.
-- The user can't SELECT the org they just created because the SELECT policy
-- requires them to already be a member. This RPC handles both in one atomic call.

create or replace function public.create_organisation(org_name text)
returns json
language plpgsql
security definer
as $$
declare
  new_org_id uuid;
  result json;
begin
  insert into public.organisations (name)
  values (org_name)
  returning id into new_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (new_org_id, auth.uid(), 'admin');

  select json_build_object('id', o.id, 'name', o.name)
  into result
  from public.organisations o
  where o.id = new_org_id;

  return result;
end;
$$;
