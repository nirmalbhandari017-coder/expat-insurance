-- ============================================================================
-- 17_aging_3day_threshold  (spec §2)
-- "Needs Attention" = a lead that has sat in its CURRENT pipeline stage for
-- 3 days or more. Aging is measured from leads.stage_entered_at, which a trigger
-- already resets whenever the lead moves stage — so this needs no new columns.
-- security_invoker = on so CRM/Source users (added later) only see their own.
-- ============================================================================

-- ---- UP ----
create or replace view v_lead_aging with (security_invoker = on) as
select id, lead_code, customer_name, affiliate_id, broker_id, qualification, stage,
       stage_entered_at,
       now() - stage_entered_at as time_in_stage
from leads
where deleted_at is null
  and opportunity = 'active'
  and lead_state <> 'closed'
  and stage_entered_at <= now() - interval '3 days';   -- <-- the 3-day rule

-- ---- DOWN ----
-- create or replace view v_lead_aging with (security_invoker = on) as
-- select id, lead_code, customer_name, affiliate_id, broker_id, qualification, stage,
--        stage_entered_at, now() - stage_entered_at as time_in_stage
-- from leads
-- where deleted_at is null and opportunity = 'active' and lead_state <> 'closed';
