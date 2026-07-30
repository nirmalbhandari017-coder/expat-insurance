-- ============================================================================
-- 03_skip_zero_premium_clients
--
-- generate_due_commissions() computes expected_amount at the moment a row is
-- created and then leaves it alone (`on conflict do nothing`). So a client
-- whose premium had not been entered yet would generate a run of $0.00
-- commissions that never corrected themselves once the real premium arrived —
-- silently wrong figures sitting in the ledger.
--
-- This came up importing five live policies from Regency's activation emails:
-- the emails confirm the client and policy number but carry no premium, so the
-- records legitimately exist in an incomplete state for a while.
--
-- Incomplete clients are now skipped until there is something real to
-- calculate from.
-- ============================================================================

-- ---- UP ----
create or replace function generate_due_commissions(horizon_days int default 60)
returns int language plpgsql security definer set search_path = public as $$
declare
  c record;
  next_due date;
  step interval;
  horizon date := current_date + horizon_days;
  inserted int := 0;
begin
  if my_role() not in ('admin', 'bookkeeper') then
    raise exception 'not allowed';
  end if;

  for c in
    select * from clients
    where status = 'active'
      and premium > 0            -- incomplete records are left alone
      and commission_pct > 0
  loop
    step := case c.frequency
      when 'monthly' then interval '1 month'
      when 'quarterly' then interval '3 months'
      when 'semi_annual' then interval '6 months'
      when 'annual' then interval '1 year'
    end;

    select coalesce(max(due_date), null) into next_due
      from commissions where client_id = c.id;

    if next_due is null then
      next_due := c.start_date;
    else
      next_due := (next_due + step)::date;
    end if;

    while next_due <= horizon loop
      insert into commissions (client_id, due_date, expected_amount, currency)
      values (c.id, next_due, round(c.premium * c.commission_pct / 100, 2), c.currency)
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
