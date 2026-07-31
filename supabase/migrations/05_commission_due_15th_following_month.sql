-- ============================================================================
-- 05_commission_due_15th_following_month
--
-- Regency pay commission by the 15th of the month FOLLOWING receipt of the
-- premium. Confirmed against Brett Wilson: premium received 30 Jun 2026, and
-- the commission appeared on the Jul-2026 statement emailed on 16 Jul.
--
-- Commissions were previously generated from the client's start date on the
-- billing cadence. That was wrong in both timing and meaning: a policy showed
-- its commission as OVERDUE the moment cover began, when in reality nothing was
-- payable until the following month. Five newly imported policies all showed as
-- overdue on the day they were added, which is alarming and false.
--
-- Commission is now derived from the premium instalment ledger — one commission
-- per instalment, dated the 15th of the month after that instalment is
-- received (or, until it arrives, after it falls due). That gives a single
-- source of truth for what is owed and when.
-- ============================================================================

-- ---- UP ----

alter table commissions
  add column if not exists premium_payment_id uuid references premium_payments (id) on delete cascade;

create unique index if not exists commissions_premium_payment_uq
  on commissions (premium_payment_id) where premium_payment_id is not null;

/** 15th of the month after the given date. */
create or replace function commission_due_date(p_paid_on date)
returns date language sql immutable set search_path = public as $$
  select (date_trunc('month', p_paid_on) + interval '1 month' + interval '14 days')::date $$;

create or replace function generate_due_commissions(horizon_days int default 400)
returns int language plpgsql security definer set search_path = public as $$
declare
  pp record;
  v_due date;
  v_amount numeric;
  horizon date := current_date + horizon_days;
  inserted int := 0;
begin
  if my_role() not in ('admin', 'bookkeeper') then
    raise exception 'not allowed';
  end if;

  for pp in
    select p.*, c.commission_pct, c.currency as client_currency
    from premium_payments p
    join clients c on c.id = p.client_id
    where c.status = 'active'
      and c.commission_pct > 0
      and p.status <> 'cancelled'
      and p.amount_due > 0
  loop
    -- Payable the month after the premium actually arrives; until it does,
    -- project from the date it is due.
    v_due := commission_due_date(coalesce(pp.received_date, pp.due_date));
    if v_due > horizon then continue; end if;

    v_amount := round(pp.amount_due * pp.commission_pct / 100, 2);

    -- The unique index is partial, so its predicate has to be restated here
    -- for Postgres to infer the conflict target.
    insert into commissions (client_id, premium_payment_id, due_date, expected_amount, currency)
    values (pp.client_id, pp.id, v_due, v_amount, pp.client_currency)
    on conflict (premium_payment_id) where premium_payment_id is not null
    do update
      set due_date        = excluded.due_date,
          expected_amount = excluded.expected_amount
      where commissions.status <> 'received';   -- never touch settled money

    inserted := inserted + 1;
  end loop;

  update commissions set status = 'overdue'
    where status = 'pending' and due_date < current_date;
  update commissions set status = 'pending'
    where status = 'overdue' and due_date >= current_date;

  return inserted;
end;
$$;
