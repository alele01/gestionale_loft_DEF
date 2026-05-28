import type Stripe from "stripe";
import { NextResponse } from "next/server";

import { appendAuditLog } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import {
  sendE6PaymentConfirmation,
  sendE7PaymentRetry,
} from "@/server/email";
import { markPaidFromWebhook } from "@/modules/booking-state";
import { getServiceClient } from "@/server/supabase";
import { verifyStripeWebhook } from "@/server/stripe";

/**
 * POST /api/stripe/webhook — the ONLY code path that may transition a
 * booking to `paid` (docs/SECURITY.md §5, hard rule).
 *
 * Defence layers (in order):
 *   1. Stripe signature verification (HMAC + timestamp tolerance).
 *   2. Append-only insert into `payments` with UNIQUE `stripe_event_id`:
 *      retries of the same Stripe event id short-circuit to 200 OK.
 *   3. Revision check: `metadata.booking_revision` must match
 *      `bookings.revision` AT THE TIME OF PROCESSING. A stale session paid
 *      after a pre-payment edit is logged as `revision_mismatch` and
 *      ignored.
 *   4. Amount check: the Stripe-reported amount must equal
 *      `bookings.amount_cents`. Any deviation is treated as a security
 *      anomaly and the booking is NOT marked paid.
 *
 * We return `200 OK` after processing (even on revision/amount mismatch)
 * so Stripe stops redelivering; all anomalies are surfaced via `payments`
 * + `audit_log`. We return `4xx` only when the signature itself fails
 * verification (Stripe expects this to flag misconfiguration).
 *
 * Runtime: nodejs (required for raw body access).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  // 1. Read raw body for HMAC verification. NEVER parse JSON first.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    return NextResponse.json(
      {
        error: "raw_body_unreadable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }

  // 2. Verify signature.
  const signatureHeader = request.headers.get("stripe-signature");
  const verifyResult = verifyStripeWebhook(rawBody, signatureHeader);
  if (!verifyResult.ok) {
    // eslint-disable-next-line no-console
    console.warn("[stripe/webhook] signature verify failed", {
      reason: verifyResult.reason,
    });
    return NextResponse.json(
      { error: "invalid_signature", reason: verifyResult.reason },
      { status: 400 }
    );
  }

  const event = verifyResult.event;
  const client = getServiceClient();

  // 3. Extract booking id. If absent (e.g. non-checkout event types) we
  //    cannot insert into `payments` (FK booking_id NOT NULL), so we log
  //    an audit row and acknowledge with 200 OK.
  const bookingIdFromEvent = extractBookingId(event);
  if (!bookingIdFromEvent) {
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: "00000000-0000-0000-0000-000000000000",
      action: AUDIT_ACTIONS.stripeWebhookIgnored,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        reason: "no_booking_reference",
      },
    });
    return NextResponse.json({ ok: true, recorded: false });
  }

  // 4. Append to payments. The UNIQUE constraint on stripe_event_id is
  //    the replay anchor: any retry of the same event short-circuits.
  //    The booking_id FK also catches "booking deleted while paying".
  const insertRes = await client
    .from("payments")
    .insert({
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      booking_id: bookingIdFromEvent,
      status: "received",
      raw_event: event as never,
    })
    .select("id")
    .single();

  if (insertRes.error) {
    // Postgres unique violation = retry of an event we've already seen.
    if (insertRes.error.code === "23505") {
      return NextResponse.json({ ok: true, deduplicated: true });
    }
    // FK violation (booking_id no longer present) or other constraint:
    // acknowledge to Stripe but log loudly so admins can investigate.
    // eslint-disable-next-line no-console
    console.error("[stripe/webhook] payments insert failed", {
      eventId: event.id,
      type: event.type,
      bookingId: bookingIdFromEvent,
      error: insertRes.error,
    });
    return NextResponse.json({ ok: true, recorded: false });
  }

  const paymentRowId = insertRes.data.id;

  await appendAuditLog({
    entityType: AUDIT_ENTITIES.booking,
    entityId: bookingIdFromEvent,
    action: AUDIT_ACTIONS.stripeWebhookReceived,
    actorType: AUDIT_ACTORS.webhook,
    metadata: {
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      payments_row_id: paymentRowId,
    },
  });

  // 4. Dispatch by event type.
  let outcome: "processed" | "ignored" | "error" = "ignored";
  let errorMessage: string | null = null;

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        outcome = await handleCheckoutSessionCompleted(
          event,
          paymentRowId
        );
        break;
      case "payment_intent.succeeded":
        outcome = await handlePaymentIntentSucceeded(event, paymentRowId);
        break;
      case "checkout.session.expired":
        await handleCheckoutSessionExpired(event);
        outcome = "processed";
        break;
      case "checkout.session.async_payment_failed":
        // Fires when an async PMT (PayPal, Satispay) returns "failed"
        // after the buyer is redirected back. Same downstream behaviour
        // as payment_intent.payment_failed: audit + E7 retry.
        await handleCheckoutSessionAsyncFailed(event);
        outcome = "processed";
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event);
        outcome = "processed";
        break;
      default:
        outcome = "ignored";
        break;
    }
  } catch (err) {
    outcome = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[stripe/webhook] handler error", {
      eventId: event.id,
      type: event.type,
      error: errorMessage,
    });
  }

  await client
    .from("payments")
    .update({
      status: outcome,
      processed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", paymentRowId);

  // ALWAYS 200: Stripe must not retry on application-side problems. The
  // problem itself is recorded in payments + audit_log.
  return NextResponse.json({ ok: true, outcome });
}

/* ------------------------------------------------------------------ */
/* Event-specific handlers                                             */
/* ------------------------------------------------------------------ */

async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  paymentRowId: string
): Promise<"processed" | "ignored"> {
  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId =
    session.client_reference_id ??
    (typeof session.metadata?.booking_id === "string"
      ? session.metadata.booking_id
      : null);
  if (!bookingId) {
    await auditMismatch({
      paymentRowId,
      stripeEventId: event.id,
      reason: "missing_booking_id_in_session",
    });
    return "ignored";
  }
  // We only mark paid on a session whose payment actually went through.
  // Stripe's `checkout.session.completed` fires also for `no_payment_required`
  // and async card flows still in `unpaid` state.
  if (session.payment_status !== "paid") {
    await auditMismatch({
      paymentRowId,
      stripeEventId: event.id,
      bookingId,
      reason: `payment_status:${session.payment_status}`,
    });
    return "ignored";
  }

  const paymentIntentId = extractPaymentIntentId(session.payment_intent);
  if (!paymentIntentId) {
    await auditMismatch({
      paymentRowId,
      stripeEventId: event.id,
      bookingId,
      reason: "missing_payment_intent_id",
    });
    return "ignored";
  }
  const amountFromStripe = session.amount_total;
  if (typeof amountFromStripe !== "number") {
    await auditMismatch({
      paymentRowId,
      stripeEventId: event.id,
      bookingId,
      reason: "missing_amount_total",
    });
    return "ignored";
  }
  const expectedRevision = Number(session.metadata?.booking_revision ?? "0");

  return processPaidEvent({
    paymentRowId,
    stripeEventId: event.id,
    bookingId,
    expectedRevision,
    paymentIntentId,
    amountFromStripe,
    stripeSessionId: session.id,
  });
}

async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  paymentRowId: string
): Promise<"processed" | "ignored"> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const bookingId =
    typeof pi.metadata?.booking_id === "string"
      ? pi.metadata.booking_id
      : null;
  if (!bookingId) {
    await auditMismatch({
      paymentRowId,
      stripeEventId: event.id,
      reason: "missing_booking_id_in_payment_intent",
    });
    return "ignored";
  }
  const expectedRevision = Number(pi.metadata?.booking_revision ?? "0");
  // Pull the session id back from `latest_charge` is unreliable; use the
  // booking row to recover it at processing time.
  const client = getServiceClient();
  const bookingRes = await client
    .from("bookings")
    .select("stripe_session_id")
    .eq("id", bookingId)
    .maybeSingle();
  const stripeSessionId = bookingRes.data?.stripe_session_id ?? "";

  return processPaidEvent({
    paymentRowId,
    stripeEventId: event.id,
    bookingId,
    expectedRevision,
    paymentIntentId: pi.id,
    amountFromStripe: pi.amount_received ?? pi.amount,
    stripeSessionId,
  });
}

async function handleCheckoutSessionExpired(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId =
    session.client_reference_id ??
    (typeof session.metadata?.booking_id === "string"
      ? session.metadata.booking_id
      : null);
  if (!bookingId) return;
  await appendAuditLog({
    entityType: AUDIT_ENTITIES.booking,
    entityId: bookingId,
    action: AUDIT_ACTIONS.stripeSessionExpired,
    actorType: AUDIT_ACTORS.webhook,
    metadata: {
      stripe_event_id: event.id,
      stripe_session_id: session.id,
      reason: "stripe_session_expired_event",
    },
  });
  await sendRetryEmailIfApplicable({
    bookingId,
    stripeSessionId: session.id,
    reason: "session_expired",
    stripeEventId: event.id,
  });
}

/**
 * `checkout.session.async_payment_failed` arrives when an asynchronous
 * payment method (e.g. PayPal, Satispay) reports a definitive failure
 * after the customer returned from the redirect flow. The session
 * itself carries enough info (id, metadata) so we don't need to join
 * via the booking row.
 */
async function handleCheckoutSessionAsyncFailed(
  event: Stripe.Event
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId =
    session.client_reference_id ??
    (typeof session.metadata?.booking_id === "string"
      ? session.metadata.booking_id
      : null);
  if (!bookingId) return;

  // Stripe surfaces the failure reason on the underlying PaymentIntent;
  // we only have what's on the Session here, so we log the payment_status
  // (typically "unpaid"). The retry email itself is method-agnostic.
  await appendAuditLog({
    entityType: AUDIT_ENTITIES.booking,
    entityId: bookingId,
    action: AUDIT_ACTIONS.stripePaymentFailed,
    actorType: AUDIT_ACTORS.webhook,
    metadata: {
      stripe_event_id: event.id,
      stripe_session_id: session.id,
      payment_status: session.payment_status,
      source_event_type: event.type,
    },
  });

  await sendRetryEmailIfApplicable({
    bookingId,
    stripeSessionId: session.id,
    reason: "payment_failed",
    stripeEventId: event.id,
  });
}

async function handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
  const pi = event.data.object as Stripe.PaymentIntent;
  const bookingId =
    typeof pi.metadata?.booking_id === "string"
      ? pi.metadata.booking_id
      : null;
  if (!bookingId) return;

  // Recover the session id via the booking row. The payment_intent itself
  // does not carry it; Stripe's checkout.session is the join.
  const client = getServiceClient();
  const bookingRes = await client
    .from("bookings")
    .select("stripe_session_id")
    .eq("id", bookingId)
    .maybeSingle();
  const stripeSessionId = bookingRes.data?.stripe_session_id ?? "";

  const failureCode = pi.last_payment_error?.code ?? null;
  const failureType = pi.last_payment_error?.type ?? null;

  await appendAuditLog({
    entityType: AUDIT_ENTITIES.booking,
    entityId: bookingId,
    action: AUDIT_ACTIONS.stripePaymentFailed,
    actorType: AUDIT_ACTORS.webhook,
    metadata: {
      stripe_event_id: event.id,
      stripe_payment_intent_id: pi.id,
      stripe_session_id: stripeSessionId || null,
      // Stripe error codes are safe to log (no PII); a human-readable
      // message is intentionally NOT included in the email — see E7.
      failure_code: failureCode,
      failure_type: failureType,
    },
  });

  await sendRetryEmailIfApplicable({
    bookingId,
    stripeSessionId,
    reason: "payment_failed",
    stripeEventId: event.id,
  });
}

/**
 * Fail-soft helper: decide whether to send the E7 payment-retry email
 * for a booking and dispatch it. Never throws — any error path is
 * recorded into `audit_log` with a structured skip reason.
 *
 * Decision tree:
 *   - booking missing                 → skip (cannot recover)
 *   - status === 'paid'               → skip (race: webhook lost a duel
 *                                       with checkout.session.completed)
 *   - status !== 'awaiting_payment'   → skip (admin closed it; do not
 *                                       chase the user with a dead link)
 *   - cancelled_after_payment_at set  → skip (defensive)
 *   - missing requester/event data    → skip
 *   - otherwise                       → sendE7PaymentRetry (sender uses
 *                                       its own per-session idempotency
 *                                       key so multiple Stripe retries
 *                                       of the same event do not spam)
 */
async function sendRetryEmailIfApplicable(params: {
  bookingId: string;
  stripeSessionId: string;
  reason: "session_expired" | "payment_failed";
  stripeEventId: string;
}): Promise<void> {
  const client = getServiceClient();
  const bookingRes = await client
    .from("bookings")
    .select(
      `
      id, status, amount_cents, people, cancelled_after_payment_at,
      stripe_session_id,
      booking_requests:request_id ( requester_email, requester_first_name ),
      events:event_id ( title, starts_at )
    `
    )
    .eq("id", params.bookingId)
    .maybeSingle();

  if (bookingRes.error || !bookingRes.data) {
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: params.bookingId,
      action: AUDIT_ACTIONS.paymentRetryEmailSkipped,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: params.stripeEventId,
        reason: "booking_not_found",
      },
    });
    return;
  }
  const booking = bookingRes.data;

  if (booking.status === "paid") {
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.paymentRetryEmailSkipped,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: params.stripeEventId,
        reason: "booking_already_paid",
      },
    });
    return;
  }
  if (booking.status !== "awaiting_payment") {
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.paymentRetryEmailSkipped,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: params.stripeEventId,
        reason: "booking_not_awaiting_payment",
        booking_status: booking.status,
      },
    });
    return;
  }
  if (booking.cancelled_after_payment_at) {
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.paymentRetryEmailSkipped,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: params.stripeEventId,
        reason: "cancelled_after_payment",
      },
    });
    return;
  }

  const requester = booking.booking_requests;
  const eventRow = booking.events;
  if (
    !requester?.requester_email ||
    !requester?.requester_first_name ||
    !eventRow?.title ||
    !eventRow?.starts_at
  ) {
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.paymentRetryEmailSkipped,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: params.stripeEventId,
        reason: "missing_recipient_data",
      },
    });
    return;
  }

  // The sender key includes the session id so multiple declines on the
  // SAME session do not produce extra emails (Stripe Checkout already
  // lets the user retry inline). A brand new session id (after recreate
  // and a second failure) is treated as a new retry-needed signal.
  // Fall back to "unknown_session" if for some reason we lost the
  // stripe_session_id — better one extra email than none at all.
  const sessionKey =
    params.stripeSessionId || booking.stripe_session_id || "unknown_session";

  try {
    await sendE7PaymentRetry({
      bookingId: booking.id,
      stripeSessionId: sessionKey,
      reason: params.reason,
      requesterFirstName: requester.requester_first_name,
      requesterEmail: requester.requester_email,
      eventTitle: eventRow.title,
      eventStartsAt: eventRow.starts_at,
      people: booking.people,
      amountCents: booking.amount_cents,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[stripe/webhook] sendE7PaymentRetry failed", {
      bookingId: booking.id,
      stripe_event_id: params.stripeEventId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Shared paid-event processor                                         */
/* ------------------------------------------------------------------ */

async function processPaidEvent(params: {
  paymentRowId: string;
  stripeEventId: string;
  bookingId: string;
  expectedRevision: number;
  paymentIntentId: string;
  amountFromStripe: number;
  stripeSessionId: string;
}): Promise<"processed" | "ignored"> {
  const client = getServiceClient();

  // Load the booking and enforce revision + amount checks BEFORE
  // delegating to the state machine.
  const bookingRes = await client
    .from("bookings")
    .select(
      `
      id, status, revision, amount_cents, request_id,
      booking_requests:request_id ( requester_email, requester_first_name ),
      events:event_id ( title, starts_at ),
      fiscal_profiles!fiscal_profiles_booking_id_fkey ( legal_name, address_city )
    `
    )
    .eq("id", params.bookingId)
    .maybeSingle();
  if (bookingRes.error) throw bookingRes.error;
  if (!bookingRes.data) {
    await auditMismatch({
      paymentRowId: params.paymentRowId,
      stripeEventId: params.stripeEventId,
      bookingId: params.bookingId,
      reason: "booking_not_found",
    });
    return "ignored";
  }
  const booking = bookingRes.data;

  if (params.expectedRevision !== booking.revision) {
    await client
      .from("payments")
      .update({
        stripe_payment_intent_id: params.paymentIntentId,
        stripe_session_id: params.stripeSessionId,
        amount_cents: params.amountFromStripe,
        currency: "eur",
      })
      .eq("id", params.paymentRowId);
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.stripeWebhookRevisionMismatch,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: params.stripeEventId,
        stripe_session_id: params.stripeSessionId,
        expected_revision: params.expectedRevision,
        current_revision: booking.revision,
        amount_from_stripe: params.amountFromStripe,
      },
    });
    return "ignored";
  }

  if (params.amountFromStripe !== booking.amount_cents) {
    await client
      .from("payments")
      .update({
        stripe_payment_intent_id: params.paymentIntentId,
        stripe_session_id: params.stripeSessionId,
        amount_cents: params.amountFromStripe,
        currency: "eur",
      })
      .eq("id", params.paymentRowId);
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.stripeWebhookIgnored,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: params.stripeEventId,
        reason: "amount_mismatch",
        amount_from_stripe: params.amountFromStripe,
        amount_cents: booking.amount_cents,
      },
    });
    return "ignored";
  }

  // Mark paid. The state machine is itself idempotent.
  const markResult = await markPaidFromWebhook({
    bookingId: booking.id,
    stripePaymentIntentId: params.paymentIntentId,
    amountPaidCents: params.amountFromStripe,
    paidAt: new Date(),
    stripeSessionId: params.stripeSessionId,
    stripeEventId: params.stripeEventId,
  });

  // Update payments with the same authoritative reference.
  await client
    .from("payments")
    .update({
      stripe_payment_intent_id: params.paymentIntentId,
      stripe_session_id: params.stripeSessionId,
      amount_cents: params.amountFromStripe,
      currency: "eur",
    })
    .eq("id", params.paymentRowId);

  if (markResult.status !== "paid") {
    await appendAuditLog({
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.stripeWebhookIgnored,
      actorType: AUDIT_ACTORS.webhook,
      metadata: {
        stripe_event_id: params.stripeEventId,
        reason: markResult.reason,
      },
    });
    return "ignored";
  }

  // Send E6 — fail-soft. The state transition is already committed.
  const requester = booking.booking_requests;
  const event = booking.events;
  const fiscalRow = Array.isArray(booking.fiscal_profiles)
    ? booking.fiscal_profiles[0]
    : booking.fiscal_profiles;
  if (
    !markResult.alreadyPaid &&
    requester?.requester_email &&
    requester?.requester_first_name &&
    event?.title &&
    event?.starts_at &&
    fiscalRow?.legal_name &&
    fiscalRow?.address_city
  ) {
    await sendE6PaymentConfirmation({
      bookingId: booking.id,
      requesterFirstName: requester.requester_first_name,
      requesterEmail: requester.requester_email,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      people: markResult.booking.people,
      amountPaidCents: params.amountFromStripe,
      fiscalLegalName: fiscalRow.legal_name,
      fiscalCity: fiscalRow.address_city,
    });
  }

  return "processed";
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function extractBookingId(event: Stripe.Event): string | null {
  const obj = event.data.object as
    | Stripe.Checkout.Session
    | Stripe.PaymentIntent
    | { client_reference_id?: string | null; metadata?: Record<string, string> };
  const clientRef =
    "client_reference_id" in obj ? obj.client_reference_id : null;
  const metaId =
    typeof obj.metadata?.booking_id === "string"
      ? obj.metadata.booking_id
      : null;
  return clientRef ?? metaId ?? null;
}

function extractPaymentIntentId(
  pi: Stripe.Checkout.Session["payment_intent"]
): string | null {
  if (!pi) return null;
  if (typeof pi === "string") return pi;
  return pi.id ?? null;
}

async function auditMismatch(params: {
  paymentRowId: string;
  stripeEventId: string;
  bookingId?: string;
  reason: string;
}): Promise<void> {
  await appendAuditLog({
    entityType: AUDIT_ENTITIES.booking,
    entityId: params.bookingId ?? params.paymentRowId,
    action: AUDIT_ACTIONS.stripeWebhookIgnored,
    actorType: AUDIT_ACTORS.webhook,
    metadata: {
      stripe_event_id: params.stripeEventId,
      reason: params.reason,
    },
  });
}
