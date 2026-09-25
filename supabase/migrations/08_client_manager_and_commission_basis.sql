-- ============================================================================
-- 08_client_manager_and_commission_basis
--
-- The payout model, as stated by the owner:
--
--     Simon   10% of the premium received, on the clients that are his
--     Jay     20% of the commission received
--     Chris and Nirmal split whatever is left
--
-- Three things stood in the way.
--
-- 1. The 'commission' basis existed in the enum but was implemented nowhere.
--    generate_payouts_for_installment only handled 'premium' and 'fixed', and
--    distributable_profit only subtracted those two. A 20%-of-commission rule
--    would have paid Jay nothing AND left his share inside the pot Chris and
--    Nirmal divide — wrong twice over, and silently.
--
-- 2. Assigning a client to a manager had to be done by hand in SQL.
--    set_client_manager does it atomically and rebuilds the money behind it.
--
-- 3. on_commission_received still generated payouts from client_consultants,
--    the model superseded by client_payout_rules. Marking a commission
--    received would have added a second, overlapping set of payouts on top of
--    the ones already generated when the premium arrived — Julie Raxworthy's
--    August split went wrong exactly this way. The trigger keeps the tax
--    reserve and stops paying anyone.
-- ============================================================================

-- ---- UP ----

/** Commission on the instalment, less everyone paid ahead of the owners. */
create or replace function distributable_profit(p_installment_id uuid)
returns numeric language sql stable set search_path = public as $$
  select greatest(
    coalesce((select cm.expected_amount from commissions cm
              where cm.premium_payment_id = p_installment_id), 0)
    - coalesce((select sum(p.gross_amount) from payouts p
                where p.premium_payment_id = p_installment_id
                  and p.basis in ('premium', 'fixed', 'commission')
                  and p.status <> 'cancelled'), 0),
    0) $$;

create or replace function generate_payouts_for_installment(p_installment_id uuid)
returns integer language plpgsql security definer set search_path = public as $function$
declare
  pp     premium_payments%rowtype;
  s      app_settings%rowtype;
  r      record;
  gross  numeric;
  wht    numeric;
  tax    numeric;
  v_cm   uuid;
  v_comm numeric;
  made   int := 0;
begin
  select * into pp from premium_payments where id = p_installment_id;
  if not found then raise exception 'Instalment not found'; end if;
  select * into s from app_settings where id = 1;

  if pp.amount_received <= 0 or pp.status = 'cancelled' then return 0; end if;

  select id, expected_amount into v_cm, v_comm
    from commissions where premium_payment_id = p_installment_id;

  for r in
    select cpr.person_id, cpr.basis, cpr.payout_pct, cpr.fixed_amount,
           p.withholding_applies,
           coalesce(p.withholding_pct_override, s.default_withholding_pct) as wht_pct
    from client_payout_rules cpr
    join people p on p.id = cpr.person_id
    where cpr.client_id = pp.client_id
      and cpr.enabled and p.active
      and cpr.basis in ('premium', 'fixed', 'commission')
  loop
    gross := case r.basis
               when 'fixed'      then r.fixed_amount
               -- A share of the commission this instalment earns, not of the
               -- premium and not of a whole year's commission.
               when 'commission' then round(coalesce(v_comm, 0) * r.payout_pct / 100, 2)
               else                   round(pp.amount_received * r.payout_pct / 100, 2)
             end;
    if gross is null or gross = 0 then continue; end if;

    wht := case when r.withholding_applies then coalesce(r.wht_pct, 0) else 0 end;
    tax := round(gross * wht / 100, 2);

    insert into payouts (commission_id, premium_payment_id, person_id, consultant_id,
                         basis, payout_pct, basis_amount,
                         gross_amount, tax_pct, tax_amount, net_amount, currency,
                         fx_rate_to_usd, fx_rate_to_thb, amount_usd, amount_thb,
                         due_date, status)
    select v_cm, pp.id, r.person_id,
           (select consultant_id from people where id = r.person_id),
           r.basis, r.payout_pct,
           case r.basis when 'commission' then coalesce(v_comm, 0) else pp.amount_received end,
           gross, wht, tax, gross - tax, pp.currency,
           coalesce(pp.fx_rate_to_usd, default_fx_rate()),
           coalesce(pp.fx_rate_to_thb, default_fx_rate()),
           fx_to_usd(gross - tax, pp.currency, coalesce(pp.fx_rate_to_usd, default_fx_rate())),
           fx_to_thb(gross - tax, pp.currency, coalesce(pp.fx_rate_to_thb, default_fx_rate())),
           coalesce(pp.received_date, current_date),
           'due'::payout_status
    on conflict (premium_payment_id, person_id)
      where premium_payment_id is not null and person_id is not null
    do update set
      basis        = excluded.basis,
      payout_pct   = excluded.payout_pct,
      basis_amount = excluded.basis_amount,
      gross_amount = excluded.gross_amount,
      tax_pct      = excluded.tax_pct,
      tax_amount   = excluded.tax_amount,
      net_amount   = excluded.net_amount,
      amount_usd   = excluded.amount_usd,
      amount_thb   = excluded.amount_thb
      where payouts.status <> 'paid';   -- never rewrite money already sent

    made := made + 1;
  end loop;

  return made;
end $function$;

/**
 * Recalculate every payout for a client from its current rules.
 *
 * Unpaid payouts are cleared first, so removing someone's rule actually
 * removes their money rather than stranding it. Anything already paid is left
 * alone and still counts against the profit pot.
 */
create or replace function rebuild_client_payouts(p_client_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  delete from payouts po
   using premium_payments pp
   where pp.id = po.premium_payment_id
     and pp.client_id = p_client_id
     and po.status <> 'paid';

  for r in
    select id from premium_payments
     where client_id = p_client_id and amount_received > 0 and status <> 'cancelled'
     order by installment_no
  loop
    perform generate_payouts_for_installment(r.id);  -- premium / fixed / commission
    perform generate_owner_payouts(r.id);            -- then whatever is left
    n := n + 1;
  end loop;

  return n;
end $$;

/**
 * Give a client a relationship manager, or take one away.
 *
 * A client has at most one manager, so the previous premium-basis rule is
 * replaced rather than added to. Passing null clears it.
 */
create or replace function set_client_manager(
  p_client_id uuid,
  p_person_id uuid,
  p_pct       numeric default 10
) returns int language plpgsql security invoker set search_path = public as $$
begin
  delete from client_payout_rules
   where client_id = p_client_id and basis = 'premium';

  if p_person_id is not null then
    insert into client_payout_rules (client_id, person_id, basis, payout_pct, enabled)
    values (p_client_id, p_person_id, 'premium', p_pct, true);
  end if;

  return rebuild_client_payouts(p_client_id);
end $$;

-- The payout half of this trigger belongs to the pre-rebuild consultant model
-- and now double-pays. Tax reserve stays; paying people does not.
create or replace function on_commission_received()
returns trigger language plpgsql security definer set search_path = public as $$
declare s app_settings%rowtype;
begin
  select * into s from app_settings where id = 1;

  if new.status = 'received' and old.status <> 'received' then
    if new.received_amount is null then new.received_amount := new.expected_amount; end if;
    if new.received_date is null then new.received_date := current_date; end if;
    new.tax_reserve_pct    := s.incoming_tax_reserve_pct;
    new.tax_reserve_amount := round(new.received_amount * s.incoming_tax_reserve_pct / 100, 2);
    -- Payouts are generated when the premium is received, from
    -- client_payout_rules. Generating more here would pay twice.
  end if;

  if old.status = 'received' and new.status <> 'received' then
    new.received_date      := null;
    new.received_amount    := null;
    new.tax_reserve_pct    := null;
    new.tax_reserve_amount := null;
  end if;

  return new;
end $$;

revoke execute on function set_client_manager(uuid, uuid, numeric)  from public, anon;
revoke execute on function rebuild_client_payouts(uuid)             from public, anon;
grant  execute on function set_client_manager(uuid, uuid, numeric)  to authenticated;
grant  execute on function rebuild_client_payouts(uuid)             to authenticated;
