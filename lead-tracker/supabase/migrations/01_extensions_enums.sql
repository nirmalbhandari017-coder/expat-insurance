-- ============================================================================
-- 01_extensions_enums
-- Extensions and enum types for the Affiliate Lead Management System.
-- "RM" = Relationship Manager (a PERSON), never CRM software.
-- ============================================================================

-- ---- UP ----
create extension if not exists pg_trgm;      -- trigram indexes for fuzzy global search
create extension if not exists citext;       -- case-insensitive email columns
create extension if not exists pg_cron;      -- scheduled notification scan + matview refresh

create type user_role       as enum ('admin','business_development','rm_staff','read_only');

create type lead_status     as enum (
  'inbound','contacted','opportunity_open',
  'account_pending','account_open','account_lapsed','lost'
);

create type transition_kind as enum (
  'progress','correction','reopen','lapse','reinstate','import'
);

create type lost_reason     as enum (
  'declined_quote','too_expensive','bought_elsewhere','unresponsive',
  'disqualified_medical','disqualified_eligibility','duplicate','invalid_contact','other'
);

create type source_channel  as enum ('manual','csv','api');

create type affiliate_type  as enum (
  'relocation_agency','expat_services','referral_partner','financial_advisor','other'
);

create type pipeline_view   as enum ('kanban','table');

-- ---- DOWN ----
-- drop type if exists pipeline_view;
-- drop type if exists affiliate_type;
-- drop type if exists source_channel;
-- drop type if exists lost_reason;
-- drop type if exists transition_kind;
-- drop type if exists lead_status;
-- drop type if exists user_role;
-- drop extension if exists pg_cron;
-- drop extension if exists citext;
-- drop extension if exists pg_trgm;
