begin;

-- Create a profile and default push preferences only for newly inserted Google users.
-- This function runs as postgres so the auth.users trigger can write to both tables
-- independently of the caller's RLS policies.
create or replace function public.peps_create_google_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
    return new;
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, null)
  on conflict (user_id) do nothing;

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

-- Make the definer role explicit. The migration must be run by a role allowed to
-- transfer function ownership to postgres (as is standard for Supabase migrations).
alter function public.peps_create_google_profile() owner to postgres;
revoke all on function public.peps_create_google_profile()
  from public, anon, authenticated, service_role;

drop trigger if exists peps_create_google_profile_after_auth_insert on auth.users;
create trigger peps_create_google_profile_after_auth_insert
  after insert on auth.users
  for each row
  when ((new.raw_app_meta_data ->> 'provider') = 'google')
  execute function public.peps_create_google_profile();

-- Assign a unique userNNNNNN pseudo to the authenticated user's existing profile.
-- The unique expression index on lower(trim(username)) remains the final arbiter
-- for collisions, including concurrent calls.
create or replace function public.peps_assign_provisional_username()
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_username text;
  v_candidate text;
  v_start integer;
  v_constraint_name text;
  v_offset integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select p.username
    into v_username
    from public.profiles as p
   where p.user_id = v_user_id
   for update;

  if not found then
    raise exception 'Profile does not exist';
  end if;

  -- Make retries idempotent if the client calls the RPC again after a lost response.
  if v_username is not null and pg_catalog.btrim(v_username) <> '' then
    return v_username;
  end if;

  v_start := pg_catalog.floor(pg_catalog.random() * 1000000)::integer;

  for v_offset in 0..999999 loop
    v_candidate := 'user' || pg_catalog.lpad(((v_start + v_offset) % 1000000)::text, 6, '0');

    begin
      update public.profiles as p
         set username = v_candidate
       where p.user_id = v_user_id
         and (p.username is null or pg_catalog.btrim(p.username) = '')
      returning p.username into v_username;

      if found then
        return v_username;
      end if;

      -- Another request may have set the username while this call waited.
      select p.username
        into v_username
        from public.profiles as p
       where p.user_id = v_user_id;

      if found and v_username is not null and pg_catalog.btrim(v_username) <> '' then
        return v_username;
      end if;
    exception
      when unique_violation then
        get stacked diagnostics v_constraint_name = constraint_name;
        if v_constraint_name <> 'profiles_username_unique_ci' then
          raise;
        end if;
        -- A different profile owns this candidate; try the next six-digit value.
    end;
  end loop;

  raise exception 'No provisional username is available';
end;
$function$;

alter function public.peps_assign_provisional_username() owner to postgres;
revoke all on function public.peps_assign_provisional_username()
  from public, anon, service_role;
grant execute on function public.peps_assign_provisional_username() to authenticated;

commit;
