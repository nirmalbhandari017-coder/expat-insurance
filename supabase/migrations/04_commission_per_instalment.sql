-- ============================================================================
-- 04_commission_per_instalment
--
-- generate_due_commissions() applied the commission rate to the FULL ANNUAL
-- premium on every billing cycle. That is only correct for annual payers.
--
-- The first monthly client (imported from a Regency certificate showing
-- "Payment Frequency: Monthly") would have generated twelve commission rows
-- each holding the entire year's commission — overstating expected income from
-- that client by a factor of twelve, and feeding a wrong number into the
-- dashboard, the reports and every downstream payout calculation.
--
-- Commission follows the money: it is earned per instalment received. The
-- expected amount is now the instalment share, consistent with how
-- generate_premium_schedule() already divides the premium.
-- ============================================================================

-- ---- UP ----
create or replace function generate_due_commissions(horizon_days int default 60)
returns int language plpgsql security definer set search_path = public as $$
declare
  c record;
  next_due date;
  step interval;
  per_year int;
  per_cycle numeric;
  horizon date := current_date + horizon_days;
  inserted int := 0;
begin
  if my_role() not in ('admin', 'bookkeeper') then
    raise exception 'not allowed';
  end if;

  for c in
    select * from clients
    where status = 'active' and premium > 0 and commission_pct > 0
  loop
    per_year := case c.frequency
      when 'monthly' then 12 when 'quarterly' then 4
      when 'semi_annual' then 2 when 'annual' then 1 end;

    step := case c.frequency
      when 'monthly' then interval '1 month'
      when 'quarterly' then interval '3 months'
      when 'semi_annual' then interval '6 months'
      when 'annual' then interval '1 year' end;

    -- The commission due on ONE instalment, not on the whole year.
    per_cycle := round(c.premium / per_year * c.commission_pct / 100, 2);

    select coalesce(max(due_date), null) into next_due
      from commissions where client_id = c.id;

    if next_due is null then
      next_due := c.start_date;
    else
      next_due := (next_due + step)::date;
    end if;

    while next_due <= horizon loop
      insert into commissions (client_id, due_date, expected_amount, currency)
      values (c.id, next_due, per_cycle, c.currency)
      on conflict (client_id, due_date) do nothing;
      inserted := inserted + 1;
      next_due := (next_due + step)::date;
    end loop;
  end loop;

  update commissions set status = 'overdue'
    where status = 'pending' and due_date < current_date;
  update commissions set status = 'pending'
    where status = 'overdue' and due_date >= current_date;

  return inserted;
end;
$$;
