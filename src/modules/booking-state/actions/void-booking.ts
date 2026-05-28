import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";

import { createActionContext } from "../context";
import { InvalidTransitionError, NotFoundError } from "../errors";
import type { Actor, BookingRow } from "../types";

export type VoidBookingInput = {
  bookingId: string;
  actor: Actor;
  reason: string;
};

/**
 * Mark a booking as voided without touching the request side. Used when
 * the booking expired or the admin wants to terminate just the booking
 * lifecycle (the request remains in its decided state for analytics).
 *
 * Disallowed on paid bookings: use markOperationallyCancelled instead.
 */
export async function voidBooking(
  input: VoidBookingInput
): Promise<{ booking: BookingRow }> {
  if (input.actor.type !== "admin" && input.actor.type !== "cron") {
    throw new InvalidTransitionError("any", "void", "actor admin/cron richiesto");
  }
  if (!input.reason.trim()) {
    throw new InvalidTransitionError("any", "void", "motivazione richiesta");
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
  if (booking.status === "paid") {
    throw new InvalidTransitionError("paid", "void");
  }
  if (booking.status === "void") {
    return { booking };
  }

  const update = await ctx.client
    .from("bookings")
    .update({
      status: "void",
      voided_at: ctx.now.toISOString(),
      void_reason: input.reason.trim(),
      revision: booking.revision + 1,
    })
    .eq("id", booking.id)
    .select("*")
    .single();
  if (update.error || !update.data) throw update.error ?? new Error("Update failed");

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: booking.id,
    action: AUDIT_ACTIONS.bookingVoided,
    actorType: input.actor.type === "cron" ? AUDIT_ACTORS.cron : AUDIT_ACTORS.admin,
    actorId: input.actor.type === "admin" ? input.actor.adminId : null,
    fromState: booking.status,
    toState: "void",
    reason: input.reason.trim(),
  });

  return { booking: update.data };
}
