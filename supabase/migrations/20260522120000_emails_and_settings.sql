-- ============================================================================
-- Cooker Loft V1 — Resend integration: app_settings toggles + email_log
-- ----------------------------------------------------------------------------
-- Adds the two optional-email toggles surfaced in the admin Impostazioni and
-- introduces the email_log table used by src/server/email/* for idempotency
-- and observability.
--
-- See docs/EMAILS.md §2 for the full inventory.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. app_settings — new optional-email toggles (default OFF, see EMAILS.md)
-- ----------------------------------------------------------------------------
alter table public.app_settings
  add column if not exists requester_receipt_email_enabled boolean not null default false;

alter table public.app_settings
  add column if not exists admin_new_request_email_enabled boolean not null default false;

comment on column public.app_settings.requester_receipt_email_enabled is
  'When true, sends E1 (request received) to the requester on new booking_requests.';

comment on column public.app_settings.admin_new_request_email_enabled is
  'When true, sends E8 (admin internal notice) to every admin_users row on new booking_requests.';


-- ----------------------------------------------------------------------------
-- 2. email_log — observability + idempotency for Resend sends
-- ----------------------------------------------------------------------------
-- One row per send attempt (sent OR failed). The unique idempotency_key
-- guarantees the state machine cannot trigger the same email twice for the
-- same logical event (e.g. accepting the same booking twice will hit the
-- unique constraint on the second attempt and we return the original
-- message id).
--
-- Manual admin "re-invia" actions use a timestamped idempotency key so they
-- always produce a new row (audit trail).
-- ----------------------------------------------------------------------------
create table public.email_log (
  id                  uuid primary key default gen_random_uuid(),
  idempotency_key     text not null unique,
  email_id            text not null,
  entity_type         text not null check (entity_type in ('booking_request', 'booking')),
  entity_id           uuid not null,
  recipient_email     text not null,
  subject             text,
  resend_message_id   text,
  status              text not null check (status in ('sent', 'failed')),
  error_message       text,
  created_at          timestamptz not null default now()
);

create index email_log_entity_idx
  on public.email_log (entity_type, entity_id, created_at desc);

create index email_log_email_id_idx
  on public.email_log (email_id, created_at desc);

comment on table public.email_log is
  'Per-send audit trail for transactional emails. Idempotency key prevents duplicate sends within a single logical event; manual admin resends use a timestamped key.';


-- ----------------------------------------------------------------------------
-- 3. RLS — service-role only writes; authenticated may SELECT (admin audit)
-- ----------------------------------------------------------------------------
alter table public.email_log enable row level security;

create policy email_log_select_authenticated
  on public.email_log for select to authenticated using (true);

-- No INSERT/UPDATE/DELETE policies: writes go exclusively through the
-- service-role key from src/server/email/send.ts.
