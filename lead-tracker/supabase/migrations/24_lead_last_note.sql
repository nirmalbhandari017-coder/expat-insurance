-- ============================================================================
-- 24_lead_last_note
-- Surface the most recent note on the pipeline without a per-row lookup.
-- The pipeline lists up to 500 leads, so a correlated subquery/join per card
-- would be slow; a trigger keeps a denormalised copy on the lead instead.
-- ============================================================================

-- ---- UP ----
alter table leads
  add column if not exists last_note    text,
  add column if not exists last_note_at timestamptz,
  add column if not exists last_note_by uuid references app_users(id) on delete set null;

comment on column leads.last_note is 'Body of the most recent non-deleted note; maintained by trigger.';

-- Recompute the latest note for one lead (handles insert, edit, and deletion).
create or replace function refresh_lead_last_note(p_lead_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_body text; v_at timestamptz; v_by uuid;
begin
  select body, created_at, author_id
    into v_body, v_at, v_by
  from comments
  where lead_id = p_lead_id and deleted_at is null
  order by created_at desc, id desc
  limit 1;

  update leads
     set last_note = v_body, last_note_at = v_at, last_note_by = v_by
   where id = p_lead_id;
end $$;

create or replace function comments_sync_last_note() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform refresh_lead_last_note(coalesce(new.lead_id, old.lead_id));
  -- An edit that moves a note between leads has to refresh both sides.
  if tg_op = 'UPDATE' and old.lead_id is distinct from new.lead_id then
    perform refresh_lead_last_note(old.lead_id);
  end if;
  return null;
end $$;

drop trigger if exists t_comments_sync_last_note on comments;
create trigger t_comments_sync_last_note
  after insert or update or delete on comments
  for each row execute function comments_sync_last_note();

-- Backfill existing notes.
update leads l
   set last_note = c.body, last_note_at = c.created_at, last_note_by = c.author_id
  from (
    select distinct on (lead_id) lead_id, body, created_at, author_id
    from comments
    where deleted_at is null
    order by lead_id, created_at desc, id desc
  ) c
 where c.lead_id = l.id;

-- ---- DOWN ----
-- drop trigger if exists t_comments_sync_last_note on comments;
-- drop function if exists comments_sync_last_note();
-- drop function if exists refresh_lead_last_note(uuid);
-- alter table leads drop column if exists last_note, drop column if exists last_note_at,
--   drop column if exists last_note_by;
