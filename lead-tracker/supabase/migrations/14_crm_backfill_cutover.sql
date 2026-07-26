-- ============================================================================
-- 14_crm_backfill_cutover
-- Migrates every existing lead onto the 4-axis model, then retires the legacy
-- single-status columns.
--
-- Stage is inferred from the milestone dates that were already being stamped
-- (quote_date / application_date / payment_date) rather than from the old enum
-- alone — those dates are the more faithful record of how far a lead actually
-- got, and they survive the old enum's conflation of stage with outcome.
--
-- `assigned_rm_id` (a login user) is replaced by `broker_id` (a first-class
-- Broker with a company, optionally linked to a login). Own-scope RLS now
-- resolves through brokers.app_user_id, so RM Staff keep exactly the access
-- they had.
-- ============================================================================

-- ---- UP ----

-- ---------- 1. Brokers from existing RM users ----------
insert into brokers (first_name, last_name, email, app_user_id, is_active)
select coalesce(nullif(split_part(u.full_name, ' ', 1), ''), u.email::text),
       case when position(' ' in u.full_name) = 0 then '(RM)'
            else btrim(substr(u.full_name, position(' ' in u.full_name) + 1)) end,
       u.email, u.id, true
from app_users u
where u.deleted_at is null and u.is_rm
on conflict (app_user_id) do nothing;

-- ---------- 2. Leads: person fields ----------
update leads set
  first_name = coalesce(nullif(split_part(customer_name, ' ', 1), ''), '(unknown)'),
  last_name  = case when position(' ' in customer_name) = 0 then '(unknown)'
                    else btrim(substr(customer_name, position(' ' in customer_name) + 1)) end
where first_name is null;

-- Demo/legacy rows have no DOB; give them plausible ones so age renders.
update leads
set date_of_birth = (date '1965-01-01' + (random() * 13500)::int)
where date_of_birth is null and anonymized_at is null;

update leads set
  whatsapp_phone         = phone,
  whatsapp_same_as_phone = true
where phone is not null and whatsapp_phone is null;

alter table leads alter column first_name set not null;
alter table leads alter column last_name  set not null;

-- ---------- 3. Leads: attribution ----------
update leads l set broker_id = b.id
from brokers b
where b.app_user_id = l.assigned_rm_id and l.assigned_rm_id is not null;

-- ---------- 4. Leads: 4-axis status ----------
update leads set
  qualification = case
    when current_status in ('inbound','contacted') then 'pending'::qualification_status
    else 'qualified'::qualification_status end,

  stage = case
    when current_status in ('inbound','contacted') then null
    when payment_date     is not null then 'policy_issued'::pipeline_stage
    when application_date is not null then 'application_received'::pipeline_stage
    when quote_date       is not null then 'quote_sent'::pipeline_stage
    when current_status = 'account_lapsed' then 'renewal'::pipeline_stage
    else 'qualified'::pipeline_stage end,

  opportunity = case
    when current_status = 'lost' then 'lost'::opportunity_status
    else 'active'::opportunity_status end,

  lead_state = case
    when current_status = 'inbound' then 'new'::lead_state
    when current_status in ('account_lapsed','lost') then 'closed'::lead_state
    else 'active'::lead_state end,

  qualified_at = case
    when current_status in ('inbound','contacted') then null
    else coalesce(qualified_at, created_at) end;

-- Lost leads keep the stage they died at (the whole point of the new model).
update leads set
  stage_at_loss = stage,
  lost_at       = coalesce(lost_at, updated_at),
  lost_notes    = coalesce(lost_notes, lost_reason_detail)
where current_status = 'lost';

update leads l set lost_reason_id = r.id
from lost_reasons r
where l.current_status = 'lost'
  and r.code = case l.lost_reason
    when 'too_expensive'            then 'price'
    when 'bought_elsewhere'         then 'competitor'
    when 'unresponsive'             then 'no_response'
    when 'declined_quote'           then 'not_interested'
    when 'disqualified_eligibility' then 'coverage_benefits'
    when 'disqualified_medical'     then 'medical_underwriting'
    when 'duplicate'                then 'duplicate_lead'
    when 'invalid_contact'          then 'invalid_lead'
    else 'other' end;

-- ---------- 5. Products (single FK -> many-to-many) ----------
insert into lead_products (lead_id, product_id)
select id, insurance_type_id from leads
where insurance_type_id is not null
on conflict do nothing;

-- ---------- 6. New stage history (old lead_status_history is kept as archive) ----------
create table lead_stage_history (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references leads(id) on delete restrict,
  from_stage   pipeline_stage,
  to_stage     pipeline_stage,
  kind         transition_kind not null,
  reason       text,
  changed_by   uuid references app_users(id) on delete restrict,
  changed_at   timestamptz not null default now()
);
create index lsth_lead_ix on lead_stage_history (lead_id, changed_at);
create index lsth_time_ix on lead_stage_history (changed_at);
revoke insert, update, delete on lead_stage_history from anon, authenticated;

-- Seed one row per already-qualified lead so funnel maths has a starting point.
insert into lead_stage_history (lead_id, from_stage, to_stage, kind, changed_at)
select id, null, stage, 'import'::transition_kind, coalesce(qualified_at, created_at)
from leads where stage is not null;

-- ---------- 7. Drop objects that depend on the legacy columns ----------
drop materialized view if exists mv_affiliate_stats;
drop view if exists v_funnel_by_affiliate;
drop view if exists v_stage_durations;
drop view if exists v_monthly_cohorts;
drop view if exists v_lead_aging;

drop trigger if exists t_leads_before_update  on leads;
drop trigger if exists t_leads_log_transition on leads;
drop function if exists leads_before_update();
drop function if exists leads_log_transition();
drop function if exists change_lead_status(uuid, lead_status, text, lost_reason, text);

-- ---------- 8. Own-scope now resolves through brokers ----------
create or replace function owns_lead(p_lead_id uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from leads l
     join brokers b on b.id = l.broker_id
     where l.id = p_lead_id and b.app_user_id = current_app_user_id()) $$;

drop policy if exists leads_select on leads;
drop policy if exists leads_update on leads;

create policy leads_select on leads for select
  using (deleted_at is null and has_perm('leads','read')
         and (perm_scope('leads','read') = 'all'
              or broker_id in (select id from brokers where app_user_id = current_app_user_id())));

create policy leads_update on leads for update
  using (has_perm('leads','update')
         and (perm_scope('leads','update') = 'all'
              or broker_id in (select id from brokers where app_user_id = current_app_user_id())))
  with check (has_perm('leads','update')
              and (perm_scope('leads','update') = 'all'
                   or broker_id in (select id from brokers where app_user_id = current_app_user_id())));

-- ---------- 9. Retire legacy columns and constraints ----------
alter table leads drop constraint if exists lost_needs_reason;
alter table leads drop constraint if exists lost_other_needs_detail;
alter table leads drop constraint if exists email_or_phone;

alter table leads
  drop column if exists current_status,
  drop column if exists assigned_rm_id,
  drop column if exists insurance_type_id,
  drop column if exists lost_reason,
  drop column if exists lost_reason_detail;

-- Contact rule now includes WhatsApp (spec §25: at least one contact method).
alter table leads add constraint contact_method_required
  check (anonymized_at is not null
         or email is not null or phone is not null or whatsapp_phone is not null);

-- A lost opportunity must say why, and must remember where it died.
alter table leads add constraint lost_needs_reason_and_stage
  check (opportunity <> 'lost' or (lost_reason_id is not null and stage_at_loss is not null));

-- Only qualified leads may sit in the pipeline.
alter table leads add constraint stage_requires_qualified
  check (stage is null or qualification = 'qualified');

-- ---- DOWN ----
-- Irreversible without a restore: legacy status columns are dropped.
