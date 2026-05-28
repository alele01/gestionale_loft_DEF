-- ============================================================================
-- Cooker Loft V1 — Function hardening
-- ----------------------------------------------------------------------------
-- Pin search_path on every plpgsql trigger function so the function body
-- cannot be hijacked by a schema that shadows built-in identifiers (e.g. a
-- malicious public.now() function). Addresses Supabase security advisor
-- 'function_search_path_mutable' (lint 0011).
--
-- Most functions only reference NEW/OLD record fields and don't need to look
-- up any object by name; we set search_path = '' to make them as airtight as
-- possible. prevent_fiscal_edits_after_paid resolves public.bookings by name
-- inside the body so it keeps search_path = 'public'.
-- ============================================================================
alter function public.set_updated_at()                       set search_path = '';
alter function public.prevent_paid_edits()                   set search_path = '';
alter function public.prevent_fiscal_edits_after_paid()      set search_path = 'public';
alter function public.prevent_revision_decrement()           set search_path = '';
alter function public.enforce_operational_cancel_invariants() set search_path = '';
