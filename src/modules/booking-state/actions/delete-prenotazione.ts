import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import { sendE12BookingVoided } from "@/server/email";

import { createActionContext } from "../context";
import { InvalidTransitionError, NotFoundError } from "../errors";
import type { Actor } from "../types";

export type DeletePrenotazioneInput = {
  requestId: string;
  actor: Actor;
  reason: string;
};

export type DeletePrenotazioneResult = {
  requestId: string;
  bookingId: string | null;
};

/**
 * Admin deletes a prenotazione that has NOT been paid yet. Two cases:
 *   1. Only the booking_request exists (still pending/waitlisted/rejected):
 *      mark the request as 'cancelled' and audit.
 *   2. A booking exists in awaiting_completion / awaiting_payment: void
 *      the booking AND mark the request as 'cancelled'.
 *
 * Throws when the booking is already paid (use markOperationallyCancelled).
 */
export async function deletePrenotazione(
  input: DeletePrenotazioneInput
): Promise<DeletePrenotazioneResult> {
  if (input.actor.type !== "admin") {
    throw new InvalidTransitionError("any", "deleted", "actor must be admin");
  }
  if (!input.reason.trim()) {
    throw new InvalidTransitionError("any", "deleted", "motivazione richiesta");
  }

  const ctx = await createActionContext();

  const requestRes = await ctx.client
    .from("booking_requests")
    .select(
      `*, events(id, title, starts_at),
       bookings(id, status, revision, people)`
    )
    .eq("id", input.requestId)
    .maybeSingle();
  if (requestRes.error) throw requestRes.error;
  if (!requestRes.data) throw new NotFoundError("Richiesta");

  const request = requestRes.data;
  const booking = Array.isArray(request.bookings)
    ? request.bookings[0]
    : request.bookings;
  const previousBookingStatus = booking?.status ?? null;

  if (booking && booking.status === "paid") {
    throw new InvalidTransitionError(
      "paid",
      "deleted",
      "le prenotazioni pagate vanno cancellate con il flusso post-payment"
    );
  }

  if (booking) {
    const bookingUpdate = await ctx.client
      .from("bookings")
      .update({
        status: "void",
        voided_at: ctx.now.toISOString(),
        void_reason: input.reason.trim(),
        revision: booking.revision + 1,
      })
      .eq("id", booking.id)
      .select("id, status")
      .single();
    if (bookingUpdate.error || !bookingUpdate.data) {
      throw bookingUpdate.error ?? new Error("Update booking failed");
    }

    await appendAuditLogWithClient(ctx.client, {
      entityType: AUDIT_ENTITIES.booking,
      entityId: booking.id,
      action: AUDIT_ACTIONS.bookingVoided,
      actorType: AUDIT_ACTORS.admin,
      actorId: input.actor.adminId,
      fromState: booking.status,
      toState: "void",
      reason: input.reason.trim(),
    });
  }

  const reqUpdate = await ctx.client
    .from("booking_requests")
    .update({
      status: "cancelled",
      decided_at: ctx.now.toISOString(),
      decided_by: input.actor.adminId,
      decision_reason: input.reason.trim(),
    })
    .eq("id", request.id)
    .select("id, status")
    .single();
  if (reqUpdate.error || !reqUpdate.data) {
    throw reqUpdate.error ?? new Error("Update request failed");
  }

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.bookingRequest,
    entityId: request.id,
    action: AUDIT_ACTIONS.bookingDeletedPrePayment,
    actorType: AUDIT_ACTORS.admin,
    actorId: input.actor.adminId,
    fromState: request.status,
    toState: "cancelled",
    reason: input.reason.trim(),
    metadata: { booking_id: booking?.id ?? null },
  });

  if (
    booking &&
    request.events &&
    (previousBookingStatus === "awaiting_completion" ||
      previousBookingStatus === "awaiting_payment")
  ) {
    await sendE12BookingVoided({
      bookingId: booking.id,
      requesterFirstName: request.requester_first_name,
      requesterEmail: request.requester_email,
      eventTitle: request.events.title,
      eventStartsAt: request.events.starts_at,
      people: booking.people ?? request.people,
    });
  }

  return { requestId: request.id, bookingId: booking?.id ?? null };
}
