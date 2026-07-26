-- ============================================================================
-- 13_crm_tables  (ADDITIVE ONLY — nothing is dropped here)
--
-- Adds the entities the multi-affiliate CRM needs, and widens `leads` with the
-- new attribution + 4-axis status columns. Old columns are left intact so this
-- migration is safe to apply before any application code changes; migration 14
-- backfills them and removes the legacy ones.
--
-- Reuse notes (deliberately NOT rebuilt):
--   * `affiliates` already is the Source entity  -> kept, types widened in 12.
--   * `insurance_types` already is the product catalogue (Health, Life, …)
--     -> renamed to `products`, now many-to-many with leads via lead_products.
--   * `comments` already is per-lead Notes; `activity_log`/`audit_log` already
--     are the history -> reused, extended in 14.
-- ============================================================================

-- ---- UP ----

-- ---------- PRODUCTS (was insurance_types) ----------
alter table insurance_types rename to products;

-- Many-to-many: a lead can want Health, Life, or both (spec §1).
create table lead_products (
  lead_id    uuid not null references leads(id)    on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (lead_id, product_id)
);
create index lead_products_product_ix on lead_products (product_id);

-- ---------- GENERATORS ----------
-- The individual who produced the lead, always belonging to one Source.
create table generators (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text not null,
  full_name    text generated always as (btrim(first_name || ' ' || last_name)) stored,
  affiliate_id uuid not null references affiliates(id) on delete restrict,
  email        citext,
  phone        text,
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index generators_affiliate_ix on generators (affiliate_id) where deleted_at is null;
create index generators_active_ix    on generators (is_active)    where deleted_at is null;
create index generators_name_trgm    on generators using gin (full_name gin_trgm_ops);
create unique index generators_name_per_affiliate_uq
  on generators (affiliate_id, lower(first_name), lower(last_name)) where deleted_at is null;

-- ---------- BROKERS ----------
-- The person handling the lead. Independent of login accounts: most brokers are
-- tracked without app access, but app_user_id links one to a login when needed.
create table brokers (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  full_name   text generated always as (btrim(first_name || ' ' || last_name)) stored,
  company     text,
  email       citext,
  phone       text,
  notes       text,
  app_user_id uuid unique references app_users(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index brokers_active_ix  on brokers (is_active) where deleted_at is null;
create index brokers_name_trgm  on brokers using gin (full_name gin_trgm_ops);
create index brokers_company_ix on brokers (company) where deleted_at is null;

-- ---------- LOST REASONS (configurable, not an enum — spec §22) ----------
create table lost_reasons (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  label      text not null,
  sort_order int not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into lost_reasons (code, label, sort_order) values
  ('price',               'Price',                 10),
  ('competitor',          'Competitor',            20),
  ('no_response',         'No Response',           30),
  ('not_interested',      'Not Interested',        40),
  ('coverage_benefits',   'Coverage / Benefits',   50),
  ('medical_underwriting','Medical Underwriting',  60),
  ('payment_issue',       'Payment Issue',         70),
  ('timing',              'Timing',                80),
  ('duplicate_lead',      'Duplicate Lead',        90),
  ('invalid_lead',        'Invalid Lead',         100),
  ('other',               'Other',                110)
on conflict (code) do nothing;

-- ---------- LEADS: new person / attribution / status columns ----------
alter table leads
  add column title                  text,
  add column first_name             text,
  add column last_name              text,
  add column date_of_birth          date,
  add column whatsapp_phone         text,
  add column whatsapp_same_as_phone boolean not null default false,
  add column generator_id           uuid references generators(id) on delete set null,
  add column broker_id              uuid references brokers(id)    on delete set null,
  add column lead_state             lead_state           not null default 'new',
  add column qualification          qualification_status not null default 'pending',
  add column stage                  pipeline_stage,
  add column opportunity            opportunity_status   not null default 'active',
  add column qualified_at           timestamptz,
  add column stage_at_loss          pipeline_stage,
  add column lost_reason_id         uuid references lost_reasons(id) on delete restrict,
  add column lost_notes             text,
  add column lost_at                timestamptz,
  add column lost_by                uuid references app_users(id) on delete set null;

-- Normalised WhatsApp for duplicate detection, mirroring phone_normalized.
alter table leads
  add column whatsapp_normalized text generated always as
    (nullif(regexp_replace(coalesce(whatsapp_phone,''), '[^0-9+]', '', 'g'), '')) stored;

create index leads_generator_ix   on leads (generator_id) where deleted_at is null and generator_id is not null;
create index leads_broker_ix      on leads (broker_id)    where deleted_at is null and broker_id is not null;
create index leads_qualification_ix on leads (qualification, updated_at desc) where deleted_at is null;
create index leads_stage_ix       on leads (stage, updated_at desc) where deleted_at is null and stage is not null;
create index leads_opportunity_ix on leads (opportunity) where deleted_at is null;
create index leads_dob_ix         on leads (date_of_birth) where deleted_at is null and date_of_birth is not null;
create index leads_whatsapp_ix    on leads (whatsapp_normalized) where deleted_at is null;
create index leads_whatsapp_trgm  on leads using gin (whatsapp_normalized gin_trgm_ops);
create index leads_lastname_trgm  on leads using gin (last_name gin_trgm_ops);

-- ---------- touch/audit triggers for the new tables ----------
create trigger t_touch_generators   before update on generators   for each row execute function touch_updated_at();
create trigger t_touch_brokers      before update on brokers      for each row execute function touch_updated_at();
create trigger t_touch_lost_reasons before update on lost_reasons for each row execute function touch_updated_at();

create trigger t_audit_generators   after insert or update on generators   for each row execute function fn_audit_row();
create trigger t_audit_brokers      after insert or update on brokers      for each row execute function fn_audit_row();

-- ---- DOWN ----
-- drop table if exists lead_products;
-- drop table if exists lost_reasons;   -- (leads.lost_reason_id first)
-- drop table if exists brokers;
-- drop table if exists generators;
-- alter table products rename to insurance_types;
-- alter table leads drop column ... (all columns added above);
