-- ============================================================================
-- 02_people_and_payout_engine  (ADDITIVE ONLY — nothing is dropped)
--
-- Implements the 30.07.2026 update: multi-currency, a flexible People/payout
-- recipient model, per-client payout rules (owner splits, referral logic, the
-- Jay toggle), a premium installment ledger, and a financial audit trail.
--
-- Everything here is additive and nullable so the currently deployed app keeps
-- working while the new features are built on top.
--
-- KEY RULE (spec §16): consultant and referral payouts are a percentage of the
-- PREMIUM RECEIVED, not of the company's commission. Owner distributions come
-- out of the company's commission. Those are two different bases, so `basis` is
-- stored on every rule and every payout rather than assumed.
-- ============================================================================

-- ---- UP ----

-- ---------- ENUMS ----------
do $$ begin
  create type payout_basis as enum ('premium', 'commission', 'profit', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type person_role as enum
    ('owner', 'consultant', 'referral_partner', 'lead_generator', 'affiliate', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type installment_status as enum
    ('scheduled', 'paid', 'partially_paid', 'overdue', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type paid_by_kind as enum ('company', 'personal');
exception when duplicate_object then null; end $$;

-- payouts currently use payout_status ('pending','paid'); the spec adds 'due'
-- and 'cancelled'. ALTER TYPE ADD VALUE can't be used in the same transaction
-- as its use, so these live here and are consumed by migration 03.
alter type payout_status add value if not exists 'due';
alter type payout_status add value if not exists 'cancelled';

-- ---------- PEOPLE ----------
-- Generalises `consultants`: owners, consultants, referral partners and any
-- future recipient all live here, so payout logic is never hardcoded to a name.
create table if not exists people (
  id                       uuid primary key default gen_random_uuid(),
  first_name               text not null,
  last_name                text not null default '',
  full_name                text generated always as
                             (btrim(first_name || ' ' || last_name)) stored,
  role                     person_role not null default 'consultant',
  email                    text,
  phone                    text,
  payment_details          text,

  -- Defaults; a client-level rule may override any of these.
  default_payout_pct       numeric(7,4),
  default_basis            payout_basis not null default 'premium',
  default_fixed_amount     numeric(14,2),

  -- Tax is opt-in per person (owners and consultants differ).
  withholding_applies      boolean not null default false,
  withholding_pct_override numeric(7,4),

  -- Set when this person is an owner sharing the company distribution.
  is_owner                 boolean not null default false,

  active                   boolean not null default true,
  notes                    text,
  consultant_id            uuid references consultants (id) on delete set null, -- migration trace
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists people_role_ix   on people (role) where active;
create index if not exists people_owner_ix  on people (is_owner) where active;

-- ---------- LEAD GENERATORS (configurable — spec §4) ----------
create table if not exists lead_generators (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_referral boolean not null default false,   -- drives the Referred By field
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into lead_generators (name, is_referral, sort_order) values
  ('Facebook Message',  false, 10),
  ('Website Inquiry',   false, 20),
  ('Instagram Message', false, 30),
  ('Google Ads',        false, 40),
  ('Referral',          true,  50)
on conflict (name) do nothing;

-- ---------- CLIENTS: attribution ----------
alter table clients
  add column if not exists generator_id   uuid references lead_generators (id) on delete set null,
  add column if not exists referred_by_id uuid references people (id) on delete set null,
  add column if not exists policy_number  text,
  add column if not exists notes_internal text;

-- Referred By only makes sense when the generator is a referral channel.
create index if not exists clients_generator_ix   on clients (generator_id);
create index if not exists clients_referred_by_ix on clients (referred_by_id);

-- ---------- PREMIUM INSTALLMENT LEDGER (spec §7, §8) ----------
-- The client's own payment schedule. Consultant/referral payouts are driven by
-- rows here becoming `paid`, which is what stops a full annual commission from
-- being treated as payable after a single quarterly instalment.
create table if not exists premium_payments (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients (id) on delete cascade,
  installment_no  int  not null,
  due_date        date not null,
  amount_due      numeric(14,2) not null,
  currency        currency_code not null,

  amount_received numeric(14,2) not null default 0,
  received_date   date,

  -- Multi-currency: the original figure is never overwritten (spec §1).
  fx_rate_to_usd  numeric(18,8),
  fx_rate_to_thb  numeric(18,8),
  amount_usd      numeric(14,2),
  amount_thb      numeric(14,2),

  status          installment_status not null default 'scheduled',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id, installment_no)
);
create index if not exists premium_payments_client_ix on premium_payments (client_id, due_date);
create index if not exists premium_payments_status_ix on premium_payments (status, due_date);

-- ---------- PER-CLIENT PAYOUT RULES (spec §2, §3, §5, §6) ----------
-- One row per (client, recipient). `enabled` is what the UI surfaces as the
-- "Jay Payout: Yes/No" toggle, and the owner split is just two enabled rows
-- with basis='commission' — so nothing is hardcoded to a person.
create table if not exists client_payout_rules (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients (id) on delete cascade,
  person_id     uuid not null references people (id)  on delete restrict,
  enabled       boolean not null default true,
  payout_pct    numeric(7,4),
  basis         payout_basis not null default 'premium',
  fixed_amount  numeric(14,2),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, person_id),
  constraint rule_needs_a_figure
    check (basis = 'fixed' and fixed_amount is not null
           or basis <> 'fixed' and payout_pct is not null)
);
create index if not exists client_payout_rules_client_ix on client_payout_rules (client_id) where enabled;

-- ---------- PAYOUTS: extend for the new model ----------
alter table payouts
  add column if not exists person_id          uuid references people (id) on delete restrict,
  add column if not exists premium_payment_id uuid references premium_payments (id) on delete cascade,
  add column if not exists basis              payout_basis,
  add column if not exists payout_pct         numeric(7,4),
  add column if not exists basis_amount       numeric(14,2),  -- the figure the % was applied to
  add column if not exists fx_rate_to_usd     numeric(18,8),
  add column if not exists fx_rate_to_thb     numeric(18,8),
  add column if not exists amount_usd         numeric(14,2),
  add column if not exists amount_thb         numeric(14,2),
  add column if not exists due_date           date,
  add column if not exists notes              text,
  add column if not exists is_override        boolean not null default false;

-- Duplicate prevention (spec §10): one payout per instalment per recipient,
-- and one per commission per recipient.
create unique index if not exists payouts_premium_person_uq
  on payouts (premium_payment_id, person_id)
  where premium_payment_id is not null and person_id is not null;

create unique index if not exists payouts_commission_person_uq
  on payouts (commission_id, person_id)
  where commission_id is not null and person_id is not null and premium_payment_id is null;

create index if not exists payouts_person_ix on payouts (person_id, status);

-- ---------- COMMISSIONS: multi-currency ----------
alter table commissions
  add column if not exists fx_rate_to_usd numeric(18,8),
  add column if not exists fx_rate_to_thb numeric(18,8),
  add column if not exists amount_usd     numeric(14,2),
  add column if not exists amount_thb     numeric(14,2);

-- ---------- EXPENSES: who spent it, and out of whose pocket (spec §12) ----------
alter table expenses
  add column if not exists name              text,
  add column if not exists made_by_person_id uuid references people (id) on delete set null,
  add column if not exists paid_by           paid_by_kind not null default 'company',
  add column if not exists payment_status    text not null default 'paid'
                             check (payment_status in ('paid','unpaid','reimbursed')),
  add column if not exists fx_rate_to_usd    numeric(18,8),
  add column if not exists fx_rate_to_thb    numeric(18,8),
  add column if not exists amount_usd        numeric(14,2),
  add column if not exists amount_thb        numeric(14,2);

create index if not exists expenses_made_by_ix on expenses (made_by_person_id);
create index if not exists expenses_paid_by_ix on expenses (paid_by);

-- ---------- SETTINGS: FX + display preference ----------
alter table app_settings
  add column if not exists default_usd_thb_rate numeric(18,8) not null default 36.50,
  add column if not exists display_currency     currency_code not null default 'USD';

-- ---------- FINANCIAL AUDIT (spec §17) ----------
create table if not exists financial_audit (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,                -- 'payout','client_payout_rule','premium_payment',…
  entity_id   uuid not null,
  field       text not null,
  old_value   text,
  new_value   text,
  reason      text,
  actor_id    uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists financial_audit_entity_ix on financial_audit (entity_type, entity_id, created_at desc);

-- ---------- updated_at upkeep ----------
create or replace function touch_updated_at() returns trigger
  language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists t_touch_people              on people;
drop trigger if exists t_touch_premium_payments    on premium_payments;
drop trigger if exists t_touch_client_payout_rules on client_payout_rules;
create trigger t_touch_people              before update on people              for each row execute function touch_updated_at();
create trigger t_touch_premium_payments    before update on premium_payments    for each row execute function touch_updated_at();
create trigger t_touch_client_payout_rules before update on client_payout_rules for each row execute function touch_updated_at();

-- ---------- RLS ----------
alter table people              enable row level security;
alter table lead_generators     enable row level security;
alter table premium_payments    enable row level security;
alter table client_payout_rules enable row level security;
alter table financial_audit     enable row level security;

-- Admin manages everything; bookkeepers read and record payments; a consultant
-- linked to a person row sees only their own recipient record.
drop policy if exists people_admin_all      on people;
drop policy if exists people_staff_read     on people;
drop policy if exists people_self_read      on people;
create policy people_admin_all  on people for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy people_staff_read on people for select
  using (my_role() in ('admin','bookkeeper'));
create policy people_self_read  on people for select
  using (consultant_id = (select consultant_id from profiles where id = auth.uid()));

drop policy if exists lead_generators_read      on lead_generators;
drop policy if exists lead_generators_admin_all on lead_generators;
create policy lead_generators_read      on lead_generators for select
  using (my_role() in ('admin','bookkeeper'));
create policy lead_generators_admin_all on lead_generators for all
  using (my_role() = 'admin') with check (my_role() = 'admin');

drop policy if exists premium_payments_admin_all       on premium_payments;
drop policy if exists premium_payments_bookkeeper_read on premium_payments;
drop policy if exists premium_payments_bookkeeper_upd  on premium_payments;
create policy premium_payments_admin_all on premium_payments for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy premium_payments_bookkeeper_read on premium_payments for select
  using (my_role() = 'bookkeeper');
create policy premium_payments_bookkeeper_upd on premium_payments for update
  using (my_role() = 'bookkeeper') with check (my_role() = 'bookkeeper');

drop policy if exists client_payout_rules_admin_all  on client_payout_rules;
drop policy if exists client_payout_rules_staff_read on client_payout_rules;
create policy client_payout_rules_admin_all on client_payout_rules for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy client_payout_rules_staff_read on client_payout_rules for select
  using (my_role() in ('admin','bookkeeper'));

drop policy if exists financial_audit_staff_read on financial_audit;
create policy financial_audit_staff_read on financial_audit for select
  using (my_role() in ('admin','bookkeeper'));

-- ---- DOWN ----
-- drop table if exists financial_audit, client_payout_rules, premium_payments,
--                      lead_generators, people cascade;
-- alter table clients      drop column if exists generator_id, drop column if exists referred_by_id;
-- alter table payouts      drop column if exists person_id, ... ;
-- alter table expenses     drop column if exists made_by_person_id, ... ;
-- alter table app_settings drop column if exists default_usd_thb_rate, drop column if exists display_currency;
