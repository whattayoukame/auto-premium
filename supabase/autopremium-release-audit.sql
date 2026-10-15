-- AUTO PREMIUM: read-only pre-release database audit.
-- Run each numbered SELECT in Supabase SQL Editor with an administrator account.
-- This file contains no writes and does not create any bookings or payments.

-- 1. Required tables, RLS and availability of the newer payments/archiving schema.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('studios','services','bookings','studio_owners','owner_memberships','autopremium_payments')
  and c.relkind in ('r','p')
order by c.relname;

-- 2. Explicit table and column privileges for public browser roles.
-- Expected: no anonymous SELECT on bookings, studio_owners or autopremium_payments.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
  and table_name in ('bookings','studio_owners','autopremium_payments')
order by table_name, grantee, privilege_type;

select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
  and table_name in ('bookings','studio_owners','autopremium_payments')
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by table_name, column_name, grantee;

-- 3. Effective RLS policies. Inspect all existing policies, not just Auto Premium ones.
select tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname='public'
  and tablename in ('studios','services','bookings','studio_owners','autopremium_payments')
order by tablename, policyname;

-- 4. All RPC overloads. Verify SECURITY DEFINER, arguments and EXECUTE rights.
select p.oid::regprocedure::text as signature, p.prosecdef as security_definer,
       p.provolatile as volatility,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('create_booking','get_busy','autopremium_archive_booking',
   'autopremium_guard_payment_booking','autopremium_prevent_archived_status_change')
order by p.proname, p.oid::regprocedure::text;

-- 5. Inspect actual RPC bodies for validation, idempotency, owner checks and race safety.
select p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as function_body
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('create_booking','get_busy','autopremium_archive_booking')
order by p.proname;

-- 6. Unique idempotency, GiST no-overlap and status constraints on bookings.
select c.conname as constraint_name, c.contype as type,
       pg_get_constraintdef(c.oid) as definition
from pg_catalog.pg_constraint c
where c.conrelid='public.bookings'::regclass
order by c.conname;

-- 7. Installed booking/payment triggers (exclude system/foreign-key triggers).
select c.relname as table_name, t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal
  and c.relname in ('bookings','autopremium_payments')
order by c.relname, t.tgname;

-- 8. Owner membership count for the Auto Premium studio; no user identifiers printed.
select s.slug, count(so.user_id) as owner_memberships
from public.studios s left join public.studio_owners so on so.studio_id=s.id
where s.slug='autopremium'
group by s.slug;

-- 9. Installed optional dependencies: should be present before using payments/archive UI.
select to_regclass('public.autopremium_payments') is not null as payments_installed,
       to_regprocedure('public.autopremium_archive_booking(uuid,uuid)') is not null as archive_rpc_installed,
       to_regprocedure('public.autopremium_guard_payment_booking()') is not null as archive_payment_guard_installed;
