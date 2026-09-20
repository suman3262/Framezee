-- Lock the tables down at the database.
--
-- Supabase serves every table in `public` over PostgREST, and grants anon/authenticated
-- access by default. Without RLS, anyone holding the publishable key — which ships to the
-- browser by design — could read orders, payments and customer addresses directly.
--
-- Enabling RLS with no policies denies all PostgREST access. The app is unaffected: it
-- talks to Postgres through Drizzle as the owner, which bypasses RLS.

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '__drizzle_migrations'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- The owner must keep working; FORCE RLS would otherwise apply to it too.
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '__drizzle_migrations'
  loop
    execute format('alter table public.%I no force row level security', t);
  end loop;
end $$;
