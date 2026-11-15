-- Local PostgreSQL stand-in for the Supabase roles and auth schema.
-- Do not run this on the hosted project; those roles already exist.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'manhal_user') then
    create role manhal_user login nosuperuser nobypassrls;
  end if;
end $$;

grant authenticated to manhal_user;
grant usage on schema auth to anon, authenticated, manhal_user;
grant execute on function auth.uid() to anon, authenticated, manhal_user;
