-- ============================================================
-- ExpatProtectHub Commission CRM — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Safe to re-run: it drops and recreates everything it owns.
-- ============================================================

-- ---------- Enums ----------
drop type if exists user_role cascade;
create type user_role as enum ('admin', 'bookkeeper', 'consultant');

drop type if exists currency_code cascade;
create type currency_code as enum ('USD', 'THB');

drop type if exists pay_frequency cascade;
create type pay_frequency as enum ('monthly', 'quarterly', 'semi_annual', 'annual');

drop type if exists client_status cascade;
create type client_status as enum ('active', 'lapsed', 'cancelled');

drop type if exists commission_status cascade;
create type commission_status as enum ('pending', 'overdue', 'received');

drop type if exists payout_status cascade;
create type payout_status as enum ('pending', 'paid');

-- ---------- Tables ----------
drop table if exists payouts cascade;
drop table if exists commissions cascade;
drop table if exists client_consultants cascade;
drop table if exists expenses cascade;
drop table if exists clients cascade;
drop table if exists consultants cascade;
drop table if exists profiles cascade;
drop table if exists app_settings cascade;

create table app_settings (
  id int primary key default 1 check (id = 1),
  -- % of received commission set aside for the company's own tax liability
  incoming_tax_reserve_pct numeric(5,2) not null default 15.00,
  -- default withholding % deducted from consultant payouts (per-consultant override below)
  default_withholding_pct numeric(5,2) not null default 3.00,
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role user_role not null default 'consultant',
  -- set by an admin to link a login to a consultant record
  consultant_id uuid,
  created_at timestamptz not null default now()
);

create table consultants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  payment_details text,
  default_payout_pct numeric(5,2) not null default 0,
  -- null = use app_settings.default_withholding_pct
  withholding_pct_override numeric(5,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_consultant_fk
  foreign key (consultant_id) references consultants (id) on delete set null;

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  product_type text,
  start_date date not null,
  premium numeric(14,2) not null default 0,
  currency currency_code not null default 'USD',
  commission_pct numeric(5,2) not null default 0,
  frequency pay_frequency not null default 'monthly',
  status client_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

create table client_consultants (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  consultant_id uuid not null references consultants (id) on delete cascade,
  -- null = use the consultant's default_payout_pct
  payout_pct_override numeric(5,2),
  unique (client_id, consultant_id)
);

create table commissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  due_date date not null,
  expected_amount numeric(14,2) not null,
  currency currency_code not null,
  status commission_status not null default 'pending',
  received_date date,
  received_amount numeric(14,2),
  -- snapshot of the company tax reserve at time of receipt
  tax_reserve_pct numeric(5,2),
  tax_reserve_amount numeric(14,2),
  created_at timestamptz not null default now(),
  unique (client_id, due_date)
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references commissions (id) on delete cascade,
  consultant_id uuid not null references consultants (id) on delete cascade,
  gross_amount numeric(14,2) not null,
  tax_pct numeric(5,2) not null,
  tax_amount numeric(14,2) not null,
  net_amount numeric(14,2) not null,
  currency currency_code not null,
  status payout_status not null default 'pending',
  paid_date date,
  created_at timestamptz not null default now(),
  unique (commission_id, consultant_id)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric(14,2) not null,
  currency currency_code not null default 'THB',
  expense_date date not null,
  recurring boolean not null default false,
  is_draft boolean not null default false,
  parent_expense_id uuid references expenses (id) on delete set null,
  client_id uuid references clients (id) on delete set null,
  receipt_url text,
  created_at timestamptz not null default now()
);

create index commissions_due_idx on commissions (status, due_date);
create index payouts_consultant_idx on payouts (consultant_id, status);
create index expenses_date_idx on expenses (expense_date);

-- ---------- Role helpers (security definer avoids RLS recursion) ----------
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function my_consultant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select consultant_id from profiles where id = auth.uid()
$$;

-- ---------- New-user hook: first user becomes admin ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when not exists (select 1 from profiles) then 'admin'::user_role
         else 'consultant'::user_role end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Commission generation ----------
-- Idempotent: generates the next expected commission records for every
-- active client out to `horizon_days` ahead, and flags overdue ones.
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

  for c in select * from clients where status = 'active' loop
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

-- ---------- Recurring expense drafts ----------
-- For each recurring template expense, create this month's draft copy
-- (once) so it can be confirmed/edited rather than re-entered.
create or replace function generate_recurring_expenses()
returns int language plpgsql security definer set search_path = public as $$
declare
  e record;
  target date;
  inserted int := 0;
begin
  if my_role() not in ('admin', 'bookkeeper') then
    raise exception 'not allowed';
  end if;

  for e in select * from expenses where recurring and parent_expense_id is null loop
    target := date_trunc('month', current_date)::date
              + least(extract(day from e.expense_date)::int - 1, 27);
    if target > e.expense_date
       and not exists (
         select 1 from expenses
         where parent_expense_id = e.id
           and date_trunc('month', expense_date) = date_trunc('month', target)
       )
    then
      insert into expenses (category, description, amount, currency, expense_date,
                            recurring, is_draft, parent_expense_id, client_id)
      values (e.category, e.description, e.amount, e.currency, target,
              false, true, e.id, e.client_id);
      inserted := inserted + 1;
    end if;
  end loop;
  return inserted;
end;
$$;

-- ---------- Payout generation on commission receipt ----------
-- Pass-through model: payouts are created only when a commission is
-- marked received, from the ACTUAL amount received.
create or replace function on_commission_received() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s app_settings%rowtype;
  link record;
  pct numeric;
  wht numeric;
  gross numeric;
  tax numeric;
begin
  select * into s from app_settings where id = 1;

  if new.status = 'received' and old.status <> 'received' then
    if new.received_amount is null then
      new.received_amount := new.expected_amount;
    end if;
    if new.received_date is null then
      new.received_date := current_date;
    end if;
    new.tax_reserve_pct := s.incoming_tax_reserve_pct;
    new.tax_reserve_amount := round(new.received_amount * s.incoming_tax_reserve_pct / 100, 2);

    for link in
      select cc.consultant_id,
             coalesce(cc.payout_pct_override, co.default_payout_pct) as payout_pct,
             coalesce(co.withholding_pct_override, s.default_withholding_pct) as wht_pct
      from client_consultants cc
      join consultants co on co.id = cc.consultant_id
      where cc.client_id = new.client_id
    loop
      gross := round(new.received_amount * link.payout_pct / 100, 2);
      tax := round(gross * link.wht_pct / 100, 2);
      insert into payouts (commission_id, consultant_id, gross_amount,
                           tax_pct, tax_amount, net_amount, currency)
      values (new.id, link.consultant_id, gross, link.wht_pct, tax, gross - tax, new.currency)
      on conflict (commission_id, consultant_id) do update
        set gross_amount = excluded.gross_amount,
            tax_pct = excluded.tax_pct,
            tax_amount = excluded.tax_amount,
            net_amount = excluded.net_amount
        where payouts.status = 'pending';
    end loop;
  end if;

  -- reverting a wrongly-marked receipt removes its unpaid payouts
  if old.status = 'received' and new.status <> 'received' then
    delete from payouts where commission_id = new.id and status = 'pending';
    new.received_date := null;
    new.received_amount := null;
    new.tax_reserve_pct := null;
    new.tax_reserve_amount := null;
  end if;

  return new;
end;
$$;

drop trigger if exists commission_received on commissions;
create trigger commission_received
  before update on commissions
  for each row execute function on_commission_received();

-- ---------- Guard: bookkeepers may only touch payment fields ----------
create or replace function guard_bookkeeper_commission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if my_role() = 'bookkeeper' then
    if new.client_id <> old.client_id
       or new.due_date <> old.due_date
       or new.expected_amount <> old.expected_amount
       or new.currency <> old.currency then
      raise exception 'Bookkeepers can only update payment status fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookkeeper_commission_guard on commissions;
create trigger bookkeeper_commission_guard
  before update on commissions
  for each row execute function guard_bookkeeper_commission();

create or replace function guard_bookkeeper_payout() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if my_role() = 'bookkeeper' then
    if new.gross_amount <> old.gross_amount
       or new.tax_pct <> old.tax_pct
       or new.tax_amount <> old.tax_amount
       or new.net_amount <> old.net_amount
       or new.consultant_id <> old.consultant_id then
      raise exception 'Bookkeepers can only mark payouts paid/unpaid';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookkeeper_payout_guard on payouts;
create trigger bookkeeper_payout_guard
  before update on payouts
  for each row execute function guard_bookkeeper_payout();

-- ---------- Row-level security ----------
alter table profiles enable row level security;
alter table app_settings enable row level security;
alter table clients enable row level security;
alter table consultants enable row level security;
alter table client_consultants enable row level security;
alter table commissions enable row level security;
alter table payouts enable row level security;
alter table expenses enable row level security;

-- profiles: everyone reads their own; admins read/update all
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or my_role() = 'admin');
create policy profiles_admin_update on profiles for update
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- settings: staff read; only admin updates
create policy settings_read on app_settings for select
  using (my_role() in ('admin', 'bookkeeper'));
create policy settings_admin_update on app_settings for update
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- clients: admin full CRUD, bookkeeper read, consultant reads own clients
create policy clients_admin_all on clients for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy clients_bookkeeper_read on clients for select
  using (my_role() = 'bookkeeper');
create policy clients_consultant_read on clients for select
  using (exists (select 1 from client_consultants cc
                 where cc.client_id = clients.id
                   and cc.consultant_id = my_consultant_id()));

-- consultants: admin full, bookkeeper read, consultant reads own record
create policy consultants_admin_all on consultants for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy consultants_bookkeeper_read on consultants for select
  using (my_role() = 'bookkeeper');
create policy consultants_self_read on consultants for select
  using (id = my_consultant_id());

-- client_consultants: admin full, bookkeeper read, consultant sees own links only
create policy cc_admin_all on client_consultants for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy cc_bookkeeper_read on client_consultants for select
  using (my_role() = 'bookkeeper');
create policy cc_consultant_read on client_consultants for select
  using (consultant_id = my_consultant_id());

-- commissions: admin full; bookkeeper read + update (guarded above);
-- consultant reads commissions on their own clients
create policy commissions_admin_all on commissions for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy commissions_bookkeeper_read on commissions for select
  using (my_role() = 'bookkeeper');
create policy commissions_bookkeeper_update on commissions for update
  using (my_role() = 'bookkeeper') with check (my_role() = 'bookkeeper');
create policy commissions_consultant_read on commissions for select
  using (exists (select 1 from client_consultants cc
                 where cc.client_id = commissions.client_id
                   and cc.consultant_id = my_consultant_id()));

-- payouts: admin full; bookkeeper read + update (guarded); consultant reads own
create policy payouts_admin_all on payouts for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy payouts_bookkeeper_read on payouts for select
  using (my_role() = 'bookkeeper');
create policy payouts_bookkeeper_update on payouts for update
  using (my_role() = 'bookkeeper') with check (my_role() = 'bookkeeper');
create policy payouts_consultant_read on payouts for select
  using (consultant_id = my_consultant_id());

-- expenses: admin full; bookkeeper read/insert/update; consultants none
create policy expenses_admin_all on expenses for all
  using (my_role() = 'admin') with check (my_role() = 'admin');
create policy expenses_bookkeeper_read on expenses for select
  using (my_role() = 'bookkeeper');
create policy expenses_bookkeeper_insert on expenses for insert
  with check (my_role() = 'bookkeeper');
create policy expenses_bookkeeper_update on expenses for update
  using (my_role() = 'bookkeeper') with check (my_role() = 'bookkeeper');
