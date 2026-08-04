-- ============================================================================
-- 06_owner_profit_distribution
--
-- "Chris and Nirmal get paid on every client, so after deducting the CRM, Chris
-- and Nirmal will be given profit." (2nd changes, item 3.) "CRM" here means the
-- Client Relationship Manager — the person handling the client, e.g. Simon —
-- not the software.
--
-- Owners are therefore paid from what is LEFT after the premium-basis payouts,
-- which is a different basis from everyone else and must be calculated after
-- those payouts exist:
--
--     distributable = commission on the instalment − premium/fixed payouts
--
-- Four latent NOT NULL constraints from the original schema surfaced here,
-- because these code paths had never actually run until real premiums were
-- recorded:
--   * payouts.commission_id  — payouts are now driven by the premium instalment
--                              and can exist before the commission settles.
--   * payouts.consultant_id  — owners like Nirmal were never consultants, so
--                              this blocked every owner distribution outright.
--   * record_premium_payment returned untyped text for an enum column.
--   * ON CONFLICT against a partial unique index needs its predicate restated.
--
-- Rounding: splitting a $464.61 pot 50/50 rounds to $232.31 each, which is a
-- cent more than exists. The final recipient (ordered by name, so it is
-- deterministic) absorbs the remainder, so shares always sum exactly to the pot.
-- ============================================================================

-- ---- UP ----

alter table payouts alter column commission_id  drop not null;
alter table payouts alter column consultant_id drop not null;

alter table payouts add constraint payout_has_a_source
  check (commission_id is not null or premium_payment_id is not null);
alter table payouts add constraint payout_has_a_recipient
  check (person_id is not null or consultant_id is not null);

/** Commission on this instalment, less whatever the premium-earners take. */
create or replace function distributable_profit(p_installment_id uuid)
returns numeric language sql stable set search_path = public as $$
  select greatest(
    coalesce((select cm.expected_amount from commissions cm
              where cm.premium_payment_id = p_installment_id), 0)
    - coalesce((select sum(p.gross_amount) from payouts p
                where p.premium_payment_id = p_installment_id
                  and p.basis in ('premium', 'fixed')
                  and p.status <> 'cancelled'), 0),
    0) $$;

create or replace function generate_owner_payouts(p_installment_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  pp        premium_payments%rowtype;
  s         app_settings%rowtype;
  r         record;
  pot       numeric;
  allocated numeric := 0;
  remaining int;
  gross     numeric;
  wht       numeric;
  tax       numeric;
  v_cm      uuid;
  made      int := 0;
begin
  select * into pp from premium_payments where id = p_installment_id;
  if not found or pp.amount_received <= 0 or pp.status = 'cancelled' then return 0; end if;
  select * into s from app_settings where id = 1;

  pot := distributable_profit(p_installment_id);
  if pot <= 0 then return 0; end if;

  select id into v_cm from commissions where premium_payment_id = p_installment_id;

  select count(*) into remaining
  from client_payout_rules cpr join people p on p.id = cpr.person_id
  where cpr.client_id = pp.client_id and cpr.enabled and p.active and cpr.basis = 'profit';

  for r in
    select cpr.person_id, cpr.payout_pct, p.full_name,
           p.withholding_applies,
           coalesce(p.withholding_pct_override, s.default_withholding_pct) as wht_pct
    from client_payout_rules cpr
    join people p on p.id = cpr.person_id
    where cpr.client_id = pp.client_id
      and cpr.enabled and p.active
      and cpr.basis = 'profit'
    order by p.full_name
  loop
    remaining := remaining - 1;

    -- The final recipient takes what is left, so shares sum exactly to the pot.
    if remaining = 0 then gross := pot - allocated;
    else gross := round(pot * r.payout_pct / 100, 2); end if;

    if gross is null or gross = 0 then continue; end if;
    allocated := allocated + gross;

    wht := case when r.withholding_applies then coalesce(r.wht_pct, 0) else 0 end;
    tax := round(gross * wht / 100, 2);

    insert into payouts (commission_id, premium_payment_id, person_id, consultant_id,
                         basis, payout_pct, basis_amount,
                         gross_amount, tax_pct, tax_amount, net_amount, currency,
                         fx_rate_to_usd, fx_rate_to_thb, amount_usd, amount_thb,
                         due_date, status)
    select v_cm, pp.id, r.person_id,
           (select consultant_id from people where id = r.person_id),
           'profit', r.payout_pct, pot,
           gross, wht, tax, gross - tax, pp.currency,
           coalesce(pp.fx_rate_to_usd, default_fx_rate()),
           coalesce(pp.fx_rate_to_thb, default_fx_rate()),
           fx_to_usd(gross - tax, pp.currency, coalesce(pp.fx_rate_to_usd, default_fx_rate())),
           fx_to_thb(gross - tax, pp.currency, coalesce(pp.fx_rate_to_thb, default_fx_rate())),
           coalesce(pp.received_date, current_date),
           'due'::payout_status
    on conflict (premium_payment_id, person_id)
      where premium_payment_id is not null and person_id is not null
    do update
      set basis_amount = excluded.basis_amount,
          gross_amount = excluded.gross_amount,
          tax_amount   = excluded.tax_amount,
          net_amount   = excluded.net_amount,
          amount_usd   = excluded.amount_usd,
          amount_thb   = excluded.amount_thb
      where payouts.status <> 'paid';   -- never rewrite money already sent

    made := made + 1;
  end loop;

  return made;
end $$;

-- Recording a premium settles the premium-basis payouts first, then
-- distributes whatever profit remains to the owners.
create or replace function record_premium_payment(
  p_installment_id uuid,
  p_amount         numeric,
  p_received_date  date    default current_date,
  p_fx_rate        numeric default null
) returns premium_payments language plpgsql security invoker set search_path = public as $$
declare pp premium_payments%rowtype; rate numeric;
begin
  rate := coalesce(p_fx_rate, default_fx_rate());

  update premium_payments set
    amount_received = p_amount,
    received_date   = case when p_amount > 0 then p_received_date else null end,
    fx_rate_to_usd  = rate,
    fx_rate_to_thb  = rate,
    amount_usd      = fx_to_usd(p_amount, currency, rate),
    amount_thb      = fx_to_thb(p_amount, currency, rate),
    status          = case
                        when p_amount <= 0          then 'scheduled'::installment_status
                        when p_amount >= amount_due then 'paid'::installment_status
                        else 'partially_paid'::installment_status end
  where id = p_installment_id
  returning * into pp;

  if pp.id is null then
    raise exception 'Instalment not found or not permitted' using errcode = 'no_data_found';
  end if;

  perform generate_payouts_for_installment(pp.id);  -- premium / fixed first
  perform generate_owner_payouts(pp.id);            -- then split what is left
  return pp;
end $$;

revoke execute on function generate_owner_payouts(uuid) from public, anon;
revoke execute on function distributable_profit(uuid)   from public, anon;
grant  execute on function generate_owner_payouts(uuid) to authenticated;
grant  execute on function distributable_profit(uuid)   to authenticated;
