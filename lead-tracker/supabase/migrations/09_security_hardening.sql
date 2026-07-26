-- ============================================================================
-- 09_security_hardening
-- Addresses Supabase advisor findings:
--  * analytics views must respect RLS (RM = own leads only) -> security_invoker
--  * own-scope reads for history/activity/audit via owns_lead() (definer, no
--    RLS recursion)
--  * pin search_path on flagged functions
--  * revoke EXECUTE on trigger-only / scan functions from API roles
--  * documents_update WITH CHECK tightened; matview not exposed to anon
--
-- ACCEPTED EXCEPTIONS (reviewed, intentional):
--  * v_affiliate_commission stays SECURITY DEFINER — it is the mechanism that
--    hides commission_pct (column revoked from authenticated) and re-exposes it
--    only to roles passing has_perm('affiliates','update').
--  * pg_trgm / citext remain in the public schema — citext backs live columns;
--    relocating post-hoc risks breaking column types for no security gain.
-- ============================================================================

-- ---- UP ----

-- ---------- own-lead helper (definer to avoid RLS recursion in policies) ----------
create or replace function owns_lead(p_lead_id uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from leads
                  where id = p_lead_id and assigned_rm_id = current_app_user_id()) $$;

-- ---------- pin search_path on flagged functions ----------
create or replace function touch_updated_at() returns trigger
  language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create or replace function stage_rank(s lead_status) returns int
  language sql immutable set search_path = public as $$
  select case s
    when 'inbound' then 1 when 'contacted' then 2 when 'opportunity_open' then 3
    when 'account_pending' then 4 when 'account_open' then 5 else null end $$;

create or replace function lead_transition_kind(p_from lead_status, p_to lead_status)
returns transition_kind language plpgsql immutable set search_path = public as $$
begin
  if p_from = p_to then return null; end if;
  if p_from = 'account_open'   and p_to = 'account_lapsed' then return 'lapse'; end if;
  if p_from = 'account_lapsed' and p_to = 'account_open'   then return 'reinstate'; end if;
  if p_from = 'lost' and p_to in ('contacted','opportunity_open') then return 'reopen'; end if;
  if (p_from, p_to) in (
       ('contacted','inbound'),
       ('opportunity_open','contacted'),
       ('account_pending','opportunity_open'),
       ('account_open','account_pending')) then return 'correction'; end if;
  if p_from in ('inbound','contacted','opportunity_open','account_pending')
     and p_to = 'lost' then return 'progress'; end if;
  if stage_rank(p_from) is not null and stage_rank(p_to) is not null
     and stage_rank(p_to) > stage_rank(p_from) then return 'progress'; end if;
  return null;
end $$;

create or replace function leads_before_update() returns trigger
  language plpgsql set search_path = public as $$
declare v_kind transition_kind; v_reason text;
begin
  new.updated_at := now();
  if new.current_status is distinct from old.current_status then
    v_kind := lead_transition_kind(old.current_status, new.current_status);
    if v_kind is null then
      raise exception 'Illegal status transition: % -> %', old.current_status, new.current_status
        using errcode = 'check_violation';
    end if;
    v_reason := nullif(current_setting('app.transition_reason', true), '');
    if v_kind = 'correction' then
      if app_current_role() not in ('admin','business_development') then
        raise exception 'Only Admin or Business Development may correct a status backward'
          using errcode = 'insufficient_privilege';
      end if;
      if v_reason is null then
        raise exception 'A reason is required to correct a status backward'
          using errcode = 'check_violation';
      end if;
    end if;
    if new.current_status = 'opportunity_open' and new.quote_date       is null then new.quote_date       := current_date; end if;
    if new.current_status = 'account_pending' and new.application_date  is null then new.application_date := current_date; end if;
    if new.current_status = 'account_open'    and new.payment_date      is null then new.payment_date     := current_date; end if;
    if v_kind = 'correction' then
      if old.current_status = 'opportunity_open' then new.quote_date       := null; end if;
      if old.current_status = 'account_pending'  then new.application_date := null; end if;
      if old.current_status = 'account_open'     then new.payment_date     := null; end if;
    end if;
    new.stage_entered_at := now();
  end if;
  return new;
end $$;

-- ---------- analytics views respect RLS (security_invoker) ----------
alter view v_funnel_by_affiliate set (security_invoker = on);
alter view v_stage_durations    set (security_invoker = on);
alter view v_monthly_cohorts    set (security_invoker = on);
alter view v_lead_aging         set (security_invoker = on);
-- v_affiliate_commission intentionally stays security_invoker = off (see header).

-- ---------- own-scope reads for history / activity / audit ----------
drop policy lsh_select      on lead_status_history;
drop policy activity_select on activity_log;
drop policy audit_select    on audit_log;

create policy lsh_select on lead_status_history for select
  using (has_perm('audit','read')
         and (perm_scope('audit','read') = 'all' or owns_lead(lead_id)));

create policy activity_select on activity_log for select
  using (has_perm('audit','read')
         and (perm_scope('audit','read') = 'all'
              or actor_id = current_app_user_id()
              or (lead_id is not null and owns_lead(lead_id))));

create policy audit_select on audit_log for select
  using (has_perm('audit','read')
         and (perm_scope('audit','read') = 'all'
              or actor_id = current_app_user_id()
              or (entity_type = 'leads' and owns_lead(entity_id))));

-- ---------- documents_update WITH CHECK tightened ----------
drop policy documents_update on documents;
create policy documents_update on documents for update
  using (has_perm('documents','delete')
         or (uploaded_by = current_app_user_id() and has_perm('documents','create'))
         or app_current_role() = 'admin')
  with check (has_perm('documents','delete')
         or (uploaded_by = current_app_user_id() and has_perm('documents','create'))
         or app_current_role() = 'admin');

-- ---------- materialized view: not exposed to anon ----------
revoke select on mv_affiliate_stats from anon;

-- ---------- lock down function EXECUTE ----------
-- Trigger-only + scan functions: never called directly. Strip from all API roles.
revoke execute on function touch_updated_at()        from public, anon, authenticated;
revoke execute on function fn_audit_row()            from public, anon, authenticated;
revoke execute on function leads_before_update()     from public, anon, authenticated;
revoke execute on function leads_log_transition()    from public, anon, authenticated;
revoke execute on function leads_notify_new()        from public, anon, authenticated;
revoke execute on function guard_soft_delete()       from public, anon, authenticated;
revoke execute on function fn_scan_notifications()   from public, anon, authenticated;

-- Helpers used by RLS/invoker views + guarded RPCs: keep authenticated, drop anon.
revoke execute on function current_app_user_id()                  from public, anon;
revoke execute on function app_current_role()                     from public, anon;
revoke execute on function has_perm(text,text)                    from public, anon;
revoke execute on function perm_scope(text,text)                  from public, anon;
revoke execute on function owns_lead(uuid)                        from public, anon;
revoke execute on function stage_rank(lead_status)                from public, anon;
revoke execute on function lead_transition_kind(lead_status,lead_status) from public, anon;
revoke execute on function anonymize_lead(uuid)                   from public, anon;  -- admin-guarded inside

-- ---- DOWN ----
-- (restore prior policies; alter views security_invoker=off; re-grant execute; drop owns_lead)
