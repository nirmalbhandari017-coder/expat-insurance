-- ============================================================================
-- 23_aging_exclude_policy_issued
-- "Needs Attention" was surfacing leads sitting in 'policy_issued'. A policy
-- that has been issued is a completed sale, not work waiting on someone, so
-- ageing there is meaningless and it crowds out the leads that DO need chasing.
--
-- 'renewal' is deliberately NOT excluded: a policy approaching renewal is
-- genuinely actionable, so it should still age.
--
-- Only the WHERE clause changes; the column list is identical to 17, so no
-- application code or generated types are affected.
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
  and (stage is distinct from 'policy_issued')   -- <-- completed sales excluded
  and stage_entered_at <= now() - interval '3 days';

-- ---- DOWN ----
-- create or replace view v_lead_aging with (security_invoker = on) as
-- select id, lead_code, customer_name, affiliate_id, broker_id, qualification, stage,
--        stage_entered_at, now() - stage_entered_at as time_in_stage
-- from leads
-- where deleted_at is null
--   and opportunity = 'active'
--   and lead_state <> 'closed'
--   and stage_entered_at <= now() - interval '3 days';
