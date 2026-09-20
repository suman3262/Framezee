-- Keep public.users in step with Supabase's auth.users.
--
-- A trigger rather than app code: a row then exists for every signup, including ones
-- that never touch our app (dashboard invites, a future OAuth provider), and there is
-- no first-request race where a session exists but its profile row does not.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, phone, email, name)
  values (
    new.id,
    new.phone,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do update
    set phone = coalesce(excluded.phone, public.users.phone),
        email = coalesce(excluded.email, public.users.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Phone or email can be added later (a customer who signed up by email adds a phone at
-- checkout), so mirror updates too.
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of phone, email on auth.users
  for each row execute function public.handle_new_auth_user();
