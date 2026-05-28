import "server-only";

/**
 * Helpers for formatting Italian dates and currency in transactional emails.
 *
 * Always renders in `Europe/Rome` + `it-IT` locale to match the venue's
 * timezone. Inputs are accepted as ISO strings (the shape coming out of
 * Supabase) or Date objects.
 */

const ROME_TZ = "Europe/Rome";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ROME_TZ,
});

const dateOnlyFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ROME_TZ,
});

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function formatEventDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return dateTimeFormatter.format(date);
}

export function formatEventDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return dateOnlyFormatter.format(date);
}

export function formatCurrencyEUR(amountCents: number): string {
  return currencyFormatter.format(amountCents / 100);
}

export function buildCompletionUrl(baseUrl: string, token: string): string {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  return `${trimmed}/complete/${token}`;
}

/**
 * Build the payment-retry landing URL for a booking. The page at this URL
 * is the entry point for users who closed the Stripe Checkout tab (and
 * therefore lost the cancel page URL with `session_id`). It calls
 * `recreateCheckoutSession` under the hood and redirects to a fresh
 * Stripe Checkout — no completion form to re-fill.
 *
 * The booking id (UUID v4, ~122 bits of entropy) acts as the access
 * credential here: `recreateCheckoutSession` refuses anything that is
 * not in `awaiting_payment`, so even a leaked URL cannot be used to
 * initiate payments on bookings that have already been settled, expired,
 * voided, or cancelled.
 */
export function buildPaymentRetryUrl(baseUrl: string, bookingId: string): string {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  return `${trimmed}/pay/${bookingId}`;
}
