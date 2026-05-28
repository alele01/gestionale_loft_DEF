-- Fix bookings_consents_rollup_chk: health_consent_accepted_at is legitimately
-- NULL when the user does not declare any health data (allergies/intolerances).
-- Per GDPR we collect the health-data consent only when health data is actually
-- provided (see src/server/completion/actions.ts and the inline comment on
-- CompletionConsentsInput.healthConsentAcceptedAt in
-- src/modules/booking-state/actions/complete-booking.ts).
--
-- The previous version of this constraint required health_consent_accepted_at
-- to be NOT NULL whenever the consents jsonb was populated, which made every
-- "no allergies" submission fail with 23514 and left the booking stuck in
-- awaiting_completion (Stripe Checkout session was created but the booking
-- update was rejected).

alter table public.bookings
  drop constraint if exists bookings_consents_rollup_chk;

alter table public.bookings
  add constraint bookings_consents_rollup_chk
    check (
      consents is null
      or (
        legal_accepted_at is not null
        and privacy_accepted_at is not null
        and image_use_choice is not null
      )
    );

comment on constraint bookings_consents_rollup_chk on public.bookings is
  'When the consents jsonb is populated, the mandatory scalar rollups (legal_accepted_at, privacy_accepted_at, image_use_choice) must be set. health_consent_accepted_at is intentionally NOT required: per GDPR we only collect health-data consent when the user actually declares health data (allergies/intolerances), so it stays NULL otherwise.';
