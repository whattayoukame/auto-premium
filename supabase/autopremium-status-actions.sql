-- Auto Premium: run ONCE (or safely rerun) in Supabase SQL Editor for an
-- existing installation before using the new /admin status selector.
-- Preserves all bookings, existing statuses, and other tenants' cancellation policy.
begin;

do $$
declare
  status_column smallint;
  status_constraint record;
begin
  select attnum into status_column from pg_attribute
    where attrelid = 'public.bookings'::regclass and attname = 'status'
      and atttypid = 'text'::regtype and not attisdropped;
  if status_column is null then
    raise exception 'Expected public.bookings.status of type text; inspect the schema before migration';
  end if;

  -- Replace only CHECK constraints referencing the status column alone.
  -- Preserve multi-column constraints, exclusions and all other business rules.
  for status_constraint in
    select conname from pg_constraint
    where conrelid = 'public.bookings'::regclass and contype = 'c'
      and conkey = array[status_column]::smallint[]
  loop
    execute format('alter table public.bookings drop constraint %I', status_constraint.conname);
  end loop;

  alter table public.bookings
    add constraint bookings_status_check
    check (status in ('new','reserved','arrived','ready','completed','cancelled'));
end $$;

drop policy if exists "owner updates autopremium booking statuses" on public.bookings;
create policy "owner updates autopremium booking statuses" on public.bookings
  for update to authenticated
  using (exists (select 1 from public.studio_owners so
    join public.studios s on s.id = so.studio_id
    where so.studio_id = bookings.studio_id and so.user_id = (select auth.uid())
      and s.slug = 'autopremium'))
  with check (status in ('new','reserved','ready','completed','cancelled') and
    exists (select 1 from public.studio_owners so
      join public.studios s on s.id = so.studio_id
      where so.studio_id = bookings.studio_id and so.user_id = (select auth.uid())
        and s.slug = 'autopremium'));

-- Previous setup already grants UPDATE(status); ensure it for existing installs.
grant update(status) on public.bookings to authenticated;

commit;
