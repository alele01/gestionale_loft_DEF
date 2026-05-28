import "server-only";

import { CapacityExceededError } from "./errors";
import type { ActionContext } from "./context";

/**
 * Capacity accounting (see docs/PROJECT_BRIEF.md §"Capacity") consumes
 * only PAID bookings (not awaiting_completion / awaiting_payment). Pending
 * requests and waitlist do NOT block other admins from accepting more, so
 * the admin has manual control of overbooking.
 *
 * `paidSeats` excludes operationally-cancelled-after-payment bookings: the
 * seat is logically free once the admin marks the booking as cancelled
 * post-payment (the row stays paid for invoicing purposes only).
 */

export type CapacitySnapshot = {
  capacity: number;
  paidSeats: number;
  availableSeats: number;
};

export async function getEventCapacitySnapshot(
  ctx: ActionContext,
  eventId: string
): Promise<CapacitySnapshot> {
  const { client } = ctx;

  const eventRes = await client
    .from("events")
    .select("capacity")
    .eq("id", eventId)
    .maybeSingle();
  if (eventRes.error) throw eventRes.error;
  if (!eventRes.data) throw new Error(`Event ${eventId} not found`);

  const bookingsRes = await client
    .from("bookings")
    .select("people, status, cancelled_after_payment_at")
    .eq("event_id", eventId)
    .eq("status", "paid");
  if (bookingsRes.error) throw bookingsRes.error;

  const paidSeats = (bookingsRes.data ?? []).reduce((sum, b) => {
    if (b.cancelled_after_payment_at) return sum;
    return sum + (b.people ?? 0);
  }, 0);

  return {
    capacity: eventRes.data.capacity,
    paidSeats,
    availableSeats: Math.max(0, eventRes.data.capacity - paidSeats),
  };
}

/**
 * Throws CapacityExceededError when promoting `requested` additional paid
 * seats would exceed event capacity. Used by accept-request and
 * accept-from-waitlist.
 */
export async function assertCapacityAvailable(
  ctx: ActionContext,
  eventId: string,
  requested: number
): Promise<void> {
  const snap = await getEventCapacitySnapshot(ctx, eventId);
  if (requested > snap.availableSeats) {
    throw new CapacityExceededError(requested, snap.availableSeats);
  }
}
