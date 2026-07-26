-- ============================================================================
-- 11_change_status_rpc
-- Atomic status change that passes the transition reason to the validation
-- trigger via a transaction-local GUC. SECURITY INVOKER: RLS (leads_update,
-- RM own-scope) and the before/after triggers all apply as the calling user.
-- ============================================================================

-- ---- UP ----
create or replace function change_lead_status(
  p_lead_id     uuid,
  p_to_status   lead_status,
  p_reason      text        default null,
  p_lost_reason lost_reason default null,
  p_lost_detail text        default null
) returns leads
  language plpgsql security invoker set search_path = public as $$
declare v_row leads;
begin
  -- transaction-local; read by leads_before_update() + leads_log_transition()
  perform set_config('app.transition_reason', coalesce(p_reason, ''), true);

  update leads set
    current_status     = p_to_status,
    lost_reason        = case when p_to_status = 'lost' then p_lost_reason else lost_reason end,
    lost_reason_detail = case when p_to_status = 'lost' then p_lost_detail else lost_reason_detail end
  where id = p_lead_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Lead not found or you do not have permission to update it'
      using errcode = 'no_data_found';
  end if;
  return v_row;
end $$;

revoke execute on function change_lead_status(uuid, lead_status, text, lost_reason, text) from public, anon;
grant  execute on function change_lead_status(uuid, lead_status, text, lost_reason, text) to authenticated;

-- ---- DOWN ----
-- drop function if exists change_lead_status(uuid, lead_status, text, lost_reason, text);
