-- Optional developer seed (Tier 3 / Phase F). Do not put secrets here.
-- Apply via Supabase SQL editor or `psql` after migrations; adapt UUIDs to your model.
--
-- Example organisation row (uncomment to use):
--
-- INSERT INTO organisations (id, name, created_at)
-- VALUES (
--   '11111111-1111-4111-8111-111111111111',
--   'Local Dev MSP',
--   now()
-- )
-- ON CONFLICT (id) DO NOTHING;
--
-- Portal rows are tenant-scoped (`portal_config` has `org_id` + `tenant_name`); add via the
-- product UI or a follow-on INSERT once you have a real `tenant_name` / slug policy.

SELECT 1;
