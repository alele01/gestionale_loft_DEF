-- =============================================================================
-- Migration: performance hardening for admin-only RLS policies and admin
-- foreign keys.
--
-- 1. Rewrite the 11 admin-only SELECT policies so that `auth.uid()` is wrapped
--    in a subquery -- `(select auth.uid())`. This forces Postgres to evaluate
--    the auth lookup ONCE per query instead of ONCE per row scanned, which
--    matters on tables like `audit_log` (already ~160 rows, expected to grow
--    a lot in production). Closes Supabase database-linter lint 0003
--    (auth_rls_initplan).
--
-- 2. Add covering indexes on the four admin foreign keys that the linter
--    flagged as unindexed (lint 0001). Today these tables have <20 rows so
--    the planner picks sequential scans, but as bookings grow the join
--    against `admin_users` would become hot.
--
-- See docs/SECURITY.md §2 ("Row-level security model") and Supabase docs:
--   https://supabase.com/docs/guides/database/postgres/row-level-security
--     #call-functions-with-select
-- =============================================================================

-- 1. Rewrite policies. Each line is explicit (rather than a DO loop) so the
--    git diff is reviewable and easy to revert per-table if needed.

drop policy if exists admin_users_select_authenticated on public.admin_users;
create policy admin_users_select_authenticated
  on public.admin_users for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists app_settings_select_authenticated on public.app_settings;
create policy app_settings_select_authenticated
  on public.app_settings for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists audit_log_select_authenticated on public.audit_log;
create policy audit_log_select_authenticated
  on public.audit_log for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists booking_requests_select_authenticated on public.booking_requests;
create policy booking_requests_select_authenticated
  on public.booking_requests for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists bookings_select_authenticated on public.bookings;
create policy bookings_select_authenticated
  on public.bookings for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists email_log_select_authenticated on public.email_log;
create policy email_log_select_authenticated
  on public.email_log for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists events_select_authenticated on public.events;
create policy events_select_authenticated
  on public.events for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists fiscal_profiles_select_authenticated on public.fiscal_profiles;
create policy fiscal_profiles_select_authenticated
  on public.fiscal_profiles for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists payments_select_authenticated on public.payments;
create policy payments_select_authenticated
  on public.payments for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists xml_export_items_select_authenticated on public.xml_export_items;
create policy xml_export_items_select_authenticated
  on public.xml_export_items for select to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists xml_exports_select_authenticated on public.xml_exports;
create policy xml_exports_select_authenticated
  on public.xml_exports for select to authenticated
  using (public.is_admin((select auth.uid())));

-- 2. Covering indexes for the four admin FKs.

create index if not exists booking_requests_decided_by_idx
  on public.booking_requests(decided_by);

create index if not exists bookings_cancelled_after_payment_by_idx
  on public.bookings(cancelled_after_payment_by);

create index if not exists events_created_by_idx
  on public.events(created_by);

create index if not exists xml_exports_created_by_idx
  on public.xml_exports(created_by);
