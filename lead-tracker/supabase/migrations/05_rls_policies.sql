-- ============================================================================
-- 05_rls_policies
-- Row Level Security on every table. All policies read the role_permissions
-- matrix through has_perm()/perm_scope(), so the matrix is the single source of
-- truth for authorization. RM Staff are scoped to their OWN assigned leads.
-- ============================================================================

-- ---- UP ----

-- Soft-delete guard: setting deleted_at requires the 'delete' permission on the
-- table, which a plain UPDATE policy cannot distinguish on its own.
create or replace function guard_soft_delete() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (new.deleted_at is distinct from old.deleted_at)
     and not has_perm(TG_TABLE_NAME, 'delete')
     and app_current_role() <> 'admin' then
    raise exception 'You do not have permission to delete %', TG_TABLE_NAME
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
create trigger t_guard_del_leads      before update on leads      for each row execute function guard_soft_delete();
create trigger t_guard_del_affiliates before update on affiliates for each row execute function guard_soft_delete();

alter table app_users            enable row level security;
alter table role_permissions     enable row level security;
alter table insurance_types      enable row level security;
alter table affiliates           enable row level security;
alter table leads                enable row level security;
alter table lead_status_history  enable row level security;
alter table audit_log            enable row level security;
alter table activity_log         enable row level security;
alter table comments             enable row level security;
alter table documents            enable row level security;
alter table tags                 enable row level security;
alter table lead_tags            enable row level security;
alter table saved_filters        enable row level security;
alter table pinned_affiliates    enable row level security;
alter table notification_rules   enable row level security;
alter table notifications        enable row level security;
alter table import_jobs          enable row level security;

-- ---------- app_users ----------
create policy users_select on app_users for select
  using (deleted_at is null and current_app_user_id() is not null);
create policy users_self_update on app_users for update
  using (id = current_app_user_id())
  with check (id = current_app_user_id()
              and role = (select role from app_users u where u.id = current_app_user_id()));
create policy users_admin_all on app_users for all
  using (app_current_role() = 'admin') with check (app_current_role() = 'admin');

-- ---------- role_permissions ---------- (readable for UI mirroring; writable by admin)
create policy perms_select on role_permissions for select using (current_app_user_id() is not null);
create policy perms_admin  on role_permissions for all
  using (app_current_role() = 'admin') with check (app_current_role() = 'admin');

-- ---------- insurance_types ----------
create policy itypes_select on insurance_types for select using (deleted_at is null);
create policy itypes_admin  on insurance_types for all
  using (app_current_role() = 'admin') with check (app_current_role() = 'admin');

-- ---------- affiliates ----------
create policy affiliates_select on affiliates for select
  using (deleted_at is null and has_perm('affiliates','read'));
create policy affiliates_insert on affiliates for insert
  with check (has_perm('affiliates','create'));
create policy affiliates_update on affiliates for update
  using (has_perm('affiliates','update') or has_perm('affiliates','delete'))
  with check (has_perm('affiliates','update') or has_perm('affiliates','delete'));
-- no hard DELETE policy: nothing historical is ever hard-deleted

-- ---------- leads ---------- (RM scope = 'own' -> only assigned leads)
create policy leads_select on leads for select
  using (deleted_at is null and has_perm('leads','read')
         and (perm_scope('leads','read') = 'all'
              or assigned_rm_id = current_app_user_id()));
create policy leads_select_deleted on leads for select
  using (deleted_at is not null and app_current_role() = 'admin');
create policy leads_insert on leads for insert
  with check (has_perm('leads','create'));
create policy leads_update on leads for update
  using (has_perm('leads','update')
         and (perm_scope('leads','update') = 'all'
              or assigned_rm_id = current_app_user_id()))
  with check (has_perm('leads','update')
              and (perm_scope('leads','update') = 'all'
                   or assigned_rm_id = current_app_user_id()));
-- no DELETE policy; hard removal only via anonymize_lead()

-- ---------- lead_status_history / audit_log ---------- (read-only to clients)
create policy lsh_select   on lead_status_history for select using (has_perm('audit','read'));
create policy audit_select on audit_log           for select using (has_perm('audit','read'));

-- ---------- activity_log ----------
create policy activity_select on activity_log for select using (has_perm('audit','read'));
create policy activity_insert on activity_log for insert
  with check (actor_id = current_app_user_id());   -- app logs views/exports as the real actor

-- ---------- comments ----------
create policy comments_select on comments for select
  using (deleted_at is null and has_perm('comments','read'));
create policy comments_insert on comments for insert
  with check (has_perm('comments','create') and author_id = current_app_user_id());
create policy comments_update on comments for update
  using (author_id = current_app_user_id() or app_current_role() = 'admin')
  with check (author_id = current_app_user_id() or app_current_role() = 'admin');

-- ---------- documents ----------
create policy documents_select on documents for select
  using (deleted_at is null and has_perm('documents','read'));
create policy documents_insert on documents for insert
  with check (has_perm('documents','create') and uploaded_by = current_app_user_id());
create policy documents_update on documents for update
  using (has_perm('documents','delete')
         or (uploaded_by = current_app_user_id() and has_perm('documents','create'))
         or app_current_role() = 'admin')
  with check (true);

-- ---------- tags / lead_tags ----------
create policy tags_select on tags for select using (deleted_at is null);
create policy tags_write  on tags for all
  using (has_perm('tags','create')) with check (has_perm('tags','create'));
create policy lead_tags_select on lead_tags for select using (has_perm('leads','read'));
create policy lead_tags_insert on lead_tags for insert with check (has_perm('leads','update'));
create policy lead_tags_delete on lead_tags for delete using (has_perm('leads','update'));

-- ---------- saved_filters ---------- (own + shared)
create policy filters_select on saved_filters for select
  using (deleted_at is null and (owner_id = current_app_user_id() or is_shared));
create policy filters_write on saved_filters for all
  using (owner_id = current_app_user_id()) with check (owner_id = current_app_user_id());

-- ---------- pinned_affiliates ----------
create policy pins_all on pinned_affiliates for all
  using (user_id = current_app_user_id()) with check (user_id = current_app_user_id());

-- ---------- notification_rules ----------
create policy rules_select on notification_rules for select using (has_perm('notification_rules','read'));
create policy rules_admin  on notification_rules for all
  using (app_current_role() = 'admin') with check (app_current_role() = 'admin');

-- ---------- notifications ---------- (strictly own; inserts via SECURITY DEFINER only)
create policy notif_select on notifications for select using (user_id = current_app_user_id());
create policy notif_update on notifications for update
  using (user_id = current_app_user_id()) with check (user_id = current_app_user_id());

-- ---------- import_jobs ----------
create policy imports_select on import_jobs for select using (has_perm('imports','read'));
create policy imports_insert on import_jobs for insert
  with check (has_perm('imports','create') and uploaded_by = current_app_user_id());
create policy imports_update on import_jobs for update
  using (has_perm('imports','create')) with check (uploaded_by = current_app_user_id());

-- ---- DOWN ----
-- (drop policies … ; alter table … disable row level security; drop triggers/guard fn)
