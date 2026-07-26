-- ============================================================================
-- 03_support_tables
-- Append-only history, immutable audit, activity feed, comments, documents,
-- tags, saved filters, pinned affiliates, notifications + rules.
-- ============================================================================

-- ---- UP ----

-- ---------- STATUS HISTORY (append-only) ----------
create table lead_status_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete restrict,
  from_status lead_status,                 -- null = lead creation
  to_status   lead_status not null,
  kind        transition_kind not null,
  reason      text,                        -- required for corrections (enforced by trigger)
  changed_by  uuid references app_users(id) on delete restrict,
  changed_at  timestamptz not null default now()
);
create index lsh_lead_ix on lead_status_history (lead_id, changed_at);
create index lsh_time_ix on lead_status_history (changed_at);

-- ---------- AUDIT (immutable field-change log) ----------
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references app_users(id) on delete restrict,
  entity_type text not null,
  entity_id   uuid not null,
  field       text not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index audit_entity_ix on audit_log (entity_type, entity_id, created_at desc);
create index audit_actor_ix  on audit_log (actor_id, created_at desc);

-- ---------- ACTIVITY (human-readable feed + view-audit) ----------
create table activity_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references app_users(id) on delete restrict,
  kind         text not null check (kind in (
                 'lead_created','status_changed','field_changed','note_added',
                 'comment_added','document_uploaded','document_deleted','viewed',
                 'imported','exported','assigned','bulk_update')),
  lead_id      uuid references leads(id) on delete restrict,
  affiliate_id uuid references affiliates(id) on delete restrict,
  summary      text not null,
  created_at   timestamptz not null default now()
);
create index activity_time_ix on activity_log (created_at desc);
create index activity_lead_ix on activity_log (lead_id, created_at desc) where lead_id is not null;

-- ---------- COMMENTS ----------
create table comments (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete restrict,
  author_id  uuid not null references app_users(id) on delete restrict,
  body       text not null,
  body_tsv   tsvector generated always as (to_tsvector('simple', body)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_lead_ix on comments (lead_id, created_at) where deleted_at is null;
create index comments_tsv_ix  on comments using gin (body_tsv);

-- ---------- DOCUMENTS (metadata; files live in Storage) ----------
create table documents (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references leads(id) on delete restrict,
  uploaded_by  uuid not null references app_users(id) on delete restrict,
  filename     text not null,
  storage_path text not null,              -- bucket-relative: leads/<lead_id>/<uuid>
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index documents_lead_ix on documents (lead_id) where deleted_at is null;

-- ---------- TAGS ----------
create table tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default 'gray',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index tags_name_uq on tags (lower(name)) where deleted_at is null;

create table lead_tags (
  lead_id    uuid not null references leads(id) on delete restrict,
  tag_id     uuid not null references tags(id)  on delete cascade,  -- pure join row
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);
create index lead_tags_tag_ix on lead_tags (tag_id);

-- ---------- SAVED FILTERS ----------
create table saved_filters (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references app_users(id) on delete cascade,
  name         text not null,
  query_string text not null,             -- the URL-encoded filter, source of truth
  is_shared    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index saved_filters_owner_ix on saved_filters (owner_id) where deleted_at is null;

-- ---------- PINNED AFFILIATES ----------
create table pinned_affiliates (
  user_id      uuid not null references app_users(id) on delete cascade,
  affiliate_id uuid not null references affiliates(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, affiliate_id)
);

-- ---------- NOTIFICATION RULES (configurable thresholds) ----------
create table notification_rules (
  id                 uuid primary key default gen_random_uuid(),
  rule_key           text not null unique,   -- 'new_lead','inbound_stale',...
  name               text not null,
  threshold_days     int,                    -- null for event-driven rules
  target_roles       user_role[] not null default '{admin,business_development}',
  notify_assigned_rm boolean not null default true,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------- NOTIFICATIONS ----------
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  rule_id      uuid references notification_rules(id) on delete set null,
  lead_id      uuid references leads(id) on delete cascade,
  affiliate_id uuid references affiliates(id) on delete cascade,
  title        text not null,
  body         text,
  dedupe_key   text not null,               -- one alert per stage-visit, not per scan
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_unread_ix on notifications (user_id) where read_at is null;

-- ---- DOWN ----
-- drop table if exists notifications;
-- drop table if exists notification_rules;
-- drop table if exists pinned_affiliates;
-- drop table if exists saved_filters;
-- drop table if exists lead_tags;
-- drop table if exists tags;
-- drop table if exists documents;
-- drop table if exists comments;
-- drop table if exists activity_log;
-- drop table if exists audit_log;
-- drop table if exists lead_status_history;
