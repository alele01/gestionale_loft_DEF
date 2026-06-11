import "server-only";

import type Stripe from "stripe";

import { serverEnv } from "@/server/env";

import { getStripeClient } from "./client";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  RetrievedCheckoutSession,
} from "./types";

/**
 * Stripe Checkout Session must expire between 30 minutes and 24 hours
 * from creation time. We cap our `payment_deadline_at` to that window;
 * `recreate-checkout-session.ts` can issue a fresh session inside the
 * same `payment_deadline_at` as long as the booking is still in
 * `awaiting_payment`.
 *
 * The minimum carries a 5-minute buffer above Stripe's hard 30-minute
 * floor: `expires_at` is computed on OUR clock before the API call, so
 * an exact `now + 30min` can arrive at Stripe slightly under the
 * minimum (network latency / clock skew) and the session creation gets
 * rejected — observed in production when `payment_deadline_at` is
 * already in the past and the value clamps to the bare minimum.
 */
const MIN_EXPIRY_OFFSET_SECONDS = 35 * 60;
const MAX_EXPIRY_OFFSET_SECONDS = 24 * 60 * 60;

function computeExpiresAt(paymentDeadlineAtIso: string, nowMs: number): number {
  const nowSec = Math.floor(nowMs / 1000);
  const minExpiry = nowSec + MIN_EXPIRY_OFFSET_SECONDS;
  const maxExpiry = nowSec + MAX_EXPIRY_OFFSET_SECONDS;
  const desired = Math.floor(new Date(paymentDeadlineAtIso).getTime() / 1000);
  if (!Number.isFinite(desired) || desired <= 0) return maxExpiry;
  return Math.max(minExpiry, Math.min(maxExpiry, desired));
}

/**
 * Stripe idempotency keys live 24h and a reuse with different params
 * (expires_at always differs) returns `idempotency_error` instead of a
 * session. Base key stays stable for the first creation (double-submit
 * safety on completeBooking); re-creations append a suffix tied to the
 * session being replaced. Stripe caps the key at 255 chars; base + the
 * suffixes we pass (a cs_… id) stay well under that.
 */
function buildIdempotencyKey(
  bookingId: string,
  revision: number,
  suffix?: string
): string {
  const base = `checkout:${bookingId}:rev${revision}`;
  return suffix ? `${base}:${suffix}` : base;
}

function buildReturnUrls(baseUrl: string): {
  successUrl: string;
  cancelUrl: string;
} {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  return {
    successUrl: `${trimmed}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${trimmed}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
  };
}

/**
 * Build the metadata dict that travels with the Checkout session AND its
 * underlying PaymentIntent. The webhook handler reads this on
 * `checkout.session.completed` to enforce the revision check from
 * docs/SECURITY.md §5.5.
 */
function buildMetadata(booking: {
  id: string;
  revision: number;
  amountCents: number;
}): Stripe.MetadataParam {
  return {
    booking_id: booking.id,
    booking_revision: String(booking.revision),
    amount_cents: String(booking.amountCents),
  };
}

/**
 * Create a Stripe Checkout Session for the given booking. Returns the
 * session id + hosted URL the representative will be redirected to.
 *
 * Hard rules enforced here (binding, see docs/SECURITY.md §5–§6):
 *   - `client_reference_id = booking.id` for primary lookup.
 *   - `metadata.booking_id` / `metadata.booking_revision` mirrored on the
 *     PaymentIntent for the webhook revision check.
 *   - `unit_amount = event.pricePerPersonCents` and `quantity = booking.people`
 *     so that Stripe's authoritative amount equals our server-computed total.
 *   - Currency hard-coded to EUR (matches `bookings_currency_eur_chk`).
 *   - `Idempotency-Key` derived from `booking.id` + `revision` so a
 *     double-submit on completeBooking returns the same session.
 *
 * `payment_method_types` is explicit and locked to the methods we want
 * to offer in production: card (which also enables Apple Pay / Google
 * Pay automatically when the device supports them), PayPal and Satispay.
 * Any method that is in the array MUST also be enabled in the Stripe
 * Dashboard for the account (Settings → Payment methods); the API call
 * fails fast otherwise, which is the desired contract.
 *
 * `payment_intent_data.receipt_email` enables Stripe's automatic receipt
 * in addition to our own E6.
 */
const PAYMENT_METHOD_TYPES = ["card", "paypal", "satispay"] as const;
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
  now: Date = new Date()
): Promise<CreateCheckoutSessionResult> {
  const stripe = getStripeClient();
  const { successUrl, cancelUrl } = buildReturnUrls(serverEnv.APP_BASE_URL);
  const expiresAt = computeExpiresAt(input.booking.paymentDeadlineAt, now.getTime());
  const metadata = buildMetadata({
    id: input.booking.id,
    revision: input.booking.revision,
    amountCents: input.booking.amountCents,
  });

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      locale: "it",
      currency: "eur",
      payment_method_types: [...PAYMENT_METHOD_TYPES],
      client_reference_id: input.booking.id,
      customer_email: input.requester.email,
      expires_at: expiresAt,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      line_items: [
        {
          quantity: input.booking.people,
          price_data: {
            currency: "eur",
            unit_amount: input.event.pricePerPersonCents,
            product_data: {
              name: input.event.title,
              description: `Prenotazione per ${input.booking.people} ${
                input.booking.people === 1 ? "persona" : "persone"
              }`,
              metadata: {
                event_id: input.event.id,
              },
            },
          },
        },
      ],
      payment_intent_data: {
        receipt_email: input.requester.email,
        description: `Cooker Loft — ${input.event.title}`,
        metadata,
        statement_descriptor_suffix: "COOKER LOFT",
      },
    },
    {
      idempotencyKey: buildIdempotencyKey(
        input.booking.id,
        input.booking.revision,
        input.idempotencyKeySuffix
      ),
    }
  );

  if (!session.url) {
    throw new Error(
      `Stripe returned a session without a hosted URL: ${session.id}`
    );
  }

  return {
    sessionId: session.id,
    sessionUrl: session.url,
    expiresAt,
  };
}

/**
 * Expire a Stripe Checkout Session. Best-effort: failures are swallowed
 * by the caller because the webhook handler is the authoritative gate
 * (it rejects stale sessions via `metadata.booking_revision` mismatch).
 * Callers should pass the *previous* session id before nulling
 * `bookings.stripe_session_id`.
 */
export async function expireCheckoutSession(
  sessionId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!sessionId) return { ok: true };
  if (sessionId.startsWith("placeholder_")) {
    // Legacy placeholder ids (Phase 4) never existed on Stripe.
    return { ok: true };
  }
  try {
    const stripe = getStripeClient();
    await stripe.checkout.sessions.expire(sessionId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Retrieve a Checkout Session by id. Used by /payment/success and
 * /payment/cancel to validate the inbound `session_id` query param
 * and to know whether to re-create the session (cancel path).
 */
export async function retrieveCheckoutSession(
  sessionId: string
): Promise<RetrievedCheckoutSession> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return { raw: session, isUsable: isSessionUsable(session) };
}

/**
 * A Checkout Session is "usable" (can still be paid by the customer) when:
 *   - status === 'open'  (Stripe enum: 'open' | 'complete' | 'expired')
 *   - a hosted URL is present (Stripe drops the URL after expire/complete)
 *   - we are not past `expires_at` (defensive belt-and-suspenders)
 */
export function isSessionUsable(session: Stripe.Checkout.Session): boolean {
  if (session.status !== "open") return false;
  if (!session.url) return false;
  if (session.expires_at) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (session.expires_at <= nowSec) return false;
  }
  return true;
}
