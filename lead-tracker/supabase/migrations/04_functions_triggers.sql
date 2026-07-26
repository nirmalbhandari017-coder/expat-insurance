-- ============================================================================
-- 04_functions_triggers
-- Authz helpers, updated_at, transition matrix + validation, append-only
-- history, immutable audit diff, new-lead notification, GDPR anonymisation.
--
-- Status-change reason is passed by the server action via a transaction-local
-- GUC:  select set_config('app.transition_reason', <text>, true);  before UPDATE.
-- History is still written by a trigger, so even a raw UPDATE is logged.
-- ============================================================================

-- ---- UP ----

-- ---------- AUTHZ HELPERS (single choke point RLS flows through) ----------
create or replace function current_app_user_id() returns uuid
  language sql stable security definer set search_path = public as
$$ select id from app_users where auth_user_id = auth.uid() and deleted_at is null $$;

-- NB: named app_current_role(), not current_role() — current_role is reserved.
create or replace function app_current_role() returns user_role
  language sql stable security definer set search_path = public as
$$ select role from app_users where auth_user_id = auth.uid() and deleted_at is null $$;

create or replace function has_perm(p_resource text, p_action text) returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select allowed from role_permissions
                    where role = app_current_role() and resource = p_resource and action = p_action), false) $$;

create or replace function perm_scope(p_resource text, p_action text) returns text
  language sql stable security definer set search_path = public as
$$ select coalesce((select scope from role_permissions
                    where role = app_current_role() and resource = p_resource and action = p_action), 'none') $$;

-- ---------- updated_at ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger t_touch_affiliates        before update on affiliates        for each row execute function touch_updated_at();
create trigger t_touch_app_users          before update on app_users         for each row execute function touch_updated_at();
create trigger t_touch_insurance_types    before update on insurance_types   for each row execute function touch_updated_at();
create trigger t_touch_comments           before update on comments          for each row execute function touch_updated_at();
create trigger t_touch_documents          before update on documents         for each row execute function touch_updated_at();
create trigger t_touch_tags               before update on tags              for each row execute function touch_updated_at();
create trigger t_touch_saved_filters      before update on saved_filters     for each row execute function touch_updated_at();
create trigger t_touch_notification_rules before update on notification_rules for each row execute function touch_updated_at();
create trigger t_touch_import_jobs        before update on import_jobs       for each row execute function touch_updated_at();

-- ---------- TRANSITION MATRIX ----------
-- Linear rank for the 5 progressing stages; null for terminal-ish states.
create or replace function stage_rank(s lead_status) returns int language sql immutable as $$
  select case s
    when 'inbound' then 1 when 'contacted' then 2 when 'opportunity_open' then 3
    when 'account_pending' then 4 when 'account_open' then 5 else null end $$;

-- Returns the transition_kind for a legal move, or null if the move is illegal.
create or replace function lead_transition_kind(p_from lead_status, p_to lead_status)
returns transition_kind language plpgsql immutable as $$
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

-- ---------- LEADS: BEFORE UPDATE (validate + stamp dates) ----------
create or replace function leads_before_update() returns trigger language plpgsql as $$
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

    -- stamp milestone dates on entering a stage (only if not already set)
    if new.current_status = 'opportunity_open' and new.quote_date       is null then new.quote_date       := current_date; end if;
    if new.current_status = 'account_pending' and new.application_date  is null then new.application_date := current_date; end if;
    if new.current_status = 'account_open'    and new.payment_date      is null then new.payment_date     := current_date; end if;

    -- a correction asserts "that stage never happened" -> clear its milestone date
    if v_kind = 'correction' then
      if old.current_status = 'opportunity_open' then new.quote_date       := null; end if;
      if old.current_status = 'account_pending'  then new.application_date := null; end if;
      if old.current_status = 'account_open'     then new.payment_date     := null; end if;
    end if;

    new.stage_entered_at := now();
  end if;
  return new;
end $$;
create trigger t_leads_before_update before update on leads
  for each row execute function leads_before_update();

-- ---------- LEADS: history (append-only) ----------
create or replace function leads_log_transition() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_kind transition_kind;
begin
  if TG_OP = 'INSERT' then
    insert into lead_status_history(lead_id, from_status, to_status, kind, reason, changed_by)
    values (new.id, null, new.current_status,
            (case when new.source_channel in ('csv','api') then 'import' else 'progress' end)::transition_kind,
            null, current_app_user_id());
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary)
    values (current_app_user_id(), 'lead_created', new.id, new.affiliate_id,
            'Lead ' || new.lead_code || ' created (' || new.current_status || ')');
    return new;
  end if;
  if new.current_status is distinct from old.current_status then
    v_kind := lead_transition_kind(old.current_status, new.current_status);
    insert into lead_status_history(lead_id, from_status, to_status, kind, reason, changed_by)
    values (new.id, old.current_status, new.current_status, v_kind,
            nullif(current_setting('app.transition_reason', true), ''), current_app_user_id());
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary)
    values (current_app_user_id(), 'status_changed', new.id, new.affiliate_id,
            new.lead_code || ': ' || old.current_status || ' -> ' || new.current_status);
  end if;
  return new;
end $$;
create trigger t_leads_log_transition after insert or update on leads
  for each row execute function leads_log_transition();

-- ---------- GENERIC AUDIT DIFF ----------
create or replace function fn_audit_row() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_old jsonb; v_new jsonb; k text; ov text; nv text; v_actor uuid;
begin
  v_actor := current_app_user_id();
  if TG_OP = 'INSERT' then
    insert into audit_log(actor_id, entity_type, entity_id, field, old_value, new_value)
    values (v_actor, TG_TABLE_NAME, new.id, '__created__', null, null);
    return new;
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    for k in select jsonb_object_keys(v_new) loop
      if k in ('updated_at','search_tsv','body_tsv','phone_normalized','stage_entered_at') then continue; end if;
      ov := v_old ->> k; nv := v_new ->> k;
      if ov is distinct from nv then
        insert into audit_log(actor_id, entity_type, entity_id, field, old_value, new_value)
        values (v_actor, TG_TABLE_NAME, new.id, k, ov, nv);
      end if;
    end loop;
    return new;
  end if;
  return null;
end $$;
create trigger t_audit_leads           after insert or update on leads             for each row execute function fn_audit_row();
create trigger t_audit_affiliates      after insert or update on affiliates        for each row execute function fn_audit_row();
create trigger t_audit_app_users       after insert or update on app_users         for each row execute function fn_audit_row();
create trigger t_audit_insurance_types after insert or update on insurance_types   for each row execute function fn_audit_row();
create trigger t_audit_notif_rules     after insert or update on notification_rules for each row execute function fn_audit_row();
create trigger t_audit_documents       after insert or update on documents         for each row execute function fn_audit_row();

-- ---------- NEW-LEAD NOTIFICATION (manual entry only; bulk import stays quiet) ----------
create or replace function leads_notify_new() returns trigger
  language plpgsql security definer set search_path = public as $$
declare r notification_rules; u app_users;
begin
  if new.source_channel <> 'manual' then return new; end if;   -- no spam on CSV/API import
  select * into r from notification_rules where rule_key = 'new_lead' and is_active;
  if not found then return new; end if;
  for u in select * from app_users where deleted_at is null and role = any(r.target_roles) loop
    insert into notifications(user_id, rule_id, lead_id, affiliate_id, title, body, dedupe_key)
    values (u.id, r.id, new.id, new.affiliate_id,
            'New lead ' || new.lead_code, new.customer_name, 'new_lead:' || new.id)
    on conflict (user_id, dedupe_key) do nothing;
  end loop;
  if r.notify_assigned_rm and new.assigned_rm_id is not null then
    insert into notifications(user_id, rule_id, lead_id, affiliate_id, title, body, dedupe_key)
    values (new.assigned_rm_id, r.id, new.id, new.affiliate_id,
            'New lead assigned: ' || new.lead_code, new.customer_name, 'new_lead:' || new.id)
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end $$;
create trigger t_leads_notify_new after insert on leads
  for each row execute function leads_notify_new();

-- ---------- IMMUTABILITY OF HISTORY + AUDIT ----------
-- Clients get no UPDATE/DELETE; SECURITY DEFINER trigger functions still insert.
revoke insert, update, delete on lead_status_history from anon, authenticated;
revoke insert, update, delete on audit_log           from anon, authenticated;

-- ---------- GDPR ANONYMISATION (admin only, irreversible, logged) ----------
create or replace function anonymize_lead(p_lead_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if app_current_role() <> 'admin' then
    raise exception 'Only Admin may anonymise a lead' using errcode = 'insufficient_privilege';
  end if;

  update leads set
    customer_name = '[Anonymised]', email = null, phone = null, nationality = null,
    country_of_residence = null, policy_number = null, notes = null, lost_reason_detail = null,
    anonymized_at = now(), deleted_at = coalesce(deleted_at, now())
  where id = p_lead_id;

  update comments  set body = '[Anonymised]', deleted_at = coalesce(deleted_at, now()) where lead_id = p_lead_id;
  update documents set deleted_at = coalesce(deleted_at, now())                          where lead_id = p_lead_id;

  update audit_log set
    old_value = case when old_value is null then null else '[redacted]' end,
    new_value = case when new_value is null then null else '[redacted]' end
  where entity_type = 'leads' and entity_id = p_lead_id
    and field in ('customer_name','email','phone','nationality','country_of_residence',
                  'policy_number','notes','lost_reason_detail');

  insert into activity_log(actor_id, kind, lead_id, summary)
  values (current_app_user_id(), 'field_changed', p_lead_id, 'Lead anonymised (GDPR erasure)');
end $$;

-- ---- DOWN ----
-- drop function if exists anonymize_lead(uuid);
-- drop trigger if exists t_leads_notify_new on leads;      drop function if exists leads_notify_new();
-- drop trigger if exists t_audit_documents on documents;   -- (+ other t_audit_* triggers)
-- drop function if exists fn_audit_row();
-- drop trigger if exists t_leads_log_transition on leads;  drop function if exists leads_log_transition();
-- drop trigger if exists t_leads_before_update on leads;   drop function if exists leads_before_update();
-- drop function if exists lead_transition_kind(lead_status,lead_status);
-- drop function if exists stage_rank(lead_status);
-- drop function if exists touch_updated_at() cascade;
-- drop function if exists perm_scope(text,text); drop function if exists has_perm(text,text);
-- drop function if exists app_current_role();    drop function if exists current_app_user_id();
