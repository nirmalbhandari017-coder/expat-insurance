-- ============================================================================
-- 21_source_self_view  (spec §7)
-- Exposes to a Source ONLY its own affiliate row (name + commission %). The
-- WHERE clause restricts to the caller's linked affiliate via my_affiliate_ids(),
-- so a definer view can never leak another source's data.
-- ============================================================================

-- ---- UP ----
create or replace view v_my_source with (security_invoker = off) as
select id, name, commission_pct, country, is_active
from affiliates
where deleted_at is null
  and id in (select my_affiliate_ids());
grant select on v_my_source to authenticated;

-- ---- DOWN ----
-- drop view if exists v_my_source;
