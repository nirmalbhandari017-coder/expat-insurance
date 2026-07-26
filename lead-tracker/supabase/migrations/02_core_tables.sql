-- ============================================================================
-- 02_core_tables
-- Users, permission matrix, lookups, affiliates, import jobs, leads.
-- ============================================================================

-- ---- UP ----

-- ---------- USERS ----------
create table app_users (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid unique references auth.users(id) on delete restrict,
  full_name          text not null,
  email              citext not null unique,
  role               user_role not null default 'read_only',
  is_rm              boolean not null default false,        -- appears in "assign RM" pickers
  last_pipeline_view pipeline_view not null default 'kanban',
  prefs              jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index app_users_role_ix on app_users (role) where deleted_at is null;
create index app_users_rm_ix   on app_users (is_rm) where deleted_at is null and is_rm;

-- ---------- PERMISSION MATRIX (source of truth for authz; RLS reads this) ----------
create table role_permissions (
  role     user_role not null,
  resource text      not null,   -- 'leads','affiliates','imports','audit',...
  action   text      not null,   -- 'create','read','update','delete','export','export_pii'
  allowed  boolean   not null default true,
  scope    text      not null default 'all' check (scope in ('all','own','none')),
  primary key (role, resource, action)
);

-- ---------- LOOKUPS ----------
-- insurance_types is the placeholder that grows into the future product catalogue.
create table insurance_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- AFFILIATES ----------
create table affiliates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_person text,
  email          citext,
  phone          text,
  commission_pct numeric(5,2) check (commission_pct between 0 and 100),
  type           affiliate_type not null default 'other',
  country        text,           -- ISO-3166 alpha-2
  external_ref   text,           -- future affiliate-portal linking
  is_active      boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create unique index affiliates_name_uq   on affiliates (lower(name)) where deleted_at is null;
create index        affiliates_active_ix on affiliates (is_active)   where deleted_at is null;
create index        affiliates_name_trgm on affiliates using gin (name gin_trgm_ops);

-- ---------- IMPORT JOBS ----------
create table import_jobs (
  id           uuid primary key default gen_random_uuid(),
  filename     text not null,
  uploaded_by  uuid not null references app_users(id) on delete restrict,
  status       text not null default 'validating'
               check (status in ('validating','preview_ready','committing','done','failed','cancelled')),
  total_rows   int,
  valid_rows   int,
  error_rows   int,
  error_report jsonb,            -- [{row, field, message}]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index import_jobs_uploader_ix on import_jobs (uploaded_by, created_at desc);

-- ---------- LEADS ----------
create sequence lead_code_seq;
create table leads (
  id                   uuid primary key default gen_random_uuid(),
  lead_code            text not null unique
                       default 'LD-' || lpad(nextval('lead_code_seq')::text, 6, '0'),
  customer_name        text not null,
  email                citext,
  phone                text,
  phone_normalized     text generated always as
                         (nullif(regexp_replace(coalesce(phone,''), '[^0-9+]', '', 'g'), '')) stored,
  nationality          text,     -- ISO-3166 alpha-2
  country_of_residence text,
  insurance_type_id    uuid references insurance_types(id) on delete restrict,
  affiliate_id         uuid not null references affiliates(id) on delete restrict,
  current_status       lead_status not null default 'inbound',
  stage_entered_at     timestamptz not null default now(),   -- drives aging alerts
  assigned_rm_id       uuid references app_users(id) on delete set null,
  quote_date           date,
  application_date     date,
  payment_date         date,
  policy_number        text,
  lost_reason          lost_reason,
  lost_reason_detail   text,
  notes                text,
  source_channel       source_channel not null default 'manual',
  import_job_id        uuid references import_jobs(id) on delete set null,
  search_tsv           tsvector generated always as (
                         to_tsvector('simple',
                           coalesce(customer_name,'') || ' ' ||
                           coalesce(email::text,'')   || ' ' ||
                           coalesce(policy_number,'') || ' ' ||
                           coalesce(notes,''))) stored,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  anonymized_at        timestamptz,
  constraint lost_needs_reason
    check (current_status <> 'lost' or lost_reason is not null),
  constraint lost_other_needs_detail
    check (lost_reason is distinct from 'other' or lost_reason_detail is not null),
  constraint email_or_phone
    check (anonymized_at is not null or email is not null or phone is not null)
);

-- Indexes (justified against query patterns in the PRD).
create index leads_status_ix    on leads (current_status, updated_at desc) where deleted_at is null;
create index leads_affiliate_ix on leads (affiliate_id, current_status)    where deleted_at is null;
create index leads_rm_ix        on leads (assigned_rm_id) where deleted_at is null and assigned_rm_id is not null;
create index leads_created_ix   on leads (created_at)       where deleted_at is null;
create index leads_quote_ix     on leads (quote_date)       where quote_date is not null;
create index leads_appl_ix      on leads (application_date) where application_date is not null;
create index leads_pay_ix       on leads (payment_date)     where payment_date is not null;
create index leads_lost_ix      on leads (lost_reason)      where current_status = 'lost';
create index leads_email_ix     on leads (email)            where deleted_at is null;
create index leads_phone_ix     on leads (phone_normalized) where deleted_at is null;
create index leads_stage_age_ix on leads (current_status, stage_entered_at) where deleted_at is null;
create index leads_name_trgm    on leads using gin (customer_name gin_trgm_ops);
create index leads_email_trgm   on leads using gin ((email::text) gin_trgm_ops);
create index leads_phone_trgm   on leads using gin (phone_normalized gin_trgm_ops);
create index leads_policy_trgm  on leads using gin (policy_number gin_trgm_ops);
create index leads_tsv_ix       on leads using gin (search_tsv);

-- ---- DOWN ----
-- drop table if exists leads;
-- drop sequence if exists lead_code_seq;
-- drop table if exists import_jobs;
-- drop table if exists affiliates;
-- drop table if exists insurance_types;
-- drop table if exists role_permissions;
-- drop table if exists app_users;
