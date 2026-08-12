-- ============================================================================
-- 22_analytics_isolation  (spec §9, §13)
-- The all-affiliate analytics rollups were security_invoker=off (bypass RLS),
-- so an external user could read every org's aggregate numbers. Lock them down
-- BEFORE any external login is provisioned.
-- ============================================================================

-- ---- UP ----
create or replace function is_internal() returns boolean
  language sql stable security definer set search_path = public as
$$ select app_current_role() in ('admin','business_development','rm_staff','read_only') $$;
revoke execute on function is_internal() from public, anon;

-- Per-entity analytics views now respect RLS (external sees only their own).
alter view v_affiliate_commission set (security_invoker = on);
alter view v_broker_stats         set (security_invoker = on);
alter view v_generator_stats      set (security_invoker = on);
alter view v_funnel_by_affiliate  set (security_invoker = on);
alter view v_monthly_cohorts      set (security_invoker = on);

-- A matview can't be RLS-scoped; gate the rollup to internal roles. Internal
-- pages read it through v_affiliate_stats instead of the matview directly.
revoke select on mv_affiliate_stats from anon, authenticated;
create or replace view v_affiliate_stats with (security_invoker = off) as
  select * from mv_affiliate_stats where is_internal();
grant select on v_affiliate_stats to authenticated;

-- ---- DOWN ----
-- drop view if exists v_affiliate_stats; grant select on mv_affiliate_stats to authenticated;
-- (revert the 5 views to security_invoker=off; drop is_internal)
