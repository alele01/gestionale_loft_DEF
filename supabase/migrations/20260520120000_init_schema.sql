-- ============================================================================
-- Cooker Loft V1 — Initial schema
-- ----------------------------------------------------------------------------
-- This migration creates the entire V1 database surface described in
-- docs/DB_SCHEMA.md in a single, reviewable bundle, as required by
-- docs/TASK_PLAN.md §7.
--
-- Sections:
--   1. Extensions
--   2. Tables (admin_users, events, booking_requests, bookings,
--              fiscal_profiles, payments, xml_exports, xml_export_items,
--              audit_log, app_settings)
--   3. Indexes (including partial indexes)
--   4. Trigger functions + triggers (set_updated_at, prevent_paid_edits,
--      prevent_fiscal_edits_after_paid, prevent_revision_decrement,
--      enforce_operational_cancel_invariants)
--   5. Row-level security: enable on every table + minimal policies
--   6. Seed app_settings (single row, id = 1)
--
-- Hard rules enforced at the database layer (see docs/SECURITY.md):
--   - Every operational table has RLS enabled. anon has NO policies.
--   - booking_requests rejects rows with any consent_*_accepted = false.
--   - bookings rows in status = 'paid' cannot have amount_cents/people/
--     revision/consents mutated (only operational-cancel marker fields plus
--     review_email_sent_at + updated_at are allowed).
--   - bookings.revision is monotonically non-decreasing.
--   - operational-cancel marker columns move together and only on paid.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";


-- ============================================================================
-- 2. Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 admin_users — see docs/DB_SCHEMA.md §3.1
-- Backed by Supabase Auth: id mirrors auth.users.id.
-- ----------------------------------------------------------------------------
create table public.admin_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'admin' check (role in ('admin')),
  created_at  timestamptz not null default now()
);

create unique index admin_users_email_key on public.admin_users (lower(email));


-- ----------------------------------------------------------------------------
-- 2.2 events — see docs/DB_SCHEMA.md §3.2
-- Lifecycle states: draft | published | closed | archived (see docs/STATES.md §12).
-- price_cents is the per-person GROSS price (IVA inclusa).
-- vat_rate_bps is the VAT rate in basis points (default 2200 = 22.00%).
-- ----------------------------------------------------------------------------
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  description   text,
  starts_at     timestamptz not null,
  duration_min  int,
  capacity      int  not null,
  price_cents   bigint not null,
  currency      text not null default 'EUR',
  vat_rate_bps  int  not null default 2200,
  status        text not null default 'draft',
  created_by    uuid not null references public.admin_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint events_starts_after_created_chk
    check (starts_at > created_at),
  constraint events_duration_positive_chk
    check (duration_min is null or duration_min > 0),
  constraint events_capacity_positive_chk
    check (capacity > 0),
  constraint events_price_positive_chk
    check (price_cents > 0),
  constraint events_currency_eur_chk
    check (currency = 'EUR'),
  constraint events_vat_rate_range_chk
    check (vat_rate_bps >= 0 and vat_rate_bps <= 5000),
  constraint events_status_chk
    check (status in ('draft', 'published', 'closed', 'archived'))
);

create index events_status_starts_idx
  on public.events (status, starts_at);


-- ----------------------------------------------------------------------------
-- 2.3 booking_requests — see docs/DB_SCHEMA.md §3.3
-- Public-form submissions, prior to admin triage.
-- The three consent_*_accepted columns are constrained to TRUE so an unchecked
-- consent cannot reach the database.
-- ----------------------------------------------------------------------------
create table public.booking_requests (
  id                              uuid primary key default gen_random_uuid(),
  event_id                        uuid not null references public.events(id),

  requester_first_name            text not null,
  requester_last_name             text not null,
  requester_email                 text not null,
  requester_phone                 text not null,

  people                          int  not null,
  dietary_notes                   text,
  special_occasion                text,
  notes                           text,

  status                          text not null default 'pending',
  source                          text not null default 'embed',

  submitted_at                    timestamptz not null default now(),
  decided_at                      timestamptz,
  decided_by                      uuid references public.admin_users(id),
  decision_reason                 text,
  decision_share_with_requester   boolean not null default false,

  ip_address                      inet not null,
  user_agent                      text not null,

  -- Consent triplet: terms
  consent_terms_accepted          boolean not null default false,
  consent_terms_accepted_at       timestamptz not null,
  consent_terms_version           text not null,

  -- Consent triplet: privacy
  consent_privacy_accepted        boolean not null default false,
  consent_privacy_accepted_at     timestamptz not null,
  consent_privacy_version         text not null,

  -- Consent triplet: explicit health-data (GDPR art. 9.2.a)
  consent_health_accepted         boolean not null default false,
  consent_health_accepted_at      timestamptz not null,
  consent_health_version          text not null,

  consent_submitted_at            timestamptz not null,

  constraint booking_requests_people_positive_chk
    check (people > 0),
  constraint booking_requests_status_chk
    check (status in ('pending','accepted','rejected','waitlisted','cancelled','expired')),
  constraint booking_requests_source_chk
    check (source in ('embed', 'admin')),
  constraint booking_requests_consent_terms_true_chk
    check (consent_terms_accepted = true),
  constraint booking_requests_consent_privacy_true_chk
    check (consent_privacy_accepted = true),
  constraint booking_requests_consent_health_true_chk
    check (consent_health_accepted = true)
);

create index booking_requests_event_status_submitted_idx
  on public.booking_requests (event_id, status, submitted_at);

create index booking_requests_event_status_terminal_idx
  on public.booking_requests (event_id, status)
  where status in ('rejected', 'cancelled', 'expired');

create index booking_requests_email_idx
  on public.booking_requests (lower(requester_email));


-- ----------------------------------------------------------------------------
-- 2.4 bookings — see docs/DB_SCHEMA.md §3.4
-- Durable booking, created on acceptance. Holds completion token, fiscal-tied
-- amount, Stripe linkage, paid timestamp, and the post-payment operational
-- cancellation marker. Revision is monotonic.
-- ----------------------------------------------------------------------------
create table public.bookings (
  id                                   uuid primary key default gen_random_uuid(),
  request_id                           uuid not null unique references public.booking_requests(id),
  event_id                             uuid not null references public.events(id),

  status                               text not null default 'awaiting_completion',
  revision                             int  not null default 1,
  origin                               text not null default 'direct',

  people                               int  not null,
  amount_cents                         bigint not null,
  currency                             text not null default 'EUR',

  completion_token_hash                bytea not null,
  completion_token_last4               text,
  completion_token_used_at             timestamptz,
  completion_token_issued_at           timestamptz not null,
  completion_deadline_at               timestamptz not null,
  payment_deadline_at                  timestamptz,

  special_occasion                     text,
  dietary_notes                        text,

  consents                             jsonb,
  legal_accepted_at                    timestamptz,
  privacy_accepted_at                  timestamptz,
  health_consent_accepted_at           timestamptz,
  image_use_choice                     text,
  consent_ip                           inet,
  consent_user_agent                   text,

  stripe_session_id                    text,
  stripe_payment_intent_id             text,
  amount_paid_cents                    bigint,
  paid_at                              timestamptz,

  cancelled_after_payment_at           timestamptz,
  cancelled_after_payment_by           uuid references public.admin_users(id),
  cancelled_after_payment_reason       text,
  cancellation_affects_review_email    boolean not null default true,

  review_email_sent_at                 timestamptz,

  voided_at                            timestamptz,
  void_reason                          text,

  created_at                           timestamptz not null default now(),
  updated_at                           timestamptz not null default now(),

  constraint bookings_status_chk
    check (status in ('awaiting_completion','awaiting_payment','paid','expired','void')),
  constraint bookings_revision_positive_chk
    check (revision >= 1),
  constraint bookings_origin_chk
    check (origin in ('direct', 'waitlist')),
  constraint bookings_people_positive_chk
    check (people > 0),
  constraint bookings_currency_eur_chk
    check (currency = 'EUR'),
  constraint bookings_image_use_chk
    check (image_use_choice is null or image_use_choice in ('accept','decline')),
  constraint bookings_amount_paid_nonneg_chk
    check (amount_paid_cents is null or amount_paid_cents >= 0),
  -- When status = 'paid', payment fields must be populated.
  constraint bookings_paid_requires_payment_chk
    check (
      status <> 'paid'
      or (
        stripe_payment_intent_id is not null
        and amount_paid_cents is not null
        and paid_at is not null
      )
    ),
  -- awaiting_payment requires a Stripe session.
  constraint bookings_awaiting_payment_requires_session_chk
    check (
      status <> 'awaiting_payment'
      or stripe_session_id is not null
    ),
  -- Operational-cancel marker columns move together and only on paid.
  constraint bookings_operational_cancel_chk
    check (
      cancelled_after_payment_at is null
      or (
        status = 'paid'
        and cancelled_after_payment_by is not null
        and cancelled_after_payment_reason is not null
      )
    ),
  -- review_email_sent_at only on paid + not operationally cancelled.
  constraint bookings_review_email_chk
    check (
      review_email_sent_at is null
      or (
        status = 'paid'
        and cancelled_after_payment_at is null
      )
    ),
  -- consents jsonb implies the scalar rollups are set.
  constraint bookings_consents_rollup_chk
    check (
      consents is null
      or (
        legal_accepted_at is not null
        and privacy_accepted_at is not null
        and health_consent_accepted_at is not null
        and image_use_choice is not null
      )
    )
);

create unique index bookings_completion_token_hash_uniq
  on public.bookings (completion_token_hash);

create index bookings_event_status_idx
  on public.bookings (event_id, status);

create index bookings_paid_at_idx
  on public.bookings (paid_at);

create index bookings_revision_idx
  on public.bookings (revision);

-- Partial index for the deadlines job.
create index bookings_status_deadlines_idx
  on public.bookings (status)
  where status in ('awaiting_completion','awaiting_payment');

-- Partial index for the daily E9 review-email cron.
create index bookings_review_email_due_idx
  on public.bookings (paid_at)
  where status = 'paid'
    and cancelled_after_payment_at is null
    and review_email_sent_at is null;


-- ----------------------------------------------------------------------------
-- 2.5 fiscal_profiles — see docs/DB_SCHEMA.md §3.5
-- 1:1 with bookings. Separate table so we can apply stricter RLS / handling.
-- ----------------------------------------------------------------------------
create table public.fiscal_profiles (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null unique references public.bookings(id) on delete cascade,
  kind             text not null,
  legal_name       text not null,
  tax_code         text,
  vat_number       text,
  address_street   text not null,
  address_city     text not null,
  address_zip      text not null,
  address_province text,
  address_country  text not null default 'IT',
  sdi_code         text,
  pec_email        text,
  invoice_note     text,
  created_at       timestamptz not null default now(),

  constraint fiscal_profiles_kind_chk
    check (kind in ('private','company'))
);


-- ----------------------------------------------------------------------------
-- 2.6 payments — see docs/DB_SCHEMA.md §3.6
-- Append-only Stripe event log. Idempotency anchored on stripe_event_id.
-- ----------------------------------------------------------------------------
create table public.payments (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid not null references public.bookings(id),
  stripe_event_id           text not null unique,
  stripe_event_type         text not null,
  stripe_payment_intent_id  text,
  stripe_session_id         text,
  amount_cents              bigint,
  currency                  text,
  status                    text not null,
  raw_event                 jsonb not null,
  received_at               timestamptz not null default now(),
  processed_at              timestamptz,
  error_message             text,

  constraint payments_status_chk
    check (status in ('received','processed','ignored','error'))
);

create index payments_booking_idx
  on public.payments (booking_id);


-- ----------------------------------------------------------------------------
-- 2.7 xml_exports — see docs/DB_SCHEMA.md §3.7
-- One row per generated XML batch (manual period, manual selection, or
-- scheduled monthly).
-- ----------------------------------------------------------------------------
create table public.xml_exports (
  id               uuid primary key default gen_random_uuid(),
  period_start     timestamptz not null,
  period_end       timestamptz not null,
  status           text not null default 'generating',
  storage_path     text,
  recipient_email  text not null,
  email_message_id text,
  generated_at     timestamptz,
  emailed_at       timestamptz,
  error_message    text,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.admin_users(id),

  constraint xml_exports_period_order_chk
    check (period_end > period_start),
  constraint xml_exports_status_chk
    check (status in ('generating','generated','emailed','failed'))
);

create index xml_exports_period_idx
  on public.xml_exports (period_start, period_end);

create index xml_exports_status_idx
  on public.xml_exports (status);


-- ----------------------------------------------------------------------------
-- 2.8 xml_export_items — see docs/DB_SCHEMA.md §3.8
-- Join table: which paid bookings are included in which export.
-- ----------------------------------------------------------------------------
create table public.xml_export_items (
  id             uuid primary key default gen_random_uuid(),
  xml_export_id  uuid not null references public.xml_exports(id) on delete cascade,
  booking_id     uuid not null references public.bookings(id)
);

create unique index xml_export_items_export_booking_uniq
  on public.xml_export_items (xml_export_id, booking_id);

create index xml_export_items_booking_idx
  on public.xml_export_items (booking_id);


-- ----------------------------------------------------------------------------
-- 2.9 audit_log — see docs/DB_SCHEMA.md §3.9
-- Every state transition and admin action writes a row here.
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  from_state   text,
  to_state     text,
  action       text not null,
  actor_type   text not null,
  actor_id     uuid,
  reason       text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),

  constraint audit_log_entity_type_chk
    check (entity_type in ('booking_request','booking','event','xml_export')),
  constraint audit_log_actor_type_chk
    check (actor_type in ('admin','representative','system','webhook','cron'))
);

create index audit_log_entity_created_idx
  on public.audit_log (entity_type, entity_id, created_at);


-- ----------------------------------------------------------------------------
-- 2.10 app_settings — see docs/DB_SCHEMA.md §3.10
-- Single-row config (CHECK id = 1). Holds runtime config the admin can edit
-- without a redeploy.
-- ----------------------------------------------------------------------------
create table public.app_settings (
  id                            int  primary key,
  accountant_email              text not null,
  xml_export_cron_enabled       boolean not null default true,
  completion_window_hours       int  not null default 72,
  payment_window_hours          int  not null default 24,
  review_url                    text,
  review_email_enabled          boolean not null default true,
  terms_version                 text not null,
  privacy_version               text not null,
  health_consent_version        text not null,
  image_use_consent_version     text not null,
  clauses_1341_1342_version     text not null,
  updated_at                    timestamptz not null default now(),

  constraint app_settings_singleton_chk
    check (id = 1)
);


-- ============================================================================
-- 4. Trigger functions + triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 set_updated_at()
-- Maintains updated_at on tables that carry it.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 4.2 prevent_paid_edits()
-- Once a booking is paid, only the operational-cancel marker fields, the
-- review email timestamp, and updated_at can change. Everything fiscal /
-- contractual is frozen (see docs/NON_GOALS.md §16).
-- ----------------------------------------------------------------------------
create or replace function public.prevent_paid_edits()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'paid' then
    if new.amount_cents is distinct from old.amount_cents then
      raise exception 'bookings.amount_cents cannot be edited after paid';
    end if;
    if new.people is distinct from old.people then
      raise exception 'bookings.people cannot be edited after paid';
    end if;
    if new.revision is distinct from old.revision then
      raise exception 'bookings.revision cannot be edited after paid';
    end if;
    if new.consents is distinct from old.consents then
      raise exception 'bookings.consents cannot be edited after paid';
    end if;
  end if;
  return new;
end;
$$;

create trigger bookings_prevent_paid_edits
  before update on public.bookings
  for each row execute function public.prevent_paid_edits();


-- ----------------------------------------------------------------------------
-- 4.3 prevent_fiscal_edits_after_paid()
-- Block any update to fiscal_profiles when the related booking is paid.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_fiscal_edits_after_paid()
returns trigger
language plpgsql
as $$
declare
  booking_status text;
begin
  select b.status into booking_status
  from public.bookings b
  where b.id = old.booking_id;

  if booking_status = 'paid' then
    raise exception 'fiscal_profiles cannot be edited after the booking is paid';
  end if;

  return new;
end;
$$;

create trigger fiscal_profiles_prevent_paid_edits
  before update on public.fiscal_profiles
  for each row execute function public.prevent_fiscal_edits_after_paid();


-- ----------------------------------------------------------------------------
-- 4.4 prevent_revision_decrement()
-- revision is monotonically non-decreasing on bookings.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_revision_decrement()
returns trigger
language plpgsql
as $$
begin
  if new.revision < old.revision then
    raise exception 'bookings.revision cannot decrease (old=%, new=%)',
      old.revision, new.revision;
  end if;
  return new;
end;
$$;

create trigger bookings_prevent_revision_decrement
  before update on public.bookings
  for each row execute function public.prevent_revision_decrement();


-- ----------------------------------------------------------------------------
-- 4.5 enforce_operational_cancel_invariants()
-- The operational-cancel marker columns must move together (all set or all
-- null) and only when status = 'paid'.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_operational_cancel_invariants()
returns trigger
language plpgsql
as $$
declare
  any_set boolean;
  all_set boolean;
begin
  any_set := new.cancelled_after_payment_at is not null
          or new.cancelled_after_payment_by is not null
          or new.cancelled_after_payment_reason is not null;
  all_set := new.cancelled_after_payment_at is not null
          and new.cancelled_after_payment_by is not null
          and new.cancelled_after_payment_reason is not null;

  if any_set and not all_set then
    raise exception
      'cancelled_after_payment_at/by/reason must all be set together (or all null)';
  end if;

  if any_set and new.status <> 'paid' then
    raise exception
      'operational cancellation marker is only allowed when status = paid';
  end if;

  return new;
end;
$$;

create trigger bookings_enforce_operational_cancel
  before insert or update on public.bookings
  for each row execute function public.enforce_operational_cancel_invariants();


-- ============================================================================
-- 5. Row-level security (RLS)
-- ----------------------------------------------------------------------------
-- Hard rule (docs/SECURITY.md §9, docs/DB_SCHEMA.md §4):
--   - RLS is enabled on EVERY operational table.
--   - The `anon` role has NO policies on any operational table.
--   - The `authenticated` role gets SELECT on operational tables for the admin
--     dashboard, but NO direct write access — all writes go through server
--     code under the service-role key (the state machine is the single writer).
--   - The `service_role` bypasses RLS by Supabase convention.
--
-- Note: Phase 1 keeps the SELECT policy permissive (authenticated → all rows).
-- Phase 2 will tighten this by requiring an admin_users row for the
-- authenticated user; we keep the permissive surface here so the admin client
-- can already query through the service role without surprises.
-- ============================================================================

alter table public.admin_users        enable row level security;
alter table public.events             enable row level security;
alter table public.booking_requests   enable row level security;
alter table public.bookings           enable row level security;
alter table public.fiscal_profiles    enable row level security;
alter table public.payments           enable row level security;
alter table public.xml_exports        enable row level security;
alter table public.xml_export_items   enable row level security;
alter table public.audit_log          enable row level security;
alter table public.app_settings       enable row level security;

-- authenticated → SELECT-only baseline. This will be tightened in Phase 2
-- (require existence in admin_users) once the auth flow is wired.
create policy admin_users_select_authenticated
  on public.admin_users for select to authenticated using (true);

create policy events_select_authenticated
  on public.events for select to authenticated using (true);

create policy booking_requests_select_authenticated
  on public.booking_requests for select to authenticated using (true);

create policy bookings_select_authenticated
  on public.bookings for select to authenticated using (true);

create policy fiscal_profiles_select_authenticated
  on public.fiscal_profiles for select to authenticated using (true);

create policy payments_select_authenticated
  on public.payments for select to authenticated using (true);

create policy xml_exports_select_authenticated
  on public.xml_exports for select to authenticated using (true);

create policy xml_export_items_select_authenticated
  on public.xml_export_items for select to authenticated using (true);

create policy audit_log_select_authenticated
  on public.audit_log for select to authenticated using (true);

create policy app_settings_select_authenticated
  on public.app_settings for select to authenticated using (true);

-- No INSERT/UPDATE/DELETE policies for anon or authenticated: writes go
-- through the service-role key (state machine in src/server/, Phase 4+).


-- ============================================================================
-- 6. Seed app_settings (single row, id = 1)
-- ----------------------------------------------------------------------------
-- Placeholder values matching docs/EMAILS.md and docs/STATES.md defaults.
-- Replace the placeholder accountant_email and review_url before go-live.
-- ============================================================================
insert into public.app_settings (
  id,
  accountant_email,
  xml_export_cron_enabled,
  completion_window_hours,
  payment_window_hours,
  review_url,
  review_email_enabled,
  terms_version,
  privacy_version,
  health_consent_version,
  image_use_consent_version,
  clauses_1341_1342_version
)
values (
  1,
  'commercialista@example.invalid',
  true,
  72,
  24,
  null,
  true,
  'terms@2026-05',
  'privacy@2026-05',
  'health-consent@2026-05',
  'image-use@2026-05',
  'clauses-1341-1342@2026-05'
)
on conflict (id) do nothing;
