-- Run in Supabase SQL Editor after confirming studio_owners(user_id, studio_id)
-- and reviewing the definitions of create_booking/get_busy for safe input validation.
-- RPC functions must validate input and run SECURITY DEFINER; never open anon access to bookings.
-- All changes are atomic: a failed RPC signature/permission check rolls back this script.

begin;

-- Resolve only RPC overloads compatible with the web client, before changing RLS.
-- In particular, p_key may be uuid OR text in the existing database.
-- Do not grant anonymous EXECUTE to a different overload by accident.
do $$
declare
  booking_functions oid[];
  busy_functions oid[];
begin
  select array_agg(p.oid) into booking_functions
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_booking'
    and p.prokind = 'f' and p.pronargs = 7
    and p.proargnames[1:7] = array[
      'p_studio', 'p_service', 'p_name', 'p_phone', 'p_car', 'p_start', 'p_key'
    ]::text[]
    and p.proargtypes[0] = 'uuid'::regtype
    and p.proargtypes[1] = 'uuid'::regtype
    and p.proargtypes[2] = 'text'::regtype
    and p.proargtypes[3] = 'text'::regtype
    and p.proargtypes[4] = 'text'::regtype
    and p.proargtypes[5] = 'timestamptz'::regtype
    and p.proargtypes[6] in ('uuid'::regtype, 'text'::regtype)
    and p.prorettype = 'uuid'::regtype
    and p.prosecdef;

  select array_agg(p.oid) into busy_functions
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_busy'
    and p.prokind = 'f' and p.pronargs = 3
    and p.proargnames[1:3] = array['p_studio', 'p_from', 'p_to']::text[]
    and p.proargtypes[0] = 'uuid'::regtype
    and p.proargtypes[1] = 'timestamptz'::regtype
    and p.proargtypes[2] = 'timestamptz'::regtype
    and p.prosecdef;

  if coalesce(cardinality(booking_functions), 0) <> 1 then
    raise exception using message =
      'Expected exactly one SECURITY DEFINER public.create_booking with the client argument names, a uuid result, and p_key uuid or text. Inspect pg_proc before granting EXECUTE.';
  end if;
  if coalesce(cardinality(busy_functions), 0) <> 1 then
    raise exception using message =
      'Expected exactly one SECURITY DEFINER public.get_busy(p_studio uuid, p_from timestamptz, p_to timestamptz). Inspect pg_proc before granting EXECUTE.';
  end if;
end $$;

alter table public.studios enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.studio_owners enable row level security;

drop policy if exists "demo studio public read" on public.studios;
create policy "demo studio public read" on public.studios
  for select to anon, authenticated using (slug = 'demo');

drop policy if exists "demo services public read" on public.services;
create policy "demo services public read" on public.services
  for select to anon, authenticated using (
    exists (select 1 from public.studios s where s.id = studio_id and s.slug = 'demo')
  );

drop policy if exists "owner checks own membership" on public.studio_owners;
create policy "owner checks own membership" on public.studio_owners
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "owner sees studio bookings" on public.bookings;
create policy "owner sees studio bookings" on public.bookings
  for select to authenticated using (
    exists (select 1 from public.studio_owners so
      where so.studio_id = bookings.studio_id and so.user_id = (select auth.uid()))
  );

drop policy if exists "owner cancels studio bookings" on public.bookings;
create policy "owner cancels studio bookings" on public.bookings
  for update to authenticated
  using (exists (select 1 from public.studio_owners so
    where so.studio_id = bookings.studio_id and so.user_id = (select auth.uid())))
  with check (status = 'cancelled' and exists (select 1 from public.studio_owners so
    where so.studio_id = bookings.studio_id and so.user_id = (select auth.uid())));

grant select on public.studios, public.services to anon, authenticated;
grant select on public.studio_owners, public.bookings to authenticated;
revoke select, insert, update, delete on public.bookings from anon;
revoke update on public.bookings from anon, authenticated;
grant update(status) on public.bookings to authenticated;

-- pg_proc resolves the exact function signatures instead of assuming p_key uuid.
-- Postgres grants EXECUTE to PUBLIC by default; remove it before granting only
-- the two inspected RPC overloads to the site's roles.
do $$
declare
  booking_fn regprocedure;
  busy_fn regprocedure;
begin
  select p.oid::regprocedure into strict booking_fn
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_booking'
    and p.prokind = 'f' and p.pronargs = 7
    and p.proargnames[1:7] = array[
      'p_studio', 'p_service', 'p_name', 'p_phone', 'p_car', 'p_start', 'p_key'
    ]::text[]
    and p.proargtypes[0] = 'uuid'::regtype
    and p.proargtypes[1] = 'uuid'::regtype
    and p.proargtypes[2] = 'text'::regtype
    and p.proargtypes[3] = 'text'::regtype
    and p.proargtypes[4] = 'text'::regtype
    and p.proargtypes[5] = 'timestamptz'::regtype
    and p.proargtypes[6] in ('uuid'::regtype, 'text'::regtype)
    and p.prorettype = 'uuid'::regtype and p.prosecdef;

  select p.oid::regprocedure into strict busy_fn
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_busy'
    and p.prokind = 'f' and p.pronargs = 3
    and p.proargnames[1:3] = array['p_studio', 'p_from', 'p_to']::text[]
    and p.proargtypes[0] = 'uuid'::regtype
    and p.proargtypes[1] = 'timestamptz'::regtype
    and p.proargtypes[2] = 'timestamptz'::regtype
    and p.prosecdef;

  execute format('revoke execute on function %s from public', booking_fn);
  execute format('revoke execute on function %s from public', busy_fn);
  execute format('grant execute on function %s to anon, authenticated', booking_fn);
  execute format('grant execute on function %s to anon, authenticated', busy_fn);
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings') then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;

commit;
