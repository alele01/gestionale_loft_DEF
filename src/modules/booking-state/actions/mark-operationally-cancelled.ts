import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";

import { createActionContext } from "../context";
import { InvalidTransitionError, NotFoundError } from "../errors";
import type { Actor, BookingRow } from "../types";

export type MarkOperationallyCancelledInput = {
  bookingId: string;
  actor: Actor;
  reason: string;
  /** Whether the post-event review email should still be sent. */
  affectsReviewEmail?: boolean;
};

/**
 * Paid → "paid (operationally cancelled)". The booking stays in status
 * 'paid' for accounting/invoicing purposes; we just flip the operational
 * cancel marker columns (the DB trigger enforces these move together).
 *
 * No state transition in the technical sense: status stays 'paid'. The
 * UI surfaces it as the unified status `paid_cancelled`.
 */
export async function markOperationallyCancelled(
  input: MarkOperationallyCancelledInput
): Promise<{ booking: BookingRow }> {
  if (input.actor.type !== "admin") {
    throw new InvalidTransitionError(
      "paid",
      "paid_cancelled",
      "actor must be admin"
    );
  }
  if (!input.reason.trim()) {
    throw new InvalidTransitionError(
      "paid",
      "paid_cancelled",
      "motivazione richiesta"
    );
  }

  const ctx = await createActionContext();

  const bookingRes = await ctx.client
    .from("bookings")
    .select("*")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (bookingRes.error) throw bookingRes.error;
  if (!bookingRes.data) throw new NotFoundError("Prenotazione");

  const booking = bookingRes.data;
  if (booking.status !== "paid") {
    throw new InvalidTransitionError(booking.status, "paid_cancelled");
  }

  if (booking.cancelled_after_payment_at) {
    return { booking };
  }

  const cancelledAt = ctx.now.toISOString();
  const affectsReviewEmail = input.affectsReviewEmail ?? true;

  const update = await ctx.client
    .from("bookings")
    .update({
      cancelled_after_payment_at: cancelledAt,
      cancelled_after_payment_by: input.actor.adminId,
      cancelled_after_payment_reason: input.reason.trim(),
      cancellation_affects_review_email: affectsReviewEmail,
    })
    .eq("id", booking.id)
    .select("*")
    .single();
  if (update.error || !update.data) throw update.error ?? new Error("Update failed");

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: booking.id,
    action: AUDIT_ACTIONS.bookingCancelledAfterPayment,
    actorType: AUDIT_ACTORS.admin,
    actorId: input.actor.adminId,
    fromState: "paid",
    toState: "paid",
    reason: input.reason.trim(),
    metadata: { affects_review_email: affectsReviewEmail },
  });

  return { booking: update.data };
}
