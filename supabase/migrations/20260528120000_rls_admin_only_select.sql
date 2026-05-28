-- ============================================================================
-- Phase 2 RLS tighten (production hardening)
-- ----------------------------------------------------------------------------
-- The Phase 1 init schema enabled RLS on every operational table but kept
-- the SELECT policy permissive (`using (true)`) for the `authenticated`
-- role, with a TODO to tighten once auth was fully wired.
--
-- This migration replaces every `using (true)` SELECT policy with a strict
-- admin gate: an authenticated user can only read a row if they exist in
-- `public.admin_users` with `role = 'admin'`. Anyone signed in to
-- Supabase but NOT in `admin_users` (which should not happen in V1, but
-- could happen if the project ever onboards customer-facing accounts)
-- gets zero rows from every operational table.
--
-- Service-role writes are unaffected: the service-role key bypasses RLS
-- by Supabase convention, and that's the role used by every server
-- action / route handler / cron job in this codebase.
--
-- Idempotent: each `drop policy if exists` + `create policy` pair is
-- safe to re-run. We also wrap the admin-existence check in a SECURITY
-- DEFINER helper function to avoid recursive policy evaluation (a policy
-- on `admin_users` cannot itself SELECT from `admin_users` without
-- DEFINER bypass).
--
-- Also adds explicit Storage policies for the private `xml-exports`
-- bucket: deny ALL access to `anon` and `authenticated`. The bucket is
-- already declared private (init via `storage.buckets.public = false`)
-- and the absence of policies on `storage.objects` already denies by
-- default, but explicit policies prevent surprises if future migrations
-- add broad storage policies.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER helper to break the admin_users recursion.
-- ----------------------------------------------------------------------------
-- Search path is locked to public to avoid path-injection (matches the
-- hardening pattern in 20260520120100_harden_function_search_path.sql).
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where id = p_user_id
      and role = 'admin'
  );
$$;

comment on function public.is_admin(uuid) is
  'Returns true iff the given user id has an admin row in public.admin_users with role=admin. SECURITY DEFINER so it can be referenced from RLS policies on admin_users itself without infinite recursion.';

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, anon, service_role;


-- ----------------------------------------------------------------------------
-- 2. Replace the permissive SELECT policies with the admin-gated ones.
-- ----------------------------------------------------------------------------
-- Every operational table from init_schema.sql + email_log from
-- emails_and_settings.sql is covered. Policy names mirror the originals
-- (`<table>_select_authenticated`) so any downstream tooling that
-- introspects pg_policies sees a stable name.

drop policy if exists admin_users_select_authenticated on public.admin_users;
create policy admin_users_select_authenticated
  on public.admin_users for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists events_select_authenticated on public.events;
create policy events_select_authenticated
  on public.events for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists booking_requests_select_authenticated on public.booking_requests;
create policy booking_requests_select_authenticated
  on public.booking_requests for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists bookings_select_authenticated on public.bookings;
create policy bookings_select_authenticated
  on public.bookings for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists fiscal_profiles_select_authenticated on public.fiscal_profiles;
create policy fiscal_profiles_select_authenticated
  on public.fiscal_profiles for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists payments_select_authenticated on public.payments;
create policy payments_select_authenticated
  on public.payments for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists xml_exports_select_authenticated on public.xml_exports;
create policy xml_exports_select_authenticated
  on public.xml_exports for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists xml_export_items_select_authenticated on public.xml_export_items;
create policy xml_export_items_select_authenticated
  on public.xml_export_items for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists audit_log_select_authenticated on public.audit_log;
create policy audit_log_select_authenticated
  on public.audit_log for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists app_settings_select_authenticated on public.app_settings;
create policy app_settings_select_authenticated
  on public.app_settings for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists email_log_select_authenticated on public.email_log;
create policy email_log_select_authenticated
  on public.email_log for select to authenticated
  using (public.is_admin(auth.uid()));


-- ----------------------------------------------------------------------------
-- 3. Storage: explicit deny on xml-exports for anon/authenticated.
-- ----------------------------------------------------------------------------
-- The bucket already has `public=false`, but RLS on `storage.objects`
-- is governed by policies created via Supabase Dashboard or manual
-- inserts. We add explicit "no access" policies for anon and
-- authenticated so that future additions of broader policies cannot
-- accidentally leak the zip archives.
--
-- Service-role bypasses these policies (as it bypasses all RLS), so
-- `runXmlExport` and the signed-URL generation in admin actions keep
-- working unchanged.

drop policy if exists xml_exports_storage_deny_anon on storage.objects;
create policy xml_exports_storage_deny_anon
  on storage.objects for all to anon
  using (bucket_id <> 'xml-exports')
  with check (bucket_id <> 'xml-exports');

drop policy if exists xml_exports_storage_deny_authenticated on storage.objects;
create policy xml_exports_storage_deny_authenticated
  on storage.objects for all to authenticated
  using (bucket_id <> 'xml-exports')
  with check (bucket_id <> 'xml-exports');
