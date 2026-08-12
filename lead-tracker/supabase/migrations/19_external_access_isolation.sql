-- ============================================================================
-- 19_external_access_isolation  (spec §4,5,6,9,10,13)
-- External restricted access: CRM users (brokers) see only leads assigned to
-- their broker; Source users (affiliates) see only leads from their source.
-- All enforced by RLS at the database — a changed URL/ID/API param cannot leak
-- another org's rows. Delete stays blocked (no hard-delete policy + the
-- guard_soft_delete trigger, which neither role can satisfy).
-- ============================================================================

-- ---- UP ----

-- Link a Source (affiliate) to a login, mirroring brokers.app_user_id.
alter table affiliates add column if not exists app_user_id uuid
  unique references app_users(id) on delete set null;
create index if not exists affiliates_app_user_ix on affiliates(app_user_id) where app_user_id is not null;

-- Definer helpers: which broker/affiliate records the current login owns.
-- SECURITY DEFINER so the RLS subqueries don't recurse into brokers/affiliates RLS.
create or replace function my_broker_ids() returns setof uuid
  language sql stable security definer set search_path = public as
$$ select id from brokers where app_user_id = current_app_user_id() and deleted_at is null $$;

create or replace function my_affiliate_ids() returns setof uuid
  language sql stable security definer set search_path = public as
$$ select id from affiliates where app_user_id = current_app_user_id() and deleted_at is null $$;

revoke execute on function my_broker_ids()    from public, anon;
revoke execute on function my_affiliate_ids() from public, anon;

-- Leads: read scoped to (all internal) OR (my broker's leads) OR (my source's leads).
drop policy if exists leads_select on leads;
create policy leads_select on leads for select
using (
  deleted_at is null and has_perm('leads','read')
  and (
    perm_scope('leads','read') = 'all'
    or broker_id    in (select my_broker_ids())      -- CRM sees its assigned leads
    or affiliate_id in (select my_affiliate_ids())   -- Source sees its own leads
  )
);

-- Leads: update scoped to (all internal) OR (my broker's leads). Sources are
-- read-only (no 'update' permission), so they never reach this.
drop policy if exists leads_update on leads;
create policy leads_update on leads for update
using (
  has_perm('leads','update')
  and (
    perm_scope('leads','update') = 'all'
    or broker_id in (select my_broker_ids())
  )
)
with check (
  has_perm('leads','update')
  and (
    perm_scope('leads','update') = 'all'
    or broker_id in (select my_broker_ids())         -- can't reassign a lead out of scope
  )
);

-- app_users: external users must not be able to enumerate internal staff.
-- Internal roles see everyone (for assignment pickers); external see only self.
drop policy if exists users_select on app_users;
create policy users_select on app_users for select
using (
  deleted_at is null and current_app_user_id() is not null
  and (
    app_current_role() in ('admin','business_development','rm_staff','read_only')
    or id = current_app_user_id()
  )
);

-- Permission matrix for the two external roles (minimal, default-deny elsewhere).
insert into role_permissions (role, resource, action, allowed, scope) values
  ('crm','leads','read',   true, 'own'),
  ('crm','leads','update', true, 'own'),
  ('source','leads','read',true, 'own'),
  ('source','reports','read', true, 'own')
on conflict (role, resource, action) do update
  set allowed = excluded.allowed, scope = excluded.scope;

-- ---- DOWN ----
-- delete from role_permissions where role in ('crm','source');
-- (restore prior leads_select/leads_update/users_select; drop helpers + column)
