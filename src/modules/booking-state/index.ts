import "server-only";

/**
 * Public surface of the booking state machine. EVERY booking-related
 * mutation goes through one of these actions, so we have a single grep-
 * able place to enumerate transitions, side-effects, and audit entries.
 *
 * See docs/STATES.md for the canonical state diagram.
 */

// Helpers
export * from "./types";
export * from "./errors";
export { createActionContext } from "./context";

// Request-side actions
export { submitBookingRequest } from "./actions/submit-request";
export { editPendingRequest } from "./actions/edit-pending-request";
export { acceptRequest } from "./actions/accept-request";
export { rejectRequest } from "./actions/reject-request";
export { waitlistRequest } from "./actions/waitlist-request";
export { acceptFromWaitlist } from "./actions/accept-from-waitlist";

// Booking-side actions
export { editBookingPrePayment } from "./actions/edit-booking-pre-payment";
export { completeBooking } from "./actions/complete-booking";
export { deletePrenotazione } from "./actions/delete-prenotazione";
export { voidBooking } from "./actions/void-booking";
export { markOperationallyCancelled } from "./actions/mark-operationally-cancelled";

// Stripe-driven actions
export { markPaidFromWebhook } from "./actions/mark-paid-from-webhook";
export type {
  MarkPaidFromWebhookInput,
  MarkPaidFromWebhookResult,
} from "./actions/mark-paid-from-webhook";
export { recreateCheckoutSession } from "./actions/recreate-checkout-session";
export type {
  RecreateCheckoutSessionInput,
  RecreateCheckoutSessionResult,
} from "./actions/recreate-checkout-session";
