-- ============================================================================
-- 12_crm_enums
-- Enum groundwork for the multi-affiliate lead CRM restructure.
--
-- The single `lead_status` enum is replaced by FOUR orthogonal axes, because
-- collapsing them lost information the business needs:
--   lead_state           overall record state      (new / active / closed)
--   qualification_status gatekeeping before sales   (pending / qualified / not)
--   pipeline_stage       where in the sales process (6 ordered stages)
--   opportunity_status   won-or-lost overlay        (active / lost)
-- A lost lead therefore RETAINS the stage it was lost at — "Lost" no longer
-- overwrites the stage, which is what made loss-analysis impossible before.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that creates
-- it, so all enum changes live in this migration and are consumed from 13 on.
-- ============================================================================

-- ---- UP ----

create type qualification_status as enum ('pending','qualified','not_qualified');

create type pipeline_stage as enum (
  'qualified','quote_sent','negotiation','application_received','policy_issued','renewal'
);

create type opportunity_status as enum ('active','lost');

create type lead_state as enum ('new','active','closed');

-- Source/affiliate types per spec (existing values are kept — they are in use).
alter type affiliate_type add value if not exists 'affiliate';
alter type affiliate_type add value if not exists 'website';
alter type affiliate_type add value if not exists 'paid_advertising';
alter type affiliate_type add value if not exists 'direct';
alter type affiliate_type add value if not exists 'broker';

-- New transition kinds for the qualification/loss axes.
alter type transition_kind add value if not exists 'qualify';
alter type transition_kind add value if not exists 'disqualify';
alter type transition_kind add value if not exists 'lost';

-- ---- DOWN ----
-- Enum values cannot be dropped; recreate the type to reverse.
-- drop type if exists lead_state;
-- drop type if exists opportunity_status;
-- drop type if exists pipeline_stage;
-- drop type if exists qualification_status;
