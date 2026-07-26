-- ============================================================================
-- 06_views_cron_storage
-- Commission-column hiding, analytics views, materialized affiliate rollup,
-- notification scan + pg_cron schedules, documents Storage bucket + policies.
-- ============================================================================

-- ---- UP ----

-- ---------- COMMISSION COLUMN HIDING ----------
-- All app users share the Postgres `authenticated` role, so column privileges
-- cannot distinguish app roles. Hide commission_pct from everyone at the column
-- level, then re-expose it only to privileged app roles through a guarded view.
revoke select (commission_pct) on affiliates from anon, authenticated;

create or replace view v_affiliate_commission with (security_invoker = false) as
  select id as affiliate_id,
         case when has_perm('affiliates','update') then commission_pct end as commission_pct
  from affiliates
  where deleted_at is null;
grant select on v_affiliate_commission to authenticated;

-- ---------- MATERIALIZED AFFILIATE ROLLUP ----------
-- Materialized (not live) because the global leaderboard aggregates all leads x
-- all affiliates x history; 15-min staleness is acceptable for a leaderboard.
-- Per-affiliate dashboards use the live views below and are always current.
create materialized view mv_affiliate_stats as
select a.id as affiliate_id,
       count(l.id) filter (where l.deleted_at is null)                    as total_leads,
       count(*)    filter (where l.current_status = 'inbound')            as n_inbound,
       count(*)    filter (where l.current_status = 'contacted')          as n_contacted,
       count(*)    filter (where l.current_status = 'opportunity_open')   as n_opportunity,
       count(*)    filter (where l.current_status = 'account_pending')    as n_pending,
       count(*)    filter (where l.current_status = 'account_open')       as n_open,
       count(*)    filter (where l.current_status = 'account_lapsed')     as n_lapsed,
       count(*)    filter (where l.current_status = 'lost')               as n_lost,
       count(*)    filter (where l.current_status in
                     ('account_open','account_lapsed'))                   as converted,
       count(*)    filter (where l.current_status in
                     ('account_open','account_lapsed','lost'))            as decided,
       round( (count(*) filter (where l.current_status in ('account_open','account_lapsed')))::numeric
            / nullif(count(*) filter (where l.current_status in
                     ('account_open','account_lapsed','lost')), 0), 4)    as conversion_rate,
       round( (count(*) filter (where l.current_status = 'account_open'))::numeric
            / nullif(count(*) filter (where l.current_status in
                     ('account_open','account_lapsed')), 0), 4)           as retention_rate,
       avg((l.payment_date - l.created_at::date))
         filter (where l.payment_date is not null)                        as avg_days_to_convert,
       max(l.created_at)                                                  as last_lead_at
from affiliates a
left join leads l on l.affiliate_id = a.id and l.deleted_at is null
where a.deleted_at is null
group by a.id;
create unique index mv_affiliate_stats_pk on mv_affiliate_stats (affiliate_id);
grant select on mv_affiliate_stats to authenticated;

-- ---------- LIVE ANALYTICS VIEWS ----------
create or replace view v_funnel_by_affiliate as
with reached as (
  select h.lead_id, l.affiliate_id, max(stage_rank(h.to_status)) as max_rank
  from lead_status_history h
  join leads l on l.id = h.lead_id and l.deleted_at is null
  group by h.lead_id, l.affiliate_id
)
select affiliate_id,
       count(*) filter (where max_rank >= 1) as reached_inbound,
       count(*) filter (where max_rank >= 2) as reached_contacted,
       count(*) filter (where max_rank >= 3) as reached_opportunity,
       count(*) filter (where max_rank >= 4) as reached_pending,
       count(*) filter (where max_rank >= 5) as reached_open
from reached group by affiliate_id;
grant select on v_funnel_by_affiliate to authenticated;

create or replace view v_stage_durations as
with steps as (
  select h.lead_id, l.affiliate_id, h.to_status, h.changed_at,
         lead(h.changed_at) over (partition by h.lead_id order by h.changed_at) as next_at
  from lead_status_history h
  join leads l on l.id = h.lead_id and l.deleted_at is null
)
select affiliate_id, to_status as status,
       avg(coalesce(next_at, now()) - changed_at) as avg_duration,
       count(*)                                   as observations
from steps
where to_status in ('contacted','opportunity_open','account_pending','account_open')
group by affiliate_id, to_status;
grant select on v_stage_durations to authenticated;

create or replace view v_monthly_cohorts as
select l.affiliate_id,
       date_trunc('month', l.created_at)::date as cohort_month,
       count(*)                                                              as total,
       count(*) filter (where l.current_status in ('account_open','account_lapsed')) as converted,
       count(*) filter (where l.current_status = 'lost')                     as lost,
       count(*) filter (where l.current_status in
              ('inbound','contacted','opportunity_open','account_pending'))  as in_progress
from leads l
where l.deleted_at is null
group by l.affiliate_id, date_trunc('month', l.created_at);
grant select on v_monthly_cohorts to authenticated;

create or replace view v_lead_aging as
select l.id, l.lead_code, l.customer_name, l.affiliate_id, l.assigned_rm_id,
       l.current_status, l.stage_entered_at,
       (now() - l.stage_entered_at) as time_in_stage
from leads l
where l.deleted_at is null
  and l.current_status in ('inbound','contacted','opportunity_open','account_pending');
grant select on v_lead_aging to authenticated;

-- ---------- NOTIFICATION SCAN ----------
create or replace function fn_scan_notifications() returns void
  language plpgsql security definer set search_path = public as $$
declare r notification_rules; rec record; u app_users; v_key text;
begin
  for r in select * from notification_rules where is_active and threshold_days is not null loop
    if r.rule_key in ('inbound_stale','opportunity_stale','pending_stale') then
      for rec in
        select l.* from leads l
        where l.deleted_at is null
          and l.current_status = case r.rule_key
                when 'inbound_stale'     then 'inbound'::lead_status
                when 'opportunity_stale' then 'opportunity_open'::lead_status
                when 'pending_stale'     then 'account_pending'::lead_status end
          and l.stage_entered_at < now() - make_interval(days => r.threshold_days)
      loop
        v_key := r.rule_key || ':' || rec.id || ':' || rec.stage_entered_at::date;
        for u in select * from app_users where deleted_at is null and role = any(r.target_roles) loop
          insert into notifications(user_id, rule_id, lead_id, affiliate_id, title, body, dedupe_key)
          values (u.id, r.id, rec.id, rec.affiliate_id, r.name,
                  rec.lead_code || ' – ' || rec.customer_name, v_key)
          on conflict (user_id, dedupe_key) do nothing;
        end loop;
        if r.notify_assigned_rm and rec.assigned_rm_id is not null then
          insert into notifications(user_id, rule_id, lead_id, affiliate_id, title, body, dedupe_key)
          values (rec.assigned_rm_id, r.id, rec.id, rec.affiliate_id, r.name,
                  rec.lead_code || ' – ' || rec.customer_name, v_key)
          on conflict (user_id, dedupe_key) do nothing;
        end if;
      end loop;
    elsif r.rule_key = 'affiliate_quiet' then
      for rec in
        select a.* from affiliates a
        where a.deleted_at is null and a.is_active
          and coalesce((select max(l.created_at) from leads l
                        where l.affiliate_id = a.id and l.deleted_at is null), a.created_at)
              < now() - make_interval(days => r.threshold_days)
      loop
        v_key := 'affiliate_quiet:' || rec.id || ':' || to_char(now(), 'IYYY-IW'); -- weekly re-alert
        for u in select * from app_users where deleted_at is null and role = any(r.target_roles) loop
          insert into notifications(user_id, rule_id, affiliate_id, title, body, dedupe_key)
          values (u.id, r.id, rec.id, r.name, rec.name || ' has gone quiet', v_key)
          on conflict (user_id, dedupe_key) do nothing;
        end loop;
      end loop;
    end if;
  end loop;
end $$;

-- ---------- pg_cron SCHEDULES ----------
select cron.schedule('scan-notifications',       '0 * * * *',   $$select fn_scan_notifications();$$);
select cron.schedule('refresh-affiliate-stats',  '*/15 * * * *', $$refresh materialized view concurrently mv_affiliate_stats;$$);

-- ---------- DOCUMENTS STORAGE BUCKET ----------
insert into storage.buckets (id, name, public)
values ('lead-documents', 'lead-documents', false)
on conflict (id) do nothing;

create policy "lead-docs read"   on storage.objects for select to authenticated
  using (bucket_id = 'lead-documents' and has_perm('documents','read'));
create policy "lead-docs insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'lead-documents' and has_perm('documents','create'));
create policy "lead-docs update" on storage.objects for update to authenticated
  using (bucket_id = 'lead-documents' and has_perm('documents','create'));
create policy "lead-docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lead-documents'
         and (has_perm('documents','delete') or app_current_role() = 'admin'));

-- ---- DOWN ----
-- select cron.unschedule('scan-notifications');
-- select cron.unschedule('refresh-affiliate-stats');
-- drop policy "lead-docs delete" on storage.objects; -- (+ read/insert/update)
-- delete from storage.buckets where id='lead-documents';
-- drop function if exists fn_scan_notifications();
-- drop view if exists v_lead_aging, v_monthly_cohorts, v_stage_durations, v_funnel_by_affiliate;
-- drop materialized view if exists mv_affiliate_stats;
-- drop view if exists v_affiliate_commission;
-- grant select (commission_pct) on affiliates to authenticated;
