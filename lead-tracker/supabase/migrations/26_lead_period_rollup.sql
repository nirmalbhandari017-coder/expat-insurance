-- ============================================================================
-- 26_lead_period_rollup
-- Analytics and the dashboard used to fetch every lead in the period and count
-- them in the app. PostgREST caps a response at 1,000 rows, so above that the
-- figures were silently computed from a partial set. This does the counting in
-- the database and returns one small jsonb value, which no row cap applies to.
--
-- SECURITY INVOKER on purpose: the caller's RLS on `leads` still applies, so a
-- CRM or affiliate login only ever aggregates the leads it is allowed to see.
-- ============================================================================

-- ---- UP ----
create or replace function lead_period_rollup(p_from timestamptz, p_to timestamptz)
  returns jsonb
  language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(g), '[]'::jsonb)
  from (
    select affiliate_id,
           qualification,
           stage,
           opportunity,
           stage_at_loss,
           to_char(date_trunc('month', created_at at time zone 'UTC'), 'YYYY-MM') as month,
           count(*)::int as n
    from leads
    where deleted_at is null
      and created_at >= p_from
      and created_at <= p_to
    group by 1, 2, 3, 4, 5, 6
  ) g;
$$;

revoke all on function lead_period_rollup(timestamptz, timestamptz) from public, anon;
grant execute on function lead_period_rollup(timestamptz, timestamptz) to authenticated;

-- ---- DOWN ----
-- drop function if exists lead_period_rollup(timestamptz, timestamptz);
