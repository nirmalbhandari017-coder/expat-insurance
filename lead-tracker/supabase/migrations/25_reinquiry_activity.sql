-- ============================================================================
-- 25_reinquiry_activity
-- A Source change means the client came back to us through a different
-- affiliate, so say that in the feed rather than the bare "Source changed".
-- Patched inside the existing leads_log_changes trigger (rather than adding a
-- second trigger) so each change still writes exactly one activity row.
-- Also aligns the other summaries with the agreed terms: Agent (not Generator),
-- CRM (not Broker), Squandered (not Lost).
-- ============================================================================

-- ---- UP ----
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

  if new.qualification is distinct from old.qualification then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor,
            case when new.qualification = 'qualified' then 'qualified' else 'disqualified' end,
            new.id, new.affiliate_id,
            'Qualification: ' || old.qualification || ' -> ' || new.qualification,
            old.qualification::text, new.qualification::text);
  end if;

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
            new.lead_code || ': ' || coalesce(old.stage::text,'-') || ' -> ' || coalesce(new.stage::text,'-'),
            old.stage::text, new.stage::text);
  end if;

  if new.opportunity is distinct from old.opportunity then
    if new.opportunity = 'lost' then
      insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
      values (v_actor, 'marked_lost', new.id, new.affiliate_id,
              'Squandered at ' || coalesce(new.stage_at_loss::text,'-') ||
              coalesce(' - ' || (select label from lost_reasons where id = new.lost_reason_id), ''),
              old.stage::text, 'lost');
    else
      insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
      values (v_actor, 'reopened', new.id, new.affiliate_id,
              'Reopened at ' || coalesce(new.stage::text,'-'), 'lost', new.stage::text);
    end if;
  end if;

  -- A new Source on an existing lead = the client re-inquired through them.
  if new.affiliate_id is distinct from old.affiliate_id then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor, 'source_changed', new.id, new.affiliate_id,
            'Re-inquired through ' ||
              coalesce((select name from affiliates where id = new.affiliate_id), 'an unknown source'),
            (select name from affiliates where id = old.affiliate_id),
            (select name from affiliates where id = new.affiliate_id));
  end if;
  if new.generator_id is distinct from old.generator_id then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor, 'generator_changed', new.id, new.affiliate_id, 'Agent changed',
            (select full_name from generators where id = old.generator_id),
            (select full_name from generators where id = new.generator_id));
  end if;
  if new.broker_id is distinct from old.broker_id then
    insert into activity_log(actor_id, kind, lead_id, affiliate_id, summary, old_value, new_value)
    values (v_actor, 'broker_changed', new.id, new.affiliate_id, 'CRM changed',
            (select full_name from brokers where id = old.broker_id),
            (select full_name from brokers where id = new.broker_id));
  end if;

  return new;
end $$;

-- The separate trigger trialled earlier would have double-logged; drop it.
drop trigger if exists t_leads_log_source_change on leads;
drop function if exists leads_log_source_change();

-- ---- DOWN ----
-- Restore the previous summaries ("Source changed", "Generator changed",
-- "Broker changed", "Lost at ...") in leads_log_changes.
