-- ============================================================================
-- 15_crm_pipeline_logic
-- Transition rules, history/activity logging, RPCs, analytics views and RLS for
-- the new model.
--
-- Deliberate change from the old design: backward stage moves are NO LONGER
-- admin-only. The spec requires a salesperson to walk a deal back (e.g.
-- Application Received -> Negotiation) as normal practice, so backward moves are
-- allowed for anyone who can update the lead and are recorded as 'correction'.
-- Loss no longer overwrites the stage; it sets `opportunity` and snapshots
-- `stage_at_loss`, which is what makes "where do we lose deals" answerable.
-- ============================================================================

-- ---- UP ----

-- ---------- activity_log: richer, and old/new values (spec §13) ----------
alter table activity_log
  add column if not exists old_value text,
  add column if not exists new_value text;

alter table activity_log drop constraint if exists activity_log_kind_check;
alter table activity_log add constraint activity_log_kind_check check (kind in (
  'lead_created','status_changed','field_changed','note_added','comment_added',
  'document_uploaded','document_deleted','viewed','imported','exported',
  'assigned','bulk_update',
  'qualified','disqualified','stage_changed','marked_lost','reopened',
  'product_changed','source_changed','generator_changed','broker_changed'));

-- ---------- stage ordering ----------
create or replace function stage_rank(s pipeline_stage) returns int
  language sql immutable set search_path = public as $$
  select case s
    when 'qualified'            then 1
    when 'quote_sent'           then 2
    when 'negotiation'          then 3
    when 'application_received' then 4
    when 'policy_issued'        then 5
    when 'renewal'              then 6 end $$;

-- ---------- BEFORE UPDATE: validate + stamp ----------
create or replace function leads_before_update()
  returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();

  -- Qualification gate: only qualified leads may hold a stage.
  if new.qualification <> 'qualified' and new.stage is not null then
    raise exception 'A lead must be Qualified before it can enter the pipeline'
      using errcode = 'check_violation';
  end if;

  -- Entering Qualified: open the pipeline at the first stage.
  if new.qualification = 'qualified' and old.qualification <> 'qualified' then
    new.stage        := coalesce(new.stage, 'qualified');
    new.qualified_at := coalesce(new.qualified_at, now());
    new.lead_state   := case when new.lead_state = 'new' then 'active' else new.lead_state end;
  end if;

  -- Leaving Qualified: drop out of the pipeline entirely.
  if new.qualification <> 'qualified' and old.qualification = 'qualified' then
    new.stage      := null;
    new.lead_state := case when new.qualification = 'not_qualified'
                           then 'closed' else new.lead_state end;
  end if;

  -- Loss bookkeeping.
  if new.opportunity = 'lost' and old.opportunity <> 'lost' then
    new.stage_at_loss := coalesce(new.stage_at_loss, old.stage, new.stage);
    new.lost_at       := coalesce(new.lost_at, now());
    new.lost_by       := coalesce(new.lost_by, current_app_user_id());
    new.lead_state    := 'closed';
  end if;

  -- Reopening clears the loss, restores a stage, reactivates.
  if new.opportunity = 'active' and old.opportunity = 'lost' then
    new.stage          := coalesce(new.stage, old.stage_at_loss, 'qualified');
    new.stage_at_loss  := null;
    new.lost_reason_id := null;
    new.lost_notes     := null;
    new.lost_at        := null;
    new.lost_by        := null;
    new.lead_state     := 'active';
  end if;

  -- Stage movement: stamp milestone dates, reset the aging clock.
  if new.stage is distinct from old.stage then
    new.stage_entered_at := now();
    if new.stage = 'quote_sent'           and new.quote_date       is null then new.quote_date       := current_date; end if;
    if new.stage = 'application_received' and new.application_date is null then new.application_date := current_date; end if;
    if new.stage = 'policy_issued'        and new.payment_date     is null then new.payment_date     := current_date; end if;
  end if;

  return new;
end $$;

create trigger t_leads_before_update before update on leads
  for each row execute function leads_before_update();

-- ---------- AFTER INSERT/UPDATE: history + activity ----------
create or replace function leads_log_changes() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_actor uuid; v_reason text; v_kind transition_kind;
begin
  v_actor  := current_app_user_id();
  v_reason := nullif(current_setting('app.transition_reason', true), '');

  if TG_OP = 'INSERT' then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, new_value)
    values (v_actor, 'lead_created', new.id, new.affiliate_id,
            'Lead ' || new.lead_code || ' created', new.qualification::text);
    if new.stage is not null then
      insert into lead_stage_history(lead_id, from_stage, to_stage, kind, changed_by)
      values (new.id, null, new.stage, 'import', v_actor);
    end if;
    return new;
  end if;

  -- qualification
  if new.qualification is distinct from old.qualification then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor,
            case when new.qualification = 'qualified' then 'qualified' else 'disqualified' end,
            new.id, new.affiliate_id,
            'Qualification: ' || old.qualification || ' -> ' || new.qualification,
            old.qualification::text, new.qualification::text);
  end if;

  -- stage
  if new.stage is distinct from old.stage then
    v_kind := case
      when old.stage is null then 'qualify'
      when new.stage is null then 'disqualify'
      when stage_rank(new.stage) > stage_rank(old.stage) then 'progress'
      else 'correction' end;
    insert into lead_stage_history(lead_id, from_stage, to_stage, kind, reason, changed_by)
    values (new.id, old.stage, new.stage, v_kind, v_reason, v_actor);
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor, 'stage_changed', new.id, new.affiliate_id,
            new.lead_code || ': ' || coalesce(old.stage::text,'—') || ' -> ' || coalesce(new.stage::text,'—'),
            old.stage::text, new.stage::text);
  end if;

  -- opportunity (lost / reopened)
  if new.opportunity is distinct from old.opportunity then
    if new.opportunity = 'lost' then
      insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
      values (v_actor, 'marked_lost', new.id, new.affiliate_id,
              'Lost at ' || coalesce(new.stage_at_loss::text,'—') ||
              coalesce(' — ' || (select label from lost_reasons where id = new.lost_reason_id), ''),
              old.stage::text, 'lost');
    else
      insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
      values (v_actor, 'reopened', new.id, new.affiliate_id,
              'Reopened at ' || coalesce(new.stage::text,'—'), 'lost', new.stage::text);
    end if;
  end if;

  -- attribution changes
  if new.affiliate_id is distinct from old.affiliate_id then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor, 'source_changed', new.id, new.affiliate_id, 'Source changed',
            (select name from affiliates where id = old.affiliate_id),
            (select name from affiliates where id = new.affiliate_id));
  end if;
  if new.generator_id is distinct from old.generator_id then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor, 'generator_changed', new.id, new.affiliate_id, 'Generator changed',
            (select full_name from generators where id = old.generator_id),
            (select full_name from generators where id = new.generator_id));
  end if;
  if new.broker_id is distinct from old.broker_id then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor, 'broker_changed', new.id, new.affiliate_id, 'Broker changed',
            (select full_name from brokers where id = old.broker_id),
            (select full_name from brokers where id = new.broker_id));
  end if;

  return new;
end $$;

create trigger t_leads_log_changes after insert or update on leads
  for each row execute function leads_log_changes();

-- Keep customer_name in sync with the split name fields (search/tsv depend on it).
create or replace function leads_sync_name() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.customer_name := btrim(coalesce(new.first_name,'') || ' ' || coalesce(new.last_name,''));
  if new.whatsapp_same_as_phone then new.whatsapp_phone := new.phone; end if;
  return new;
end $$;
create trigger t_leads_sync_name before insert or update on leads
  for each row execute function leads_sync_name();

-- ---------- RPCs ----------
create or replace function set_lead_qualification(
  p_lead_id uuid, p_status qualification_status, p_reason text default null
) returns leads language plpgsql security invoker set search_path = public as $$
declare v_row leads;
begin
  perform set_config('app.transition_reason', coalesce(p_reason,''), true);
  update leads set qualification = p_status where id = p_lead_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Lead not found or not permitted' using errcode = 'no_data_found';
  end if;
  return v_row;
end $$;

create or replace function change_lead_stage(
  p_lead_id uuid, p_stage pipeline_stage, p_reason text default null
) returns leads language plpgsql security invoker set search_path = public as $$
declare v_row leads;
begin
  perform set_config('app.transition_reason', coalesce(p_reason,''), true);
  update leads set stage = p_stage where id = p_lead_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Lead not found or not permitted' using errcode = 'no_data_found';
  end if;
  return v_row;
end $$;

create or replace function mark_lead_lost(
  p_lead_id uuid, p_reason_id uuid, p_notes text default null
) returns leads language plpgsql security invoker set search_path = public as $$
declare v_row leads;
begin
  update leads set opportunity = 'lost', lost_reason_id = p_reason_id, lost_notes = p_notes
  where id = p_lead_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Lead not found or not permitted' using errcode = 'no_data_found';
  end if;
  return v_row;
end $$;

create or replace function reopen_lead(
  p_lead_id uuid, p_stage pipeline_stage default null, p_reason text default null
) returns leads language plpgsql security invoker set search_path = public as $$
declare v_row leads;
begin
  perform set_config('app.transition_reason', coalesce(p_reason,''), true);
  update leads set opportunity = 'active', stage = coalesce(p_stage, stage_at_loss, 'qualified')
  where id = p_lead_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Lead not found or not permitted' using errcode = 'no_data_found';
  end if;
  return v_row;
end $$;

revoke execute on function set_lead_qualification(uuid, qualification_status, text) from public, anon;
revoke execute on function change_lead_stage(uuid, pipeline_stage, text)            from public, anon;
revoke execute on function mark_lead_lost(uuid, uuid, text)                          from public, anon;
revoke execute on function reopen_lead(uuid, pipeline_stage, text)                   from public, anon;
grant  execute on function set_lead_qualification(uuid, qualification_status, text) to authenticated;
grant  execute on function change_lead_stage(uuid, pipeline_stage, text)            to authenticated;
grant  execute on function mark_lead_lost(uuid, uuid, text)                          to authenticated;
grant  execute on function reopen_lead(uuid, pipeline_stage, text)                   to authenticated;

-- ---------- DUPLICATE DETECTION (spec §22 — warn, never block) ----------
create or replace function find_duplicate_leads(
  p_email text default null, p_phone text default null, p_whatsapp text default null,
  p_first text default null, p_last text default null, p_dob date default null,
  p_exclude uuid default null
) returns table (
  id uuid, lead_code text, customer_name text, email text, phone text,
  affiliate_name text, match_reason text
) language sql stable security definer set search_path = public as $$
  with norm as (
    select nullif(regexp_replace(coalesce(p_phone,''),   '[^0-9+]','','g'),'') as ph,
           nullif(regexp_replace(coalesce(p_whatsapp,''),'[^0-9+]','','g'),'') as wa
  )
  select l.id, l.lead_code, l.customer_name, l.email::text, l.phone,
         a.name,
         case
           when p_email is not null and l.email = p_email::citext then 'Same email'
           when (select ph from norm) is not null
                and (select ph from norm) in (l.phone_normalized, l.whatsapp_normalized) then 'Same phone'
           when (select wa from norm) is not null
                and (select wa from norm) in (l.phone_normalized, l.whatsapp_normalized) then 'Same WhatsApp'
           else 'Same name and date of birth' end
  from leads l
  join affiliates a on a.id = l.affiliate_id
  where l.deleted_at is null
    and (p_exclude is null or l.id <> p_exclude)
    and (
      (p_email is not null and l.email = p_email::citext)
      or ((select ph from norm) is not null
          and (select ph from norm) in (l.phone_normalized, l.whatsapp_normalized))
      or ((select wa from norm) is not null
          and (select wa from norm) in (l.phone_normalized, l.whatsapp_normalized))
      or (p_first is not null and p_last is not null and p_dob is not null
          and lower(l.first_name) = lower(p_first)
          and lower(l.last_name)  = lower(p_last)
          and l.date_of_birth = p_dob)
    )
  limit 10 $$;

revoke execute on function find_duplicate_leads(text,text,text,text,text,date,uuid) from public, anon;
grant  execute on function find_duplicate_leads(text,text,text,text,text,date,uuid) to authenticated;

-- ---------- ANALYTICS ----------
create materialized view mv_affiliate_stats as
select a.id as affiliate_id,
       count(l.id)                                                                as total_leads,
       count(*) filter (where l.qualification = 'pending')                        as n_pending,
       count(*) filter (where l.qualification = 'qualified')                      as n_qualified,
       count(*) filter (where l.qualification = 'not_qualified')                  as n_not_qualified,
       count(*) filter (where l.stage = 'quote_sent'           and l.opportunity='active') as n_quote_sent,
       count(*) filter (where l.stage = 'negotiation'          and l.opportunity='active') as n_negotiation,
       count(*) filter (where l.stage = 'application_received' and l.opportunity='active') as n_application,
       count(*) filter (where l.stage = 'policy_issued'        and l.opportunity='active') as n_policy_issued,
       count(*) filter (where l.stage = 'renewal'              and l.opportunity='active') as n_renewal,
       count(*) filter (where l.opportunity = 'lost')                             as n_lost,
       round((count(*) filter (where l.stage in ('policy_issued','renewal') and l.opportunity='active'))::numeric
           / nullif(count(l.id), 0), 4)                                           as conversion_rate,
       max(l.created_at)                                                          as last_lead_at
from affiliates a
left join leads l on l.affiliate_id = a.id and l.deleted_at is null
where a.deleted_at is null
group by a.id;
create unique index mv_affiliate_stats_pk on mv_affiliate_stats (affiliate_id);
grant select on mv_affiliate_stats to authenticated;

create or replace view v_generator_stats as
select g.id as generator_id, g.affiliate_id,
       count(l.id)                                               as total_leads,
       count(*) filter (where l.qualification = 'qualified')     as n_qualified,
       count(*) filter (where l.stage in ('policy_issued','renewal') and l.opportunity='active') as n_policies,
       count(*) filter (where l.opportunity = 'lost')            as n_lost,
       round((count(*) filter (where l.stage in ('policy_issued','renewal') and l.opportunity='active'))::numeric
           / nullif(count(l.id),0), 4)                           as conversion_rate
from generators g
left join leads l on l.generator_id = g.id and l.deleted_at is null
where g.deleted_at is null
group by g.id, g.affiliate_id;
grant select on v_generator_stats to authenticated;

create or replace view v_broker_stats as
select b.id as broker_id,
       count(l.id) filter (where l.opportunity = 'active' and l.lead_state <> 'closed') as active_leads,
       count(*) filter (where l.stage = 'quote_sent')                        as n_quotes,
       count(*) filter (where l.stage = 'application_received')              as n_applications,
       count(*) filter (where l.stage = 'policy_issued')                     as n_policies,
       count(*) filter (where l.stage = 'renewal')                           as n_renewals,
       count(*) filter (where l.opportunity = 'lost')                        as n_lost,
       count(l.id)                                                          as total_leads
from brokers b
left join leads l on l.broker_id = b.id and l.deleted_at is null
where b.deleted_at is null
group by b.id;
grant select on v_broker_stats to authenticated;

create or replace view v_funnel_by_affiliate as
with reached as (
  select h.lead_id, l.affiliate_id, max(stage_rank(h.to_stage)) as max_rank
  from lead_stage_history h
  join leads l on l.id = h.lead_id and l.deleted_at is null
  where h.to_stage is not null
  group by h.lead_id, l.affiliate_id
)
select affiliate_id,
       count(*) filter (where max_rank >= 1) as reached_qualified,
       count(*) filter (where max_rank >= 2) as reached_quote_sent,
       count(*) filter (where max_rank >= 3) as reached_negotiation,
       count(*) filter (where max_rank >= 4) as reached_application,
       count(*) filter (where max_rank >= 5) as reached_policy,
       count(*) filter (where max_rank >= 6) as reached_renewal
from reached group by affiliate_id;
grant select on v_funnel_by_affiliate to authenticated;

create or replace view v_monthly_cohorts as
select l.affiliate_id,
       date_trunc('month', l.created_at)::date as cohort_month,
       count(*)                                                    as total,
       count(*) filter (where l.stage in ('policy_issued','renewal')
                          and l.opportunity = 'active')            as converted,
       count(*) filter (where l.opportunity = 'lost')              as lost,
       count(*) filter (where l.opportunity = 'active'
                          and l.lead_state <> 'closed')            as in_progress
from leads l where l.deleted_at is null
group by l.affiliate_id, date_trunc('month', l.created_at);
grant select on v_monthly_cohorts to authenticated;

create or replace view v_lead_aging as
select l.id, l.lead_code, l.customer_name, l.affiliate_id, l.broker_id,
       l.qualification, l.stage, l.stage_entered_at,
       (now() - l.stage_entered_at) as time_in_stage
from leads l
where l.deleted_at is null and l.opportunity = 'active' and l.lead_state <> 'closed';
grant select on v_lead_aging to authenticated;

-- ---------- notification scan rebuilt on the new axes ----------
create or replace function fn_scan_notifications() returns void
  language plpgsql security definer set search_path = public as $$
declare r notification_rules; rec record; u app_users; v_key text; v_bid uuid;
begin
  for r in select * from notification_rules where is_active and threshold_days is not null loop
    if r.rule_key in ('inbound_stale','opportunity_stale','pending_stale') then
      for rec in
        select l.* from leads l
        where l.deleted_at is null and l.opportunity = 'active'
          and case r.rule_key
                when 'inbound_stale'     then l.qualification = 'pending'
                when 'opportunity_stale' then l.stage = 'quote_sent'
                when 'pending_stale'     then l.stage = 'application_received'
              end
          and l.stage_entered_at < now() - make_interval(days => r.threshold_days)
      loop
        v_key := r.rule_key || ':' || rec.id || ':' || rec.stage_entered_at::date;
        for u in select * from app_users where deleted_at is null and role = any(r.target_roles) loop
          insert into notifications(user_id, rule_id, lead_id, affiliate_id, title, body, dedupe_key)
          values (u.id, r.id, rec.id, rec.affiliate_id, r.name,
                  rec.lead_code || ' – ' || rec.customer_name, v_key)
          on conflict (user_id, dedupe_key) do nothing;
        end loop;
        select app_user_id into v_bid from brokers where id = rec.broker_id;
        if r.notify_assigned_rm and v_bid is not null then
          insert into notifications(user_id, rule_id, lead_id, affiliate_id, title, body, dedupe_key)
          values (v_bid, r.id, rec.id, rec.affiliate_id, r.name,
                  rec.lead_code || ' – ' || rec.customer_name, v_key)
          on conflict (user_id, dedupe_key) do nothing;
        end if;
      end loop;
    elsif r.rule_key = 'affiliate_quiet' then
      for rec in
        select a.* from affiliates a
        where a.deleted_at is null and a.is_active
          and coalesce((select max(l.created_at) from leads l
                        where l.affiliate_id = a.id and l.deleted_at is null), a.created_at)
              < now() - make_interval(days => r.threshold_days)
      loop
        v_key := 'affiliate_quiet:' || rec.id || ':' || to_char(now(), 'IYYY-IW');
        for u in select * from app_users where deleted_at is null and role = any(r.target_roles) loop
          insert into notifications(user_id, rule_id, affiliate_id, title, body, dedupe_key)
          values (u.id, r.id, rec.id, r.name, rec.name || ' has gone quiet', v_key)
          on conflict (user_id, dedupe_key) do nothing;
        end loop;
      end loop;
    end if;
  end loop;
end $$;

-- new-lead notification: broker instead of RM
create or replace function leads_notify_new() returns trigger
  language plpgsql security definer set search_path = public as $$
declare r notification_rules; u app_users; v_bid uuid;
begin
  if new.source_channel <> 'manual' then return new; end if;
  select * into r from notification_rules where rule_key = 'new_lead' and is_active;
  if not found then return new; end if;
  for u in select * from app_users where deleted_at is null and role = any(r.target_roles) loop
    insert into notifications(user_id, rule_id, lead_id, affiliate_id, title, body, dedupe_key)
    values (u.id, r.id, new.id, new.affiliate_id,
            'New lead ' || new.lead_code, new.customer_name, 'new_lead:' || new.id)
    on conflict (user_id, dedupe_key) do nothing;
  end loop;
  select app_user_id into v_bid from brokers where id = new.broker_id;
  if r.notify_assigned_rm and v_bid is not null then
    insert into notifications(user_id, rule_id, lead_id, affiliate_id, title, body, dedupe_key)
    values (v_bid, r.id, new.id, new.affiliate_id,
            'New lead assigned: ' || new.lead_code, new.customer_name, 'new_lead:' || new.id)
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end $$;

-- anonymisation must cover the new PII columns
create or replace function anonymize_lead(p_lead_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if app_current_role() <> 'admin' then
    raise exception 'Only Admin may anonymise a lead' using errcode = 'insufficient_privilege';
  end if;
  update leads set
    first_name = '[Anonymised]', last_name = '', title = null,
    email = null, phone = null, whatsapp_phone = null, whatsapp_same_as_phone = false,
    date_of_birth = null, nationality = null, country_of_residence = null,
    policy_number = null, notes = null, lost_notes = null,
    anonymized_at = now(), deleted_at = coalesce(deleted_at, now())
  where id = p_lead_id;
  update comments  set body = '[Anonymised]', deleted_at = coalesce(deleted_at, now()) where lead_id = p_lead_id;
  update documents set deleted_at = coalesce(deleted_at, now())                         where lead_id = p_lead_id;
  update audit_log set
    old_value = case when old_value is null then null else '[redacted]' end,
    new_value = case when new_value is null then null else '[redacted]' end
  where entity_type = 'leads' and entity_id = p_lead_id
    and field in ('customer_name','first_name','last_name','email','phone','whatsapp_phone',
                  'date_of_birth','nationality','country_of_residence','policy_number','notes','lost_notes');
  insert into activity_log(actor_id, kind, lead_id, summary)
  values (current_app_user_id(), 'field_changed', p_lead_id, 'Lead anonymised (GDPR erasure)');
end $$;

-- ---------- PERMISSIONS + RLS for the new entities ----------
insert into role_permissions (role, resource, action, allowed, scope) values
 ('admin','generators','create',true,'all'),('admin','generators','read',true,'all'),
 ('admin','generators','update',true,'all'),('admin','generators','delete',true,'all'),
 ('admin','brokers','create',true,'all'),('admin','brokers','read',true,'all'),
 ('admin','brokers','update',true,'all'),('admin','brokers','delete',true,'all'),
 ('admin','products','create',true,'all'),('admin','products','read',true,'all'),
 ('admin','products','update',true,'all'),('admin','products','delete',true,'all'),
 ('business_development','generators','create',true,'all'),('business_development','generators','read',true,'all'),
 ('business_development','generators','update',true,'all'),
 ('business_development','brokers','create',true,'all'),('business_development','brokers','read',true,'all'),
 ('business_development','brokers','update',true,'all'),
 ('business_development','products','read',true,'all'),
 ('rm_staff','generators','read',true,'all'),('rm_staff','brokers','read',true,'all'),
 ('rm_staff','products','read',true,'all'),
 ('read_only','generators','read',true,'all'),('read_only','brokers','read',true,'all'),
 ('read_only','products','read',true,'all')
on conflict (role, resource, action) do nothing;

alter table generators         enable row level security;
alter table brokers            enable row level security;
alter table products           enable row level security;
alter table lead_products      enable row level security;
alter table lost_reasons       enable row level security;
alter table lead_stage_history enable row level security;

create policy generators_select on generators for select using (has_perm('generators','read') and deleted_at is null);
create policy generators_insert on generators for insert with check (has_perm('generators','create'));
create policy generators_update on generators for update using (has_perm('generators','update')) with check (has_perm('generators','update'));

create policy brokers_select on brokers for select using (has_perm('brokers','read') and deleted_at is null);
create policy brokers_insert on brokers for insert with check (has_perm('brokers','create'));
create policy brokers_update on brokers for update using (has_perm('brokers','update')) with check (has_perm('brokers','update'));

create policy products_select on products for select using (has_perm('products','read') and deleted_at is null);
create policy products_insert on products for insert with check (has_perm('products','create'));
create policy products_update on products for update using (has_perm('products','update')) with check (has_perm('products','update'));

create policy lost_reasons_select on lost_reasons for select using (true);

create policy lead_products_select on lead_products for select using (has_perm('leads','read'));
create policy lead_products_insert on lead_products for insert with check (has_perm('leads','update'));
create policy lead_products_delete on lead_products for delete using (has_perm('leads','update'));

create policy lead_stage_history_select on lead_stage_history for select
  using (has_perm('leads','read')
         and (perm_scope('leads','read') = 'all' or owns_lead(lead_id)));

-- ---- DOWN ----
-- drop the RPCs, views, policies and triggers created above.
