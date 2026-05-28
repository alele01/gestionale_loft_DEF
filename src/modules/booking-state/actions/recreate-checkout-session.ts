import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import {
  createCheckoutSession,
  expireCheckoutSession,
  isSessionUsable,
  retrieveCheckoutSession,
} from "@/server/stripe";

import { createActionContext } from "../context";
import { InvalidTransitionError, NotFoundError } from "../errors";
import type { Actor } from "../types";

export type RecreateCheckoutSessionInput = {
  bookingId: string;
  /**
   * - `representative` when the user clicks "Riprova pagamento" from
   *   /payment/cancel (self-service flow).
   * - `admin` when an admin uses the "Rigenera link Stripe" button.
   */
  actor: Actor;
};

export type RecreateCheckoutSessionResult = {
  /** `true` when the existing session was still usable and we returned its URL. */
  reused: boolean;
  checkoutUrl: string;
  stripeSessionId: string;
};

/**
 * Self-service / admin path to obtain a fresh Stripe Checkout URL for a
 * booking that is still in `awaiting_payment` but whose session has
 * expired or been cancelled by the user.
 *
 * IMPORTANT: this is NOT an edit. The booking's `revision` is NOT bumped;
 * the completion token is NOT rotated; the amount is NOT recomputed. The
 * new session is created with the SAME `metadata.booking_revision` so the
 * webhook revision check still resolves correctly.
 *
 * If the previous session is still usable on Stripe (open + URL + not
 * expired), we return its URL without creating a new one (no charge,
 * fully idempotent).
 */
export async function recreateCheckoutSession(
  input: RecreateCheckoutSessionInput
): Promise<RecreateCheckoutSessionResult> {
  const ctx = await createActionContext();

  const bookingRes = await ctx.client
    .from("bookings")
    .select("*, events(id, title, price_cents, starts_at)")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (bookingRes.error) throw bookingRes.error;
  if (!bookingRes.data) throw new NotFoundError("Prenotazione");

  const booking = bookingRes.data;
  if (booking.status !== "awaiting_payment") {
    throw new InvalidTransitionError(
      booking.status,
      "awaiting_payment",
      "il pagamento non è più disponibile per questa prenotazione"
    );
  }
  if (booking.cancelled_after_payment_at) {
    throw new InvalidTransitionError(
      booking.status,
      booking.status,
      "prenotazione cancellata"
    );
  }

  const event = booking.events;
  if (!event) throw new NotFoundError("Evento");
  if (!booking.payment_deadline_at) {
    throw new NotFoundError("Scadenza pagamento");
  }

  // 1. If we still have a session id and it's a real Stripe one, try to
  //    reuse it. Cheap remote check; only one round-trip if it's usable.
  if (
    booking.stripe_session_id &&
    !booking.stripe_session_id.startsWith("placeholder_")
  ) {
    try {
      const existing = await retrieveCheckoutSession(booking.stripe_session_id);
      if (existing.isUsable && existing.raw.url) {
        return {
          reused: true,
          checkoutUrl: existing.raw.url,
          stripeSessionId: booking.stripe_session_id,
        };
      }
    } catch {
      // Session id no longer recognized by Stripe; fall through to recreate.
    }
  }

  // 2. Expire the stale session (best-effort) before creating a new one.
  const staleId = booking.stripe_session_id;
  if (staleId && !staleId.startsWith("placeholder_")) {
    await expireCheckoutSession(staleId);
  }

  // 3. Load requester contact for customer_email.
  const requestRes = await ctx.client
    .from("booking_requests")
    .select("requester_email, requester_first_name, requester_last_name")
    .eq("id", booking.request_id)
    .maybeSingle();
  if (requestRes.error) throw requestRes.error;
  if (!requestRes.data?.requester_email) {
    throw new NotFoundError("Email del referente");
  }

  // 4. Create a NEW session with the SAME revision (no booking mutation).
  const session = await createCheckoutSession(
    {
      booking: {
        id: booking.id,
        revision: booking.revision,
        people: booking.people,
        amountCents: booking.amount_cents,
        paymentDeadlineAt: booking.payment_deadline_at,
      },
      event: {
        id: event.id ?? booking.event_id,
        title: event.title,
        pricePerPersonCents: event.price_cents,
      },
      requester: {
        email: requestRes.data.requester_email,
        fullName: `${requestRes.data.requester_first_name ?? ""} ${
          requestRes.data.requester_last_name ?? ""
        }`.trim(),
      },
    },
    ctx.now
  );

  // 5. Persist the new session id. Status stays `awaiting_payment`; we
  //    only swap the session pointer.
  const update = await ctx.client
    .from("bookings")
    .update({ stripe_session_id: session.sessionId })
    .eq("id", booking.id)
    .eq("status", "awaiting_payment")
    .select("id")
    .single();
  if (update.error) throw update.error;

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: booking.id,
    action: AUDIT_ACTIONS.stripeSessionRecreated,
    actorType:
      input.actor.type === "admin"
        ? AUDIT_ACTORS.admin
        : AUDIT_ACTORS.representative,
    actorId: input.actor.type === "admin" ? input.actor.adminId : null,
    metadata: {
      previous_session_id: staleId,
      new_session_id: session.sessionId,
      revision: booking.revision,
      expires_at_unix: session.expiresAt,
    },
  });

  return {
    reused: false,
    checkoutUrl: session.sessionUrl,
    stripeSessionId: session.sessionId,
  };
}
