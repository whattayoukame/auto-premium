-- Auto Premium: optional owner-only payment/return ledger for the CRM dashboard.
-- Review and execute in Supabase SQL Editor; it does not change existing bookings.
-- Amounts here are actual recorded receipts/refunds, not service list prices.
begin;

create table if not exists public.autopremium_payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id),
  booking_id uuid not null references public.bookings(id),
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('payment', 'refund')),
  created_at timestamptz not null default now()
);

create index if not exists autopremium_payments_studio_date
  on public.autopremium_payments(studio_id, created_at);

alter table public.autopremium_payments enable row level security;

drop policy if exists "autopremium owner reads payments" on public.autopremium_payments;
create policy "autopremium owner reads payments" on public.autopremium_payments
  for select to authenticated using (
    exists (
      select 1 from public.studio_owners so
      join public.studios s on s.id = so.studio_id
      where so.studio_id = autopremium_payments.studio_id
        and so.user_id = (select auth.uid()) and s.slug = 'autopremium'
    )
  );

drop policy if exists "autopremium owner records payments" on public.autopremium_payments;
create policy "autopremium owner records payments" on public.autopremium_payments
  for insert to authenticated with check (
    exists (
      select 1 from public.studio_owners so
      join public.studios s on s.id = so.studio_id
      join public.bookings b on b.studio_id = so.studio_id
      where so.studio_id = autopremium_payments.studio_id
        and b.id = autopremium_payments.booking_id
        and so.user_id = (select auth.uid()) and s.slug = 'autopremium'
    )
  );

revoke all on public.autopremium_payments from public, anon;
revoke update, delete on public.autopremium_payments from authenticated;
grant select, insert on public.autopremium_payments to authenticated;

commit;
