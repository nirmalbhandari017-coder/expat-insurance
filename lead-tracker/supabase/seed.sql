-- ============================================================================
-- seed.sql  (production seed — safe/idempotent)
-- Permission matrix (authz source of truth), insurance types, notification
-- rules, starter tags. Re-runnable via ON CONFLICT.
-- ============================================================================

-- ---------- PERMISSION MATRIX ----------
-- action ∈ create|read|update|delete|export|export_pii ; scope ∈ all|own
insert into role_permissions (role, resource, action, allowed, scope) values
-- leads
 ('admin','leads','create',true,'all'),('admin','leads','read',true,'all'),
 ('admin','leads','update',true,'all'),('admin','leads','delete',true,'all'),
 ('admin','leads','export',true,'all'),('admin','leads','export_pii',true,'all'),
 ('business_development','leads','create',true,'all'),('business_development','leads','read',true,'all'),
 ('business_development','leads','update',true,'all'),('business_development','leads','delete',true,'all'),
 ('business_development','leads','export',true,'all'),('business_development','leads','export_pii',true,'all'),
 ('rm_staff','leads','read',true,'own'),('rm_staff','leads','update',true,'own'),
 ('rm_staff','leads','export',true,'own'),
 ('read_only','leads','read',true,'all'),('read_only','leads','export',true,'all'),
-- affiliates
 ('admin','affiliates','create',true,'all'),('admin','affiliates','read',true,'all'),
 ('admin','affiliates','update',true,'all'),('admin','affiliates','delete',true,'all'),
 ('admin','affiliates','export',true,'all'),
 ('business_development','affiliates','create',true,'all'),('business_development','affiliates','read',true,'all'),
 ('business_development','affiliates','update',true,'all'),('business_development','affiliates','export',true,'all'),
 ('rm_staff','affiliates','read',true,'all'),
 ('read_only','affiliates','read',true,'all'),
-- documents
 ('admin','documents','create',true,'all'),('admin','documents','read',true,'all'),
 ('admin','documents','update',true,'all'),('admin','documents','delete',true,'all'),
 ('business_development','documents','create',true,'all'),('business_development','documents','read',true,'all'),
 ('business_development','documents','update',true,'all'),('business_development','documents','delete',true,'all'),
 ('rm_staff','documents','create',true,'own'),('rm_staff','documents','read',true,'own'),
 ('rm_staff','documents','delete',true,'own'),
-- comments
 ('admin','comments','create',true,'all'),('admin','comments','read',true,'all'),
 ('admin','comments','update',true,'all'),('admin','comments','delete',true,'all'),
 ('business_development','comments','create',true,'all'),('business_development','comments','read',true,'all'),
 ('business_development','comments','update',true,'all'),
 ('rm_staff','comments','create',true,'own'),('rm_staff','comments','read',true,'own'),
 ('rm_staff','comments','update',true,'own'),
 ('read_only','comments','read',true,'all'),
-- tags (all internal roles may manage tags + their own saved filters)
 ('admin','tags','create',true,'all'),('admin','tags','read',true,'all'),
 ('business_development','tags','create',true,'all'),('business_development','tags','read',true,'all'),
 ('rm_staff','tags','create',true,'all'),('rm_staff','tags','read',true,'all'),
 ('read_only','tags','read',true,'all'),
-- imports
 ('admin','imports','create',true,'all'),('admin','imports','read',true,'all'),
 ('business_development','imports','create',true,'all'),('business_development','imports','read',true,'all'),
-- reports / analytics
 ('admin','reports','read',true,'all'),('admin','reports','export',true,'all'),
 ('business_development','reports','read',true,'all'),('business_development','reports','export',true,'all'),
 ('rm_staff','reports','read',true,'own'),('rm_staff','reports','export',true,'own'),
 ('read_only','reports','read',true,'all'),('read_only','reports','export',true,'all'),
-- notification rules (visibility)
 ('admin','notification_rules','read',true,'all'),
 ('business_development','notification_rules','read',true,'all'),
 ('rm_staff','notification_rules','read',true,'all'),
-- audit / activity / history
 ('admin','audit','read',true,'all'),
 ('business_development','audit','read',true,'all'),
 ('rm_staff','audit','read',true,'own')
on conflict (role, resource, action) do update
  set allowed = excluded.allowed, scope = excluded.scope;

-- ---------- INSURANCE TYPES (placeholder for future product catalogue) ----------
insert into insurance_types (name, sort_order) values
 ('Health', 10), ('Life', 20), ('Travel', 30),
 ('Income Protection', 40), ('Critical Illness', 50), ('Other', 100)
on conflict (name) do nothing;

-- ---------- NOTIFICATION RULES (thresholds live here, not in code) ----------
insert into notification_rules (rule_key, name, threshold_days, target_roles, notify_assigned_rm) values
 ('new_lead',         'New lead received',              null, '{admin,business_development}', true),
 ('inbound_stale',    'Inbound lead not worked',        3,    '{admin,business_development}', true),
 ('opportunity_stale','Opportunity untouched',          7,    '{admin,business_development}', true),
 ('pending_stale',    'Account pending payment',        14,   '{admin,business_development}', true),
 ('affiliate_quiet',  'Affiliate has gone quiet',       30,   '{admin,business_development}', false)
on conflict (rule_key) do nothing;

-- ---------- STARTER TAGS ----------
insert into tags (name, color) values
 ('VIP','amber'), ('Family','blue'), ('Corporate','violet'),
 ('Urgent','red'), ('Renewal','green')
on conflict do nothing;
