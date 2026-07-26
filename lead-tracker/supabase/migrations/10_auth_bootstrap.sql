-- ============================================================================
-- 10_auth_bootstrap
-- Link Supabase Auth users to app_users. The FIRST signup becomes Admin; every
-- later signup starts as Read-Only with no data access until an Admin promotes
-- them in Settings -> Team. Do this signup yourself before sharing the URL.
-- ============================================================================

-- ---- UP ----
create or replace function handle_new_auth_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_count int; v_role user_role;
begin
  select count(*) into v_count from app_users;
  v_role := case when v_count = 0 then 'admin' else 'read_only' end;

  insert into app_users (auth_user_id, full_name, email, role, is_rm)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    v_role,
    false
  )
  on conflict (auth_user_id) do nothing;

  return new;
end $$;

drop trigger if exists t_on_auth_user_created on auth.users;
create trigger t_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ---- DOWN ----
-- drop trigger if exists t_on_auth_user_created on auth.users;
-- drop function if exists handle_new_auth_user();
