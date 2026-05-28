/**
 * Unified status derivation + display metadata, decoupled from the mock
 * store so server components, badges, and any other consumer can share a
 * single source of truth.
 *
 * "Unified status" collapses the (booking_request × booking) pair into a
 * single value the admin UI cares about:
 *
 *   - received        → pending booking_request, no booking yet
 *   - waitlisted      → waitlisted booking_request, no booking yet
 *   - rejected        → rejected booking_request
 *   - to_pay          → booking in awaiting_completion or awaiting_payment
 *   - paid            → booking paid, no operational cancellation
 *   - paid_cancelled  → booking paid + cancelled after payment
 *   - deleted         → booking voided / request cancelled while pre-payment
 */

export type UnifiedStatus =
  | "received"
  | "waitlisted"
  | "to_pay"
  | "paid"
  | "rejected"
  | "paid_cancelled"
  | "deleted";

export const unifiedStatusLabel: Record<UnifiedStatus, string> = {
  received: "Richiesta ricevuta",
  waitlisted: "In lista d'attesa",
  to_pay: "In attesa di pagamento",
  paid: "Pagata",
  rejected: "Rifiutata",
  paid_cancelled: "Pagata · cancellata",
  deleted: "Eliminata",
};

export type UnifiedTone =
  | "neutral"
  | "amber"
  | "indigo"
  | "emerald"
  | "rose"
  | "muted";

export const unifiedStatusTone: Record<UnifiedStatus, UnifiedTone> = {
  received: "neutral",
  waitlisted: "amber",
  to_pay: "indigo",
  paid: "emerald",
  rejected: "muted",
  paid_cancelled: "rose",
  deleted: "muted",
};

export type RequestLike = {
  status: string;
};

export type BookingLike = {
  status: string;
  cancelled_after_payment_at?: string | null;
  voided_at?: string | null;
};

/**
 * Server-side equivalent of `deriveUnifiedStatus` for real DB rows.
 */
export function deriveUnifiedStatus(
  request: RequestLike,
  booking: BookingLike | null
): UnifiedStatus {
  if (booking) {
    if (booking.status === "paid") {
      if (booking.cancelled_after_payment_at) return "paid_cancelled";
      return "paid";
    }
    if (booking.status === "awaiting_completion") return "to_pay";
    if (booking.status === "awaiting_payment") return "to_pay";
    if (booking.status === "void") return "deleted";
    if (booking.status === "expired") return "deleted";
  }
  if (request.status === "rejected") return "rejected";
  if (request.status === "waitlisted") return "waitlisted";
  if (request.status === "cancelled" || request.status === "expired") {
    return "deleted";
  }
  return "received";
}
