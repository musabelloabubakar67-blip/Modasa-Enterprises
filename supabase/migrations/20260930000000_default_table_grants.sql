-- Gives new tables in public the access this app's migrations expect: signed-in staff (authenticated) and
-- the server key (service_role) may use them, subject to row-level security; signed-out visitors (anon) get
-- nothing.
--
-- Supabase used to grant select, insert, update and delete on every new public table to anon,
-- authenticated and service_role automatically. Projects created from 30 May 2026 don't (existing projects
-- stopped on 30 October 2026; tables made before then keep their grants), and the API answers
-- "permission denied" for a table nobody granted. The migrations after this one never grant table access
-- themselves: they rely on that default and only revoke what a role shouldn't have. So this file sorts
-- first and restores the default, minus anon, which every table here already revokes.
-- See https://github.com/orgs/supabase/discussions/45329.
--
-- On an existing project it changes nothing already there; it only covers tables added later. Apply it
-- there on its own: node scripts/migrations-sql.mjs --only 20260930000000

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated, service_role;
