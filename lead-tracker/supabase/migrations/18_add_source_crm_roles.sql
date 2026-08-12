-- ============================================================================
-- 18_add_source_crm_roles  (spec §4)
-- Two restricted external access types as user roles. Must be its own
-- migration: a new enum value can't be used in the same transaction it's added,
-- and migration 19 uses these values.
-- ============================================================================

-- ---- UP ----
alter type user_role add value if not exists 'source';
alter type user_role add value if not exists 'crm';

-- ---- DOWN ----
-- Postgres cannot drop an enum value; a rollback recreates the type without them.
