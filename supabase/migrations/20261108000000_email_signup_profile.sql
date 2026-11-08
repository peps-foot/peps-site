begin;

-- Preflight check for the same normalized pseudo key used by
-- profiles_username_unique_ci: lower(trim(username)).
create or replace function public.peps_is_email_username_available(p_username text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_username text := pg_catalog.btrim(p_username);
begin
  if v_username is null or v_username = '' then
    return false;
  end if;

  return not exists (
    select 1
      from public.profiles as p
     where p.username is not null
       and pg_catalog.btrim(p.username) <> ''
       and pg_catalog.lower(pg_catalog.btrim(p.username)) = pg_catalog.lower(v_username)
  );
end;
$function$;

alter function public.peps_is_email_username_available(text) owner to postgres;
revoke all on function public.peps_is_email_username_available(text)
  from public, anon, authenticated, service_role;
grant execute on function public.peps_is_email_username_available(text)
  to anon, authenticated;

-- Create email-registration profiles atomically with Auth. The marker ensures
-- that other email users created outside PEPS's classic signup form are untouched.
create or replace function public.peps_create_email_signup_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_username text := pg_catalog.btrim(new.raw_user_meta_data ->> 'username');
  v_avatar text := nullif(new.raw_user_meta_data ->> 'avatar', '');
  v_constraint_name text;
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'email'
     or coalesce(new.raw_user_meta_data ->> 'peps_signup', '') <> 'true' then
    return new;
  end if;

  if v_username is null or pg_catalog.char_length(v_username) < 3 then
    raise exception 'PEPS signup requires a username with at least 3 characters';
  end if;

  begin
    insert into public.profiles (user_id, username, avatar)
    values (new.id, v_username, v_avatar)
    on conflict (user_id) do nothing;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name is distinct from 'profiles_username_unique_ci' then
        raise;
      end if;

      -- A concurrent signup claimed this username after the preflight check.
      -- Keep Auth/profile creation atomic and let the client request another pseudo.
      insert into public.profiles (user_id, username, avatar)
      values (new.id, null, v_avatar)
      on conflict (user_id) do nothing;
  end;

  insert into public.push_prefs (
    user_id,
    allow_admin_broadcast,
    allow_grid_done,
    allow_match_reminder_24h,
    allow_match_reminder_1h
  )
  values (new.id, true, true, true, true)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

alter function public.peps_create_email_signup_profile() owner to postgres;
revoke all on function public.peps_create_email_signup_profile()
  from public, anon, authenticated, service_role;

drop trigger if exists peps_create_email_signup_profile_after_auth_insert on auth.users;
create trigger peps_create_email_signup_profile_after_auth_insert
  after insert on auth.users
  for each row
  when (
    (new.raw_app_meta_data ->> 'provider') = 'email'
    and (new.raw_user_meta_data ->> 'peps_signup') = 'true'
  )
  execute function public.peps_create_email_signup_profile();

commit;
