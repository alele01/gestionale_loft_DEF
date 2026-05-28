-- =============================================================================
-- Migration: lockdown grants on SECURITY DEFINER helper functions and add an
-- explicit deny-all RLS policy on `request_rate_limits`.
--
-- Why this is safe:
--   * `is_admin(uuid)` is referenced from RLS policy USING clauses. Policy
--     expressions are evaluated with the planner's permissions, so policies
--     continue to resolve the function even when EXECUTE is revoked from
--     anon/authenticated.
--   * `check_rate_limit(text, integer, integer)`,
--     `prune_rate_limit_buckets(integer)` and
--     `reserve_invoice_number(integer)` are ALWAYS called via the privileged
--     service-role Supabase client from server-side code; never exposed
--     to anon/authenticated `/rest/v1/rpc/...` calls. Revoking EXECUTE from
--     those roles eliminates the public RPC surface area without changing
--     behaviour.
--   * The deny-all policies on `request_rate_limits` are no-op at runtime
--     (the table is service-role only anyway), but they silence the
--     `rls_enabled_no_policy` linter (INFO) so the security advisor stays
--     clean.
--
-- See docs/SECURITY.md §3 ("Function & RPC exposure").
-- =============================================================================

-- 1. Revoke EXECUTE on the helper functions from public / anon / authenticated.
--    `service_role` retains EXECUTE because it bypasses GRANTs implicitly.

revoke execute on function public.is_admin(uuid) from public, anon, authenticated;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;

revoke execute on function public.prune_rate_limit_buckets(integer) from public, anon, authenticated;

revoke execute on function public.reserve_invoice_number(integer) from public, anon, authenticated;

-- 2. Explicit deny-all policies on `request_rate_limits`. The table is
--    written / read exclusively from inside `check_rate_limit()` running as
--    the function owner (postgres / service_role).

drop policy if exists request_rate_limits_deny_anon on public.request_rate_limits;
create policy request_rate_limits_deny_anon
  on public.request_rate_limits
  for all
  to anon
  using (false)
  with check (false);

drop policy if exists request_rate_limits_deny_authenticated on public.request_rate_limits;
create policy request_rate_limits_deny_authenticated
  on public.request_rate_limits
  for all
  to authenticated
  using (false)
  with check (false);
