import "server-only";

import { getServiceClient } from "@/server/supabase";

/**
 * Booking-roster export — standalone, admin-facing convenience feature.
 *
 * This module has NOTHING to do with the fiscal / FatturaPA XML export
 * (`src/server/xml-export`, `src/modules/xml-export`). It only reads data
 * to produce a plain Excel roster of the people booked on an event. It
 * does not write anything, does not touch invoice counters, and shares no
 * code with the invoicing pipeline.
 *
 * Scope: bookings that have been completed and are either already paid or
 * still awaiting payment — i.e. people the staff can reasonably expect at
 * the event. `awaiting_completion`, `expired` and `void` are excluded.
 */
export const EXPORTABLE_BOOKING_STATUSES = ["paid", "awaiting_payment"] as const;

export type BookingExportStatus = (typeof EXPORTABLE_BOOKING_STATUSES)[number];

export type BookingExportRow = {
  firstName: string;
  lastName: string;
  people: number;
  phone: string;
  email: string;
  /** Single free-text field from the request form (allergie/intolleranze/esigenze). */
  dietaryNotes: string;
  specialOccasion: string;
  status: BookingExportStatus;
  /**
   * For paid bookings: the amount actually charged. For awaiting_payment:
   * the amount still due. Always in cents.
   */
  amountCents: number;
  paidAt: string | null;
  /** 'accept' | 'decline' | null (null = booking completed before choosing, defensive). */
  imageUseChoice: string | null;
};

type JoinedRequest = {
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  people: number | null;
  dietary_notes: string | null;
  special_occasion: string | null;
};

/**
 * Load the roster rows for one event. Pulls from `bookings` (authoritative
 * for the completed snapshot) joined to its originating `booking_requests`
 * for the contact fields.
 */
export async function loadEventBookingsForExport(
  eventId: string
): Promise<BookingExportRow[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from("bookings")
    .select(
      `id, people, amount_cents, amount_paid_cents, status, dietary_notes,
       special_occasion, image_use_choice, paid_at,
       booking_requests!bookings_request_id_fkey(
         requester_first_name, requester_last_name, requester_email,
         requester_phone, people, dietary_notes, special_occasion
       )`
    )
    .eq("event_id", eventId)
    .in("status", [...EXPORTABLE_BOOKING_STATUSES])
    // Exclude paid-then-operationally-cancelled bookings (e.g. refunded
    // double payments): those people are not attending, and excluding them
    // keeps this roster consistent with the "Posti pagati" counter, which
    // also drops cancelled_after_payment rows.
    .is("cancelled_after_payment_at", null);

  if (error) throw error;

  const rows: BookingExportRow[] = (data ?? []).map((b) => {
    const req = normalizeJoin(b.booking_requests);
    const status = b.status as BookingExportStatus;
    const amountCents =
      status === "paid" && b.amount_paid_cents != null
        ? Number(b.amount_paid_cents)
        : Number(b.amount_cents);

    return {
      firstName: (req?.requester_first_name ?? "").trim(),
      lastName: (req?.requester_last_name ?? "").trim(),
      people: b.people ?? req?.people ?? 0,
      phone: (req?.requester_phone ?? "").trim(),
      email: (req?.requester_email ?? "").trim(),
      dietaryNotes: (b.dietary_notes ?? req?.dietary_notes ?? "").trim(),
      specialOccasion: (b.special_occasion ?? req?.special_occasion ?? "").trim(),
      status,
      amountCents,
      paidAt: b.paid_at ?? null,
      imageUseChoice: b.image_use_choice ?? null,
    };
  });

  // Sort: paid first, then awaiting payment; within each, by surname/name.
  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === "paid" ? -1 : 1;
    const byLast = a.lastName.localeCompare(b.lastName, "it", {
      sensitivity: "base",
    });
    if (byLast !== 0) return byLast;
    return a.firstName.localeCompare(b.firstName, "it", {
      sensitivity: "base",
    });
  });

  return rows;
}

function normalizeJoin(
  joined: JoinedRequest | JoinedRequest[] | null
): JoinedRequest | null {
  if (!joined) return null;
  return Array.isArray(joined) ? (joined[0] ?? null) : joined;
}
