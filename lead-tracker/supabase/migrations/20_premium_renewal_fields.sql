-- ============================================================================
-- 20_premium_renewal_fields  (spec §7, §12)
-- Premium + renewal, filled by the assigned CRM when a policy is placed
-- (payment_date = policy-placed date). Commission % stays at the Source level
-- (affiliates.commission_pct).
-- ============================================================================

-- ---- UP ----
alter table leads
  add column if not exists premium_amount numeric(12,2)
    check (premium_amount is null or premium_amount >= 0),
  add column if not exists renewal_date date;

create index if not exists leads_renewal_ix on leads (renewal_date)
  where deleted_at is null and renewal_date is not null;

comment on column leads.premium_amount is 'Policy premium; filled by the CRM when the policy is placed (spec 7).';
comment on column leads.renewal_date is 'Upcoming renewal date for the placed policy (spec 7).';

-- ---- DOWN ----
-- alter table leads drop column if exists premium_amount, drop column if exists renewal_date;
