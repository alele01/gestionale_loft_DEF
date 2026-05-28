import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import {
  sendE2RequestAccepted,
  sendE5AcceptedFromWaitlist,
} from "@/server/email";
import { expireCheckoutSession } from "@/server/stripe";
import type { TablesUpdate } from "@/server/supabase";

import { assertCapacityAvailable } from "../capacity";
import { createActionContext } from "../context";
import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "../errors";
import { issueCompletionToken } from "../token";
import type { Actor, BookingRow } from "../types";

export type EditBookingPrePaymentInput = {
  bookingId: string;
  actor: Actor;
  patch: {
    people?: number;
    specialOccasion?: string | null;
    dietaryNotes?: string | null;
  };
};

export type EditBookingPrePaymentResult = {
  booking: BookingRow;
  /** Set when the change rotated the completion token. */
  completionTokenPlaintext: string | null;
};

/**
 * Edit a booking that is awaiting_completion or awaiting_payment.
 *
 * Rules:
 *   - Editing `people` recomputes the amount and rotates the completion
 *     token (the old link must invalidate).
 *   - Forbidden once status='paid' (also enforced by DB trigger).
 *   - revision +1 on every persisted change.
 */
export async function editBookingPrePayment(
  input: EditBookingPrePaymentInput
): Promise<EditBookingPrePaymentResult> {
  if (input.actor.type !== "admin") {
    throw new InvalidTransitionError(
      "pre_payment",
      "pre_payment",
      "actor must be admin"
    );
  }
  if (input.patch.people !== undefined && input.patch.people <= 0) {
    throw new ValidationError("Numero ospiti non valido");
  }

  const ctx = await createActionContext();

  const bookingRes = await ctx.client
    .from("bookings")
    .select("*, events(id, title, price_cents, starts_at)")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (bookingRes.error) throw bookingRes.error;
  if (!bookingRes.data) throw new NotFoundError("Prenotazione");

  const booking = bookingRes.data;
  if (
    booking.status !== "awaiting_completion" &&
    booking.status !== "awaiting_payment"
  ) {
    throw new InvalidTransitionError(
      booking.status,
      booking.status,
      "modificabile solo prima del pagamento"
    );
  }

  const event = booking.events;
  if (!event) throw new NotFoundError("Evento");

  const peopleChanged =
    input.patch.people !== undefined && input.patch.people !== booking.people;

  const newPeople = input.patch.people ?? booking.people;
  const newAmount = newPeople * event.price_cents;

  if (peopleChanged) {
    const delta = newPeople - booking.people;
    if (delta > 0) {
      await assertCapacityAvailable(ctx, booking.event_id, delta);
    }
  }

  const update: TablesUpdate<"bookings"> = {
    revision: booking.revision + 1,
  };
  const before: Record<string, unknown> = {
    revision: booking.revision,
  };

  if (peopleChanged) {
    update.people = newPeople;
    update.amount_cents = newAmount;
    before.people = booking.people;
    before.amount_cents = booking.amount_cents;
  }
  if (
    input.patch.specialOccasion !== undefined &&
    (input.patch.specialOccasion ?? null) !== booking.special_occasion
  ) {
    update.special_occasion = input.patch.specialOccasion ?? null;
    before.special_occasion = booking.special_occasion;
  }
  if (
    input.patch.dietaryNotes !== undefined &&
    (input.patch.dietaryNotes ?? null) !== booking.dietary_notes
  ) {
    update.dietary_notes = input.patch.dietaryNotes ?? null;
    before.dietary_notes = booking.dietary_notes;
  }

  if (Object.keys(update).length === 1) {
    // Only `revision` was touched → nothing meaningful changed.
    return { booking, completionTokenPlaintext: null };
  }

  let issuedTokenPlaintext: string | null = null;
  // Capture the soon-to-be-stale Stripe session id BEFORE the UPDATE
  // overwrites it. We expire it on Stripe AFTER the UPDATE succeeds so a
  // DB rollback (e.g. validation failure further down) does not leave a
  // dead session on Stripe without a matching booking state.
  let staleStripeSessionId: string | null = null;
  if (peopleChanged) {
    const token = issueCompletionToken();
    issuedTokenPlaintext = token.plaintext;
    update.completion_token_hash = token.storable;
    update.completion_token_last4 = token.last4;
    update.completion_token_issued_at = ctx.now.toISOString();
    update.completion_token_used_at = null;
    // If we were already awaiting_payment, fall back to awaiting_completion
    // because the link/amount changed and the previous Stripe session is
    // now obsolete. The webhook revision check is the AUTHORITATIVE guard
    // (docs/SECURITY.md §5.5); calling `sessions.expire` is best-effort UX
    // so the user does not land on a still-payable but stale checkout.
    if (booking.status === "awaiting_payment") {
      update.status = "awaiting_completion";
      update.stripe_session_id = null;
      if (booking.stripe_session_id) {
        staleStripeSessionId = booking.stripe_session_id;
      }
    }
  }

  const result = await ctx.client
    .from("bookings")
    .update(update)
    .eq("id", booking.id)
    .select("*")
    .single();
  if (result.error || !result.data) {
    throw result.error ?? new Error("Update booking failed");
  }

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: booking.id,
    action: AUDIT_ACTIONS.bookingEditedPrePayment,
    actorType: AUDIT_ACTORS.admin,
    actorId: input.actor.adminId,
    fromState: booking.status,
    toState: result.data.status,
    metadata: { before, after: update, token_rotated: peopleChanged },
  });

  // Best-effort expire on Stripe AFTER the booking UPDATE succeeded.
  // Audit-log the attempt with its outcome; never fail the action.
  if (staleStripeSessionId) {
    const expireResult = await expireCheckoutSession(staleStripeSessionId);
    await appendAuditLogWithClient(ctx.client, {
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.stripeSessionExpired,
      actorType: AUDIT_ACTORS.admin,
      actorId: input.actor.adminId,
      metadata: {
        stripe_session_id: staleStripeSessionId,
        reason: "edit_pre_payment_people_changed",
        ok: expireResult.ok,
        ...(expireResult.error ? { error: expireResult.error } : {}),
      },
    });
  }

  if (peopleChanged) {
    await appendAuditLogWithClient(ctx.client, {
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.bookingTokenRotated,
      actorType: AUDIT_ACTORS.admin,
      actorId: input.actor.adminId,
      metadata: { reason: "people_changed", new_amount_cents: newAmount },
    });

    if (issuedTokenPlaintext) {
      await appendAuditLogWithClient(ctx.client, {
        entityType: AUDIT_ENTITIES.booking,
        entityId: booking.id,
        action: AUDIT_ACTIONS.bookingCompletionLinkIssued,
        actorType: AUDIT_ACTORS.admin,
        actorId: input.actor.adminId,
        metadata: {
          completion_link_token: issuedTokenPlaintext,
          revision: result.data.revision,
          token_rotated: true,
          origin: booking.origin,
        },
      });
    }

    const requestRes = await ctx.client
      .from("booking_requests")
      .select("requester_email, requester_first_name")
      .eq("id", booking.request_id)
      .maybeSingle();

    if (
      requestRes.data?.requester_email &&
      requestRes.data?.requester_first_name &&
      issuedTokenPlaintext
    ) {
      const commonPayload = {
        bookingId: booking.id,
        revision: result.data.revision,
        mode: "amendment" as const,
        requesterFirstName: requestRes.data.requester_first_name,
        requesterEmail: requestRes.data.requester_email,
        eventTitle: event.title,
        eventStartsAt: event.starts_at,
        people: newPeople,
        amountCents: newAmount,
        completionTokenPlaintext: issuedTokenPlaintext,
      };
      if (booking.origin === "waitlist") {
        await sendE5AcceptedFromWaitlist(commonPayload);
      } else {
        await sendE2RequestAccepted(commonPayload);
      }
    }
  }

  return { booking: result.data, completionTokenPlaintext: issuedTokenPlaintext };
}
