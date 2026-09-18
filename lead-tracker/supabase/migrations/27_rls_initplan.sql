-- ============================================================================
-- 27_rls_initplan
-- Performance only: no access rule changes.
--
-- The RLS policies called the permission helpers (has_perm, perm_scope,
-- app_current_role, current_app_user_id, is_internal) bare. Postgres evaluates
-- a bare function call in a policy once per ROW, so at ~14.5k leads a single
-- leads query spent ~3s re-running the same permission lookups, and a page
-- firing several such queries hit the 8s statement timeout (error 57014,
-- surfacing as "Application error" in the app).
--
-- Wrapping each call as `(SELECT fn(...))` makes it an InitPlan: evaluated once
-- per statement and reused. Safe because every wrapped call takes only
-- literal arguments (none depend on the row) and all helpers are STABLE.
-- Row-dependent calls such as owns_lead(lead_id) are deliberately left as-is.
--
-- Generated from the live policies and reviewed; see Supabase guidance on
-- "Call functions with select" for RLS performance.
-- ============================================================================

-- ---- UP ----
alter policy activity_insert on public.activity_log
  with check ((actor_id = (SELECT current_app_user_id())));
alter policy activity_select on public.activity_log
  using (((SELECT has_perm('audit'::text, 'read'::text)) AND (((SELECT perm_scope('audit'::text, 'read'::text)) = 'all'::text) OR (actor_id = (SELECT current_app_user_id())) OR ((lead_id IS NOT NULL) AND owns_lead(lead_id)))));
alter policy affiliates_insert on public.affiliates
  with check ((SELECT has_perm('affiliates'::text, 'create'::text)));
alter policy affiliates_select on public.affiliates
  using (((deleted_at IS NULL) AND (SELECT has_perm('affiliates'::text, 'read'::text))));
alter policy affiliates_update on public.affiliates
  using (((SELECT has_perm('affiliates'::text, 'update'::text)) OR (SELECT has_perm('affiliates'::text, 'delete'::text))))
  with check (((SELECT has_perm('affiliates'::text, 'update'::text)) OR (SELECT has_perm('affiliates'::text, 'delete'::text))));
alter policy users_admin_all on public.app_users
  using (((SELECT app_current_role()) = 'admin'::user_role))
  with check (((SELECT app_current_role()) = 'admin'::user_role));
alter policy users_select on public.app_users
  using (((deleted_at IS NULL) AND ((SELECT current_app_user_id()) IS NOT NULL) AND (((SELECT app_current_role()) = ANY (ARRAY['admin'::user_role, 'business_development'::user_role, 'rm_staff'::user_role, 'read_only'::user_role])) OR (id = (SELECT current_app_user_id())))));
alter policy users_self_update on public.app_users
  using ((id = (SELECT current_app_user_id())))
  with check (((id = (SELECT current_app_user_id())) AND (role = ( SELECT u.role
   FROM app_users u
  WHERE (u.id = (SELECT current_app_user_id()))))));
alter policy audit_select on public.audit_log
  using (((SELECT has_perm('audit'::text, 'read'::text)) AND (((SELECT perm_scope('audit'::text, 'read'::text)) = 'all'::text) OR (actor_id = (SELECT current_app_user_id())) OR ((entity_type = 'leads'::text) AND owns_lead(entity_id)))));
alter policy brokers_insert on public.brokers
  with check ((SELECT has_perm('brokers'::text, 'create'::text)));
alter policy brokers_select on public.brokers
  using (((SELECT has_perm('brokers'::text, 'read'::text)) AND (deleted_at IS NULL)));
alter policy brokers_update on public.brokers
  using ((SELECT has_perm('brokers'::text, 'update'::text)))
  with check ((SELECT has_perm('brokers'::text, 'update'::text)));
alter policy comments_insert on public.comments
  with check (((SELECT has_perm('comments'::text, 'create'::text)) AND (author_id = (SELECT current_app_user_id()))));
alter policy comments_select on public.comments
  using (((deleted_at IS NULL) AND (SELECT has_perm('comments'::text, 'read'::text))));
alter policy comments_update on public.comments
  using (((author_id = (SELECT current_app_user_id())) OR ((SELECT app_current_role()) = 'admin'::user_role)))
  with check (((author_id = (SELECT current_app_user_id())) OR ((SELECT app_current_role()) = 'admin'::user_role)));
alter policy documents_insert on public.documents
  with check (((SELECT has_perm('documents'::text, 'create'::text)) AND (uploaded_by = (SELECT current_app_user_id()))));
alter policy documents_select on public.documents
  using (((deleted_at IS NULL) AND (SELECT has_perm('documents'::text, 'read'::text))));
alter policy documents_update on public.documents
  using (((SELECT has_perm('documents'::text, 'delete'::text)) OR ((uploaded_by = (SELECT current_app_user_id())) AND (SELECT has_perm('documents'::text, 'create'::text))) OR ((SELECT app_current_role()) = 'admin'::user_role)))
  with check (((SELECT has_perm('documents'::text, 'delete'::text)) OR ((uploaded_by = (SELECT current_app_user_id())) AND (SELECT has_perm('documents'::text, 'create'::text))) OR ((SELECT app_current_role()) = 'admin'::user_role)));
alter policy generators_insert on public.generators
  with check ((SELECT has_perm('generators'::text, 'create'::text)));
alter policy generators_select on public.generators
  using (((SELECT has_perm('generators'::text, 'read'::text)) AND (deleted_at IS NULL)));
alter policy generators_update on public.generators
  using ((SELECT has_perm('generators'::text, 'update'::text)))
  with check ((SELECT has_perm('generators'::text, 'update'::text)));
alter policy imports_insert on public.import_jobs
  with check (((SELECT has_perm('imports'::text, 'create'::text)) AND (uploaded_by = (SELECT current_app_user_id()))));
alter policy imports_select on public.import_jobs
  using ((SELECT has_perm('imports'::text, 'read'::text)));
alter policy imports_update on public.import_jobs
  using ((SELECT has_perm('imports'::text, 'create'::text)))
  with check ((uploaded_by = (SELECT current_app_user_id())));
alter policy lead_products_delete on public.lead_products
  using ((SELECT has_perm('leads'::text, 'update'::text)));
alter policy lead_products_insert on public.lead_products
  with check ((SELECT has_perm('leads'::text, 'update'::text)));
alter policy lead_products_select on public.lead_products
  using ((SELECT has_perm('leads'::text, 'read'::text)));
alter policy lead_stage_history_select on public.lead_stage_history
  using (((SELECT has_perm('leads'::text, 'read'::text)) AND (((SELECT perm_scope('leads'::text, 'read'::text)) = 'all'::text) OR owns_lead(lead_id))));
alter policy lsh_select on public.lead_status_history
  using (((SELECT has_perm('audit'::text, 'read'::text)) AND (((SELECT perm_scope('audit'::text, 'read'::text)) = 'all'::text) OR owns_lead(lead_id))));
alter policy lead_tags_delete on public.lead_tags
  using ((SELECT has_perm('leads'::text, 'update'::text)));
alter policy lead_tags_insert on public.lead_tags
  with check ((SELECT has_perm('leads'::text, 'update'::text)));
alter policy lead_tags_select on public.lead_tags
  using ((SELECT has_perm('leads'::text, 'read'::text)));
alter policy leads_insert on public.leads
  with check ((SELECT has_perm('leads'::text, 'create'::text)));
alter policy leads_select on public.leads
  using (((deleted_at IS NULL) AND (SELECT has_perm('leads'::text, 'read'::text)) AND (((SELECT perm_scope('leads'::text, 'read'::text)) = 'all'::text) OR (broker_id IN ( SELECT my_broker_ids() AS my_broker_ids)) OR (affiliate_id IN ( SELECT my_affiliate_ids() AS my_affiliate_ids)))));
alter policy leads_select_deleted on public.leads
  using (((deleted_at IS NOT NULL) AND ((SELECT app_current_role()) = 'admin'::user_role)));
alter policy leads_update on public.leads
  using (((SELECT has_perm('leads'::text, 'update'::text)) AND (((SELECT perm_scope('leads'::text, 'update'::text)) = 'all'::text) OR (broker_id IN ( SELECT my_broker_ids() AS my_broker_ids)))))
  with check (((SELECT has_perm('leads'::text, 'update'::text)) AND (((SELECT perm_scope('leads'::text, 'update'::text)) = 'all'::text) OR (broker_id IN ( SELECT my_broker_ids() AS my_broker_ids)))));
alter policy rules_admin on public.notification_rules
  using (((SELECT app_current_role()) = 'admin'::user_role))
  with check (((SELECT app_current_role()) = 'admin'::user_role));
alter policy rules_select on public.notification_rules
  using ((SELECT has_perm('notification_rules'::text, 'read'::text)));
alter policy notif_select on public.notifications
  using ((user_id = (SELECT current_app_user_id())));
alter policy notif_update on public.notifications
  using ((user_id = (SELECT current_app_user_id())))
  with check ((user_id = (SELECT current_app_user_id())));
alter policy pins_all on public.pinned_affiliates
  using ((user_id = (SELECT current_app_user_id())))
  with check ((user_id = (SELECT current_app_user_id())));
alter policy itypes_admin on public.products
  using (((SELECT app_current_role()) = 'admin'::user_role))
  with check (((SELECT app_current_role()) = 'admin'::user_role));
alter policy products_insert on public.products
  with check ((SELECT has_perm('products'::text, 'create'::text)));
alter policy products_select on public.products
  using (((SELECT has_perm('products'::text, 'read'::text)) AND (deleted_at IS NULL)));
alter policy products_update on public.products
  using ((SELECT has_perm('products'::text, 'update'::text)))
  with check ((SELECT has_perm('products'::text, 'update'::text)));
alter policy perms_admin on public.role_permissions
  using (((SELECT app_current_role()) = 'admin'::user_role))
  with check (((SELECT app_current_role()) = 'admin'::user_role));
alter policy perms_select on public.role_permissions
  using (((SELECT current_app_user_id()) IS NOT NULL));
alter policy filters_select on public.saved_filters
  using (((deleted_at IS NULL) AND ((owner_id = (SELECT current_app_user_id())) OR is_shared)));
alter policy filters_write on public.saved_filters
  using ((owner_id = (SELECT current_app_user_id())))
  with check ((owner_id = (SELECT current_app_user_id())));
alter policy tags_write on public.tags
  using ((SELECT has_perm('tags'::text, 'create'::text)))
  with check ((SELECT has_perm('tags'::text, 'create'::text)));

-- ---- DOWN ----
-- Re-run each ALTER POLICY with the (SELECT …) wrappers removed. The rules are
-- identical either way; only evaluation frequency differs.
