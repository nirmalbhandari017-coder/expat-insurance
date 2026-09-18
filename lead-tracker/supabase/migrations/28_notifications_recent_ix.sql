-- ============================================================================
-- 28_notifications_recent_ix
-- The notifications bell loads on every page: the signed-in user's latest 15
-- by created_at. Only (user_id) and a partial unread index existed, so this
-- sorted the user's whole history each time. Index the exact access path.
-- ============================================================================

-- ---- UP ----
create index if not exists notifications_user_recent_ix
  on notifications (user_id, created_at desc);

-- ---- DOWN ----
-- drop index if exists notifications_user_recent_ix;
