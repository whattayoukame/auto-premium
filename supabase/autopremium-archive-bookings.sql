-- Auto Premium CRM: owner-only removal of test/unwanted bookings.
-- Apply to the existing project in Supabase SQL Editor BEFORE deploying the button.
-- Re-runnable; does not delete rows or existing financial history.
begin;

alter table public.bookings
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

-- Blocks even an outdated owner tab from changing an archived booking back to
-- a live status and occupying its slot. Other studio bookings are unaffected.
create or replace function public.autopremium_prevent_archived_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null and new.status is distinct from old.status then
    raise exception 'booking_archived';
  end if;
  return new;
end;
$$;

drop trigger if exists autopremium_prevent_archived_status_change on public.bookings;
create trigger autopremium_prevent_archived_status_change
before update of status on public.bookings
for each row execute function public.autopremium_prevent_archived_status_change();

-- SECURITY DEFINER is limited by the internal owner check. Never give the
-- browser direct DELETE or UPDATE(deleted_at) permissions.
create or replace function public.autopremium_archive_booking(p_studio uuid, p_booking uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_has_payments boolean := false;
begin
  if v_user is null or not exists (
    select 1 from public.studio_owners so
    join public.studios s on s.id = so.studio_id
    where so.user_id = v_user and so.studio_id = p_studio
      and s.slug = 'autopremium'
  ) then
    raise exception 'not_authorized';
  end if;

  -- Lock the booking during deletion; overlapping payment inserts wait on this
  -- row via their foreign key until the operation has committed.
  perform 1 from public.bookings b
    where b.id = p_booking and b.studio_id = p_studio and b.deleted_at is null
    for update;
  if not found then
    raise exception 'booking_not_found';
  end if;

  -- A paid/refunded booking must remain in the visible CRM for accounting.
  -- Payment ledger is optional in older installations.
  if to_regclass('public.autopremium_payments') is not null then
    execute 'select exists (select 1 from public.autopremium_payments where booking_id = $1)'
      into v_has_payments using p_booking;
  end if;
  if v_has_payments then
    raise exception 'booking_has_payments';
  end if;

  update public.bookings
    set status = 'cancelled', deleted_at = now(), deleted_by = v_user
    where id = p_booking and studio_id = p_studio;
end;
$$;

revoke all on function public.autopremium_archive_booking(uuid, uuid) from public, anon;
grant execute on function public.autopremium_archive_booking(uuid, uuid) to authenticated;

-- This trigger serializes a payment insert with archival of the same booking,
-- so a payment cannot slip in between the check and the status change.
create or replace function public.autopremium_guard_payment_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
begin
  select b.deleted_at into v_deleted_at from public.bookings b
    where b.id = new.booking_id for share;
  if v_deleted_at is not null then
    raise exception 'booking_archived';
  end if;
  return new;
end;
$$;

-- If the receipts table exists, disallow payments on archived bookings too.
do $$
begin
  if to_regclass('public.autopremium_payments') is not null then
    drop trigger if exists autopremium_guard_payment_booking on public.autopremium_payments;
    create trigger autopremium_guard_payment_booking
      before insert on public.autopremium_payments
      for each row execute function public.autopremium_guard_payment_booking();
    drop policy if exists "autopremium owner records payments" on public.autopremium_payments;
    create policy "autopremium owner records payments" on public.autopremium_payments
      for insert to authenticated with check (
        exists (
          select 1 from public.studio_owners so
          join public.studios s on s.id = so.studio_id
          join public.bookings b on b.studio_id = so.studio_id
          where so.studio_id = autopremium_payments.studio_id
            and b.id = autopremium_payments.booking_id and b.deleted_at is null
            and so.user_id = (select auth.uid()) and s.slug = 'autopremium'
        )
      );
  end if;
end $$;

commit;
