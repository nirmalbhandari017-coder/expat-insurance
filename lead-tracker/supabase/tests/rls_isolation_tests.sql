-- ============================================================================
-- rls_isolation_tests.sql  (spec §5,6,9,10,13)
-- Proves external-user data isolation at the database. Creates a Source user
-- and a CRM user, impersonates each via a forged JWT sub on the `authenticated`
-- role, asserts, then cleans up. Verified ALL PASS on 2026-08-12.
-- Run in the Supabase SQL editor.
-- ============================================================================
create temp table if not exists _iso(check_name text, got text, expected text, pass boolean);
truncate _iso;
do $$
declare
  a_src uuid := gen_random_uuid(); a_crm uuid := gen_random_uuid();
  u_src uuid; u_crm uuid; aff_src uuid; brk_crm uuid;
  aff_other uuid := (select id from affiliates where deleted_at is null limit 1);
  l_src uuid; l_crm uuid; l_other uuid;
  s_own int; s_direct int; s_upd int; c_own int; c_direct int; c_upd int; c_delblocked boolean;
begin
  insert into auth.users(id,email,aud,role,created_at,updated_at,instance_id) values
    (a_src,'src_'||a_src||'@t.example','authenticated','authenticated',now(),now(),'00000000-0000-0000-0000-000000000000'),
    (a_crm,'crm_'||a_crm||'@t.example','authenticated','authenticated',now(),now(),'00000000-0000-0000-0000-000000000000');
  select id into u_src from app_users where auth_user_id=a_src;
  select id into u_crm from app_users where auth_user_id=a_crm;
  update app_users set role='source' where id=u_src;
  update app_users set role='crm'    where id=u_crm;
  insert into affiliates(name,type,app_user_id) values ('ISO Source '||a_src,'referral_partner',u_src) returning id into aff_src;
  insert into brokers(first_name,last_name,app_user_id) values ('ISO','CRM '||a_crm,u_crm) returning id into brk_crm;
  insert into leads(customer_name,first_name,last_name,email,affiliate_id) values ('ISO SrcLead','ISO','SrcLead','s_'||a_src||'@x.com',aff_src) returning id into l_src;
  insert into leads(customer_name,first_name,last_name,email,affiliate_id,broker_id) values ('ISO CrmLead','ISO','CrmLead','c_'||a_crm||'@x.com',aff_other,brk_crm) returning id into l_crm;
  insert into leads(customer_name,first_name,last_name,email,affiliate_id) values ('ISO OtherLead','ISO','OtherLead','o_'||a_src||'@x.com',aff_other) returning id into l_other;

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',a_src::text,'role','authenticated')::text, true);
  select count(*) into s_own from leads where email like '%'||a_src||'%' or email like '%'||a_crm||'%';
  select count(*) into s_direct from leads where id in (l_crm,l_other);
  update leads set customer_name='HACKED' where id=l_src; get diagnostics s_upd = row_count;
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',a_crm::text,'role','authenticated')::text, true);
  select count(*) into c_own from leads where email like '%'||a_src||'%' or email like '%'||a_crm||'%';
  select count(*) into c_direct from leads where id in (l_src,l_other);
  update leads set customer_name='CRM edited' where id=l_crm; get diagnostics c_upd = row_count;
  begin update leads set deleted_at=now() where id=l_crm; c_delblocked := false;
  exception when others then c_delblocked := true; end;
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);

  insert into _iso values
    ('Source sees only its own lead', s_own::text,'1', s_own=1),
    ('Source cannot fetch CRM/other lead by direct id', s_direct::text,'0', s_direct=0),
    ('Source update blocked (read-only)', s_upd::text,'0', s_upd=0),
    ('CRM sees only its assigned lead', c_own::text,'1', c_own=1),
    ('CRM cannot fetch source/other lead by direct id', c_direct::text,'0', c_direct=0),
    ('CRM can update its own lead', c_upd::text,'1', c_upd=1),
    ('CRM delete blocked at DB', c_delblocked::text,'true', c_delblocked);

  delete from lead_status_history where lead_id in (l_src,l_crm,l_other);
  delete from activity_log where lead_id in (l_src,l_crm,l_other);
  delete from audit_log where entity_id in (l_src,l_crm,l_other,u_src,u_crm,aff_src,brk_crm);
  delete from notifications where lead_id in (l_src,l_crm,l_other) or user_id in (u_src,u_crm);
  delete from leads where id in (l_src,l_crm,l_other);
  delete from brokers where id=brk_crm;
  delete from affiliates where id=aff_src;
  delete from app_users where id in (u_src,u_crm);
  delete from auth.users where id in (a_src,a_crm);
end $$;
select *, case when bool_and(pass) over () then 'ALL PASS' else 'FAILURE' end as suite from _iso;
