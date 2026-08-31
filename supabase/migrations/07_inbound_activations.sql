-- ============================================================================
-- 07_inbound_activations
--
-- Closes the loop between Regency's activation emails and the CRM.
--
-- Until now the Apps Script filed documents to Drive and emailed a digest, but
-- a person still had to read each Certificate of Insurance and type the client
-- in by hand. That step stopped happening on 3 Aug and four clients went
-- unrecorded for three weeks — the automation looked healthy the whole time
-- because notifying was all it ever did.
--
-- The script now parses each certificate and writes it here. Nothing is
-- imported automatically: a row lands as 'new' and a person reviews the
-- figures against the certificate before pressing Import. Regency's numbers
-- have needed correcting before (premiums, dates, and commission rates that
-- vary per client), so a staging step that shows the parse before it becomes
-- money is worth the extra click.
--
-- import_activation() exists because the call order is a trap. Owner payouts
-- read the commission row to size the profit pot, so recording the premium
-- before the commission exists silently pays nobody — no error, just a client
-- with a commission and no payouts. Encoding the order here means it cannot be
-- got wrong again.
-- ============================================================================

-- ---- UP ----

create table if not exists inbound_activations (
  id                uuid primary key default gen_random_uuid(),
  policy_number     text not null unique,
  client_name       text,
  plan_name         text,
  commencement_date date,
  premium           numeric(12,2),
  currency          currency_code not null default 'USD',
  frequency         pay_frequency,
  -- The activation email means the premium is already paid; its date is the
  -- best evidence of when. It is NOT the policy start date — Regency has sent
  -- one two and a half months ahead of commencement.
  email_date        date,
  source_file_id    text,
  raw_text          text,
  parse_warnings    text[],
  status            text not null default 'new'
                    check (status in ('new', 'imported', 'ignored')),
  client_id         uuid references clients (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists inbound_activations_status_ix
  on inbound_activations (status, email_date desc);

drop trigger if exists t_touch_inbound_activations on inbound_activations;
create trigger t_touch_inbound_activations before update on inbound_activations
  for each row execute function touch_updated_at();

alter table inbound_activations enable row level security;

drop policy if exists inbound_activations_admin_all  on inbound_activations;
drop policy if exists inbound_activations_staff_read on inbound_activations;
create policy inbound_activations_admin_all on inbound_activations for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy inbound_activations_staff_read on inbound_activations for select
  using (my_role() in ('admin', 'bookkeeper'));

/**
 * Turn a reviewed activation into a client, in the one order that works.
 *
 * The commission rate cannot be derived from the certificate — Regency sets it
 * per client, not per plan (Sharifah Scarth and Julie Raxworthy hold the same
 * ES20 policy at 25.5% and 37.5%). It defaults to the standard 37.5% and is
 * meant to be checked against the next commission statement.
 */
create or replace function import_activation(
  p_activation_id  uuid,
  p_commission_pct numeric default 37.50
) returns clients language plpgsql security invoker set search_path = public as $$
declare
  a         inbound_activations%rowtype;
  v_client  clients%rowtype;
  v_inst    uuid;
  v_owners  int;
  v_perYear int;
begin
  select * into a from inbound_activations where id = p_activation_id;
  if not found then
    raise exception 'Activation not found' using errcode = 'no_data_found';
  end if;
  if a.status = 'imported' then
    raise exception 'Already imported as client %', a.client_id using errcode = 'unique_violation';
  end if;
  if a.premium is null or a.premium <= 0 or a.commencement_date is null then
    raise exception 'Refusing to import without a premium and a commencement date'
      using errcode = 'check_violation';
  end if;

  insert into clients (name, product_type, policy_number, premium, currency,
                       commission_pct, frequency, start_date, status)
  values (a.client_name, a.plan_name, a.policy_number, a.premium, a.currency,
          p_commission_pct, coalesce(a.frequency, 'annual'), a.commencement_date, 'active')
  returning * into v_client;

  -- Owners split the profit evenly. Matching every other client rather than
  -- inventing a per-client rule the importer has no way to know.
  select count(*) into v_owners from people where is_owner and active;
  if v_owners > 0 then
    insert into client_payout_rules (client_id, person_id, basis, payout_pct, enabled)
    select v_client.id, p.id, 'profit', round(100.0 / v_owners, 4), true
      from people p where p.is_owner and p.active;
  end if;

  perform generate_premium_schedule(v_client.id, 2);

  v_perYear := case coalesce(a.frequency, 'annual')
                 when 'monthly' then 12 when 'quarterly' then 4
                 when 'semi_annual' then 2 else 1 end;

  select id into v_inst from premium_payments
   where client_id = v_client.id and installment_no = 1;

  -- Only the first instalment is paid; the certificate premium is annualised.
  perform record_premium_payment(v_inst,
                                 round(a.premium / v_perYear, 2),
                                 coalesce(a.email_date, current_date),
                                 null);

  -- Order matters: the commission must exist before the profit pot can be
  -- sized, and record_premium_payment above ran too early to see it.
  perform generate_due_commissions(400);
  perform generate_owner_payouts(v_inst);

  update inbound_activations
     set status = 'imported', client_id = v_client.id
   where id = p_activation_id;

  return v_client;
end $$;

revoke execute on function import_activation(uuid, numeric) from public, anon;
grant  execute on function import_activation(uuid, numeric) to authenticated;

-- ---- DOWN ----
-- drop function if exists import_activation(uuid, numeric);
-- drop table if exists inbound_activations;
