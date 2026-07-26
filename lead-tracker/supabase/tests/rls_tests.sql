-- ============================================================================
-- rls_tests.sql — RLS / permission integration tests
-- Run in the Supabase SQL editor (or CI). Each test impersonates the
-- `authenticated` role with a forged JWT `sub`, asserts, then cleans up.
-- Verified passing against project zuoekghumuphilkygqks on 2026-07-21.
-- ============================================================================

create temp table if not exists _rls(check_name text, got int, expected int, pass boolean);
truncate _rls;

-- ---- RM own-scope: sees only assigned leads; commission hidden ----
do $$
declare
  v_auth uuid := gen_random_uuid();
  v_rm uuid; v_aff uuid := (select id from affiliates limit 1);
  v_seen int; v_comm int;
begin
  insert into auth.users(id, email, aud, role, created_at, updated_at, instance_id)
    values (v_auth, 'rlstest_'||v_auth||'@example.com', 'authenticated','authenticated', now(), now(), '00000000-0000-0000-0000-000000000000');
  select id into v_rm from app_users where auth_user_id = v_auth;      -- auto-created by bootstrap trigger
  update app_users set role='rm_staff', is_rm=true where id = v_rm;

  insert into leads(customer_name, email, affiliate_id, current_status, source_channel, assigned_rm_id)
    values ('RLS Mine','mine_'||v_auth||'@x.com', v_aff, 'inbound','manual', v_rm);
  insert into leads(customer_name, email, affiliate_id, current_status, source_channel, assigned_rm_id)
    values ('RLS NotMine','not_'||v_auth||'@x.com', v_aff, 'inbound','manual', null);

  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_auth::text,'role','authenticated')::text, true);
  select count(*) into v_seen from leads where email in ('mine_'||v_auth||'@x.com','not_'||v_auth||'@x.com');
  select count(*) into v_comm from v_affiliate_commission where commission_pct is not null;
  reset role;
  perform set_config('request.jwt.claims','', true);

  insert into _rls values
    ('RM sees only own of 2 seeded leads', v_seen, 1, v_seen = 1),
    ('RM cannot see any commission_pct', v_comm, 0, v_comm = 0);

  -- cleanup
  delete from lead_status_history where lead_id in (select id from leads where email like '%'||v_auth||'%');
  delete from activity_log where lead_id in (select id from leads where email like '%'||v_auth||'%') or actor_id = v_rm;
  delete from audit_log where entity_id in (select id from leads where email like '%'||v_auth||'%') or entity_id = v_rm or actor_id = v_rm;
  delete from notifications where lead_id in (select id from leads where email like '%'||v_auth||'%');
  delete from leads where email like '%'||v_auth||'%';
  delete from app_users where id = v_rm;
  delete from auth.users where id = v_auth;
end $$;

select *, case when bool_and(pass) over () then 'ALL PASS' else 'FAILURES' end as suite
from _rls;

-- Additional scenarios to add (same pattern):
--  * read_only cannot UPDATE a lead (expect RLS denial / 0 rows updated)
--  * business_development CAN see commission_pct (expect > 0)
--  * an RM cannot UPDATE a lead they aren't assigned to
--  * immutability: UPDATE/DELETE on audit_log / lead_status_history is denied
