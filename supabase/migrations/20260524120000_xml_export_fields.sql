-- ============================================================================
-- 20260524120000_xml_export_fields.sql
--
-- Schema changes required to fully wire the XML / FatturaPA export module
-- (see docs/XML_EXPORT.md). Three things:
--
--   1. Split private buyers into first/last name (SDI prefers
--      Anagrafica.Nome + Anagrafica.Cognome over a single Denominazione
--      for B2C). `legal_name` is kept NOT NULL for backward compatibility
--      and the application populates it as "{first} {last}" for private
--      buyers, so existing UI/email paths keep working.
--
--   2. Persist a per-year progressive counter on `app_settings` for the
--      `<Numero>` field. Format is "YYYY/NNNN". The application resets
--      the counter when `current_invoice_year` doesn't match the year of
--      the booking being exported.
--
--   3. Create a PRIVATE storage bucket `xml-exports` for the zipped
--      exports. Reads happen via signed URLs from server actions.
--
-- All changes are additive: previously-completed bookings continue to
-- work because the new columns are nullable / have safe defaults.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. fiscal_profiles: first_name / last_name (private buyers only)
-- ----------------------------------------------------------------------------
alter table public.fiscal_profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- Soft constraint: when kind = 'private', both names must be set OR neither
-- (the latter so we don't break legacy rows where the legal_name was a
-- single field). The XML generator enforces the strict shape at export
-- time; this check is only here to avoid half-populated rows for new
-- private completions.
alter table public.fiscal_profiles
  drop constraint if exists fiscal_profiles_private_name_chk;

alter table public.fiscal_profiles
  add constraint fiscal_profiles_private_name_chk
    check (
      kind <> 'private'
      or (
        (first_name is null and last_name is null)
        or (first_name is not null and last_name is not null)
      )
    );


-- ----------------------------------------------------------------------------
-- 2. app_settings: progressive invoice counter
-- ----------------------------------------------------------------------------
alter table public.app_settings
  add column if not exists next_invoice_number   int  not null default 1,
  add column if not exists current_invoice_year  int  not null default extract(year from now())::int,
  add column if not exists xml_export_last_run_at timestamptz;

-- Range check on the counter: protect against accidental rollback to 0
-- or negative numbers (which would create duplicate invoice numbers).
alter table public.app_settings
  drop constraint if exists app_settings_invoice_counter_chk;

alter table public.app_settings
  add constraint app_settings_invoice_counter_chk
    check (next_invoice_number >= 1 and current_invoice_year between 2000 and 9999);


-- ----------------------------------------------------------------------------
-- 2.1 reserve_invoice_number(target_year)
--
-- Atomic counter increment with implicit year reset. Returns the
-- (year, number) pair to use for the next invoice. Concurrent callers
-- are serialised by the row-level lock taken by `update returning`.
--
-- Behaviour:
--   - If `target_year` matches `current_invoice_year`: returns
--     `next_invoice_number`, then increments it.
--   - If `target_year` is greater: resets the counter to 2, returns
--     (target_year, 1).
--   - If `target_year` is less than `current_invoice_year`: raises an
--     exception. We never re-issue numbers for past years from V1.
--
-- Granting EXECUTE only to `service_role` because invoice numbers are a
-- legal trail; only the server-side export job touches this function.
-- ----------------------------------------------------------------------------
create or replace function public.reserve_invoice_number(target_year int)
returns table(year int, number int)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year   int;
  current_next   int;
  reserved_year  int;
  reserved_num   int;
begin
  select current_invoice_year, next_invoice_number
    into current_year, current_next
  from public.app_settings
  where id = 1
  for update;

  if current_year is null then
    raise exception 'app_settings row missing (id=1)';
  end if;

  if target_year < current_year then
    raise exception 'cannot reserve invoice number for past year (%, current=%)',
      target_year, current_year;
  end if;

  if target_year = current_year then
    reserved_year := current_year;
    reserved_num  := current_next;
    update public.app_settings
       set next_invoice_number = current_next + 1
     where id = 1;
  else
    -- new year: reset to 1 and return; the stored counter becomes 2.
    reserved_year := target_year;
    reserved_num  := 1;
    update public.app_settings
       set current_invoice_year = target_year,
           next_invoice_number  = 2
     where id = 1;
  end if;

  return query select reserved_year, reserved_num;
end;
$$;

revoke all on function public.reserve_invoice_number(int) from public;
grant execute on function public.reserve_invoice_number(int) to service_role;


-- ----------------------------------------------------------------------------
-- 2.2 email_log.entity_type — allow 'xml_export' for E10 sends.
--
-- The original constraint (migration 20260522120000) only allowed
-- booking_request / booking; with E10 wired in we attach the email to
-- the xml_exports row.
-- ----------------------------------------------------------------------------
alter table public.email_log
  drop constraint if exists email_log_entity_type_check;

alter table public.email_log
  add constraint email_log_entity_type_check
    check (entity_type in ('booking_request','booking','xml_export'));


-- ----------------------------------------------------------------------------
-- 3. Private Supabase Storage bucket for the zipped exports.
--
-- `storage.buckets` is the canonical location for bucket metadata in
-- Supabase Storage; we insert with `on conflict do nothing` so the
-- migration is safe to re-run.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('xml-exports', 'xml-exports', false)
  on conflict (id) do nothing;
