/**
 * String constants used as `action` in audit_log rows. Keeping them in one
 * file lets us grep for every transition and avoids typos.
 *
 * The vocabulary mirrors docs/STATES.md (booking lifecycle) plus the email
 * IDs from docs/EMAILS.md so the audit trail and the email inventory line
 * up trivially.
 */

export const AUDIT_ENTITIES = {
  event: "event",
  bookingRequest: "booking_request",
  booking: "booking",
  xmlExport: "xml_export",
} as const;

export const AUDIT_ACTORS = {
  admin: "admin",
  representative: "representative",
  system: "system",
  webhook: "webhook",
  cron: "cron",
} as const;

export const AUDIT_ACTIONS = {
  // Events
  eventCreated: "event.created",
  eventUpdated: "event.updated",
  eventPublished: "event.published",
  eventArchived: "event.archived",

  // Booking requests
  requestSubmitted: "request.submitted",
  requestEditedPending: "request.edited_pending",
  requestAccepted: "request.accepted",
  requestRejected: "request.rejected",
  requestWaitlisted: "request.waitlisted",
  requestPromotedFromWaitlist: "request.promoted_from_waitlist",
  requestExpired: "request.expired",

  // Bookings
  bookingCreated: "booking.created",
  bookingEditedPrePayment: "booking.edited_pre_payment",
  bookingCompletionStarted: "booking.completion_started",
  bookingCompleted: "booking.completed",
  bookingPaid: "booking.paid",
  bookingExpiredCompletion: "booking.expired_completion",
  bookingExpiredPayment: "booking.expired_payment",
  bookingVoided: "booking.voided",
  bookingDeletedPrePayment: "booking.deleted_pre_payment",
  bookingCancelledAfterPayment: "booking.cancelled_after_payment",
  bookingTokenRotated: "booking.token_rotated",
  /**
   * Plaintext completion token recorded for admin convenience. Audit_log
   * is admin-only via RLS; the link does not expire by product decision,
   * so admins can copy it from the prenotazione detail page.
   */
  bookingCompletionLinkIssued: "booking.completion_link_issued",

  // Email side-effects (real Resend integration since Phase 4)
  emailE1: "side_effect.email.E1",
  emailE2: "side_effect.email.E2",
  emailE3: "side_effect.email.E3",
  emailE4: "side_effect.email.E4",
  emailE5: "side_effect.email.E5",
  emailE6: "side_effect.email.E6",
  emailE7: "side_effect.email.E7",
  emailE8: "side_effect.email.E8",
  emailE9: "side_effect.email.E9",
  emailE10: "side_effect.email.E10",

  // Stripe side-effects (real Checkout integration since Phase 5)
  stripeCheckoutCreated: "side_effect.stripe.checkout_created",
  stripeSessionExpired: "side_effect.stripe.session_expired",
  stripeSessionRecreated: "side_effect.stripe.session_recreated",
  stripePaymentFailed: "side_effect.stripe.payment_failed",
  stripeWebhookReceived: "side_effect.stripe.webhook_received",
  stripeWebhookRevisionMismatch: "side_effect.stripe.revision_mismatch",
  stripeWebhookIgnored: "side_effect.stripe.webhook_ignored",
  /**
   * Recorded when the webhook handler decides NOT to send the E7
   * payment-retry mail. Possible reasons:
   *   - `booking_already_paid` (race: webhook arrived after success)
   *   - `booking_not_awaiting_payment` (admin cancelled / deleted)
   *   - `cancelled_after_payment` (defensive; should not happen)
   *   - `missing_recipient_data`
   */
  paymentRetryEmailSkipped: "side_effect.payment_retry_email.skipped",
  /**
   * @deprecated Phase 4 placeholder. Kept for backward-compatibility with
   * rows already written in `audit_log` before Phase 5 wired real Stripe;
   * no new code writes this action.
   */
  stripeSkipped: "side_effect.stripe.skipped",

  // Other side-effect placeholders (real wiring in later phases)
  xmlSkipped: "side_effect.xml.skipped",

  // XML / FatturaPA export module (Phase 7)
  xmlExportStarted: "xml_export.generate_started",
  xmlExportGenerated: "xml_export.generated",
  xmlExportFailed: "xml_export.failed",
  xmlExportEmailFailed: "xml_export.email_failed",
  xmlExportResent: "xml_export.resent",
} as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
export type AuditActor = (typeof AUDIT_ACTORS)[keyof typeof AUDIT_ACTORS];
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
