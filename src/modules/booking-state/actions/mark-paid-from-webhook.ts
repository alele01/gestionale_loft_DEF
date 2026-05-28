import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";

import { createActionContext } from "../context";
import type { BookingRow } from "../types";

export type MarkPaidFromWebhookInput = {
  bookingId: string;
  stripePaymentIntentId: string;
  amountPaidCents: number;
  paidAt: Date;
  stripeSessionId: string;
  stripeEventId: string;
};

export type MarkPaidFromWebhookResult =
  | { status: "paid"; booking: BookingRow; alreadyPaid: false }
  | { status: "paid"; booking: BookingRow; alreadyPaid: true }
  | { status: "ignored"; reason: string };

/**
 * Idempotent transition `awaiting_payment → paid`. Invoked EXCLUSIVELY by
 * the Stripe webhook handler in `app/api/stripe/webhook/route.ts`, which
 * must have already:
 *   1. Verified the Stripe signature.
 *   2. Persisted a `payments` row keyed by the UNIQUE `stripe_event_id`
 *      (replay defence).
 *   3. Confirmed `metadata.booking_revision === booking.revision`.
 *
 * Hard rules (docs/STATES.md §4, docs/SECURITY.md §5):
 *   - Only `awaiting_payment` rows transition. `awaiting_completion`
 *     bookings cannot be paid (no session is expected); we return
 *     `{ status: 'ignored' }` for those.
 *   - `paid` bookings are no-ops (returned as `alreadyPaid: true`).
 *   - `cancelled_after_payment_at IS NULL` is enforced — a paid booking
 *     already operationally cancelled cannot be re-paid (rare race when
 *     two sessions overlap; the second is ignored).
 *   - We never touch `revision` here. `paid` is terminal in V1.
 */
export async function markPaidFromWebhook(
  input: MarkPaidFromWebhookInput
): Promise<MarkPaidFromWebhookResult> {
  const ctx = await createActionContext();

  const bookingRes = await ctx.client
    .from("bookings")
    .select("*")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (bookingRes.error) throw bookingRes.error;
  if (!bookingRes.data) {
    return { status: "ignored", reason: "booking_not_found" };
  }

  const booking = bookingRes.data;

  if (booking.status === "paid") {
    return { status: "paid", booking, alreadyPaid: true };
  }
  if (booking.status !== "awaiting_payment") {
    return {
      status: "ignored",
      reason: `unexpected_status:${booking.status}`,
    };
  }
  if (booking.cancelled_after_payment_at) {
    return { status: "ignored", reason: "already_operationally_cancelled" };
  }

  const update = await ctx.client
    .from("bookings")
    .update({
      status: "paid",
      stripe_payment_intent_id: input.stripePaymentIntentId,
      amount_paid_cents: input.amountPaidCents,
      paid_at: input.paidAt.toISOString(),
      // Persist the session id we observed in case the booking had a
      // recreated session by the time the webhook landed.
      stripe_session_id: input.stripeSessionId,
    })
    .eq("id", booking.id)
    // Defensive optimistic-concurrency guard: only update if still in
    // `awaiting_payment`. Catches the case where two webhook deliveries
    // race past the unique constraint.
    .eq("status", "awaiting_payment")
    .select("*")
    .single();
  if (update.error || !update.data) {
    // Race: another webhook just marked it paid. Re-read and treat as
    // already-paid.
    const reread = await ctx.client
      .from("bookings")
      .select("*")
      .eq("id", booking.id)
      .maybeSingle();
    if (reread.data?.status === "paid") {
      return { status: "paid", booking: reread.data, alreadyPaid: true };
    }
    throw update.error ?? new Error("Failed to mark booking paid");
  }

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: booking.id,
    action: AUDIT_ACTIONS.bookingPaid,
    actorType: AUDIT_ACTORS.webhook,
    fromState: "awaiting_payment",
    toState: "paid",
    metadata: {
      stripe_event_id: input.stripeEventId,
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_session_id: input.stripeSessionId,
      amount_paid_cents: input.amountPaidCents,
      amount_cents: booking.amount_cents,
      paid_at: input.paidAt.toISOString(),
    },
  });

  return { status: "paid", booking: update.data, alreadyPaid: false };
}
