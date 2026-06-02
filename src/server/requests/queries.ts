import "server-only";

import { deriveUnifiedStatus, type UnifiedStatus } from "@/lib/status";
import {
  indexRequestDuplicates,
  normalizeRequestEmail,
  normalizeRequestPhone,
  type RequestDuplicateInfo,
} from "@/lib/request-duplicates";
import { getServiceClient, type Tables } from "@/server/supabase";

export type BookingRequestRow = Tables<"booking_requests">;
export type BookingRow = Tables<"bookings">;
export type EventRow = Tables<"events">;
export type FiscalProfileRow = Tables<"fiscal_profiles">;

export type RequestContext = {
  request: BookingRequestRow;
  booking: BookingRow | null;
  event: Pick<EventRow, "id" | "title" | "slug" | "starts_at" | "price_cents" | "capacity" | "status">;
  fiscal: FiscalProfileRow | null;
  unifiedStatus: UnifiedStatus;
};

const EVENT_SELECT = "id, title, slug, starts_at, price_cents, capacity, status";

export async function getRequestContext(
  requestId: string
): Promise<RequestContext | null> {
  const client = getServiceClient();
  const reqRes = await client
    .from("booking_requests")
    .select(`*, events(${EVENT_SELECT}), bookings(*)`)
    .eq("id", requestId)
    .maybeSingle();
  if (reqRes.error) throw reqRes.error;
  if (!reqRes.data) return null;

  const row = reqRes.data;
  const event = row.events;
  if (!event) return null;

  const bookingsArr = Array.isArray(row.bookings) ? row.bookings : row.bookings ? [row.bookings] : [];
  const booking = bookingsArr[0] ?? null;

  let fiscal: FiscalProfileRow | null = null;
  if (booking) {
    const fiscalRes = await client
      .from("fiscal_profiles")
      .select("*")
      .eq("booking_id", booking.id)
      .maybeSingle();
    if (fiscalRes.error) throw fiscalRes.error;
    fiscal = fiscalRes.data ?? null;
  }

  const { events: _ev, bookings: _bs, ...request } = row as typeof row & {
    events: unknown;
    bookings: unknown;
  };

  return {
    request: request as BookingRequestRow,
    booking: booking as BookingRow | null,
    event,
    fiscal,
    unifiedStatus: deriveUnifiedStatus(
      { status: row.status },
      booking
    ),
  };
}

export async function listLatestRequestsWithContext(
  limit = 20
): Promise<RequestContext[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("booking_requests")
    .select(`*, events(${EVENT_SELECT}), bookings(*)`)
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? [])
    .map((row): RequestContext | null => {
      const event = row.events;
      if (!event) return null;
      const bookingsArr = Array.isArray(row.bookings)
        ? row.bookings
        : row.bookings
          ? [row.bookings]
          : [];
      const booking = bookingsArr[0] ?? null;
      const { events: _ev, bookings: _bs, ...request } = row as typeof row & {
        events: unknown;
        bookings: unknown;
      };
      return {
        request: request as BookingRequestRow,
        booking: booking as BookingRow | null,
        event,
        fiscal: null,
        unifiedStatus: deriveUnifiedStatus({ status: row.status }, booking),
      };
    })
    .filter((row): row is RequestContext => row !== null);
}

export async function listRequestsForEvent(
  eventId: string
): Promise<RequestContext[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("booking_requests")
    .select(`*, events(${EVENT_SELECT}), bookings(*)`)
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row): RequestContext | null => {
      const event = row.events;
      if (!event) return null;
      const bookingsArr = Array.isArray(row.bookings)
        ? row.bookings
        : row.bookings
          ? [row.bookings]
          : [];
      const booking = bookingsArr[0] ?? null;
      const { events: _ev, bookings: _bs, ...request } = row as typeof row & {
        events: unknown;
        bookings: unknown;
      };
      return {
        request: request as BookingRequestRow,
        booking: booking as BookingRow | null,
        event,
        fiscal: null,
        unifiedStatus: deriveUnifiedStatus({ status: row.status }, booking),
      };
    })
    .filter((row): row is RequestContext => row !== null);
}

export type PotentialDuplicateRequest = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  submittedAt: string;
  matchTypes: RequestDuplicateInfo["matchTypes"];
};

/**
 * Other requests on the same event that share email or phone with the
 * current one. Used for admin duplicate warnings (informational only).
 */
export async function listPotentialDuplicateRequests(
  eventId: string,
  requestId: string,
  email: string,
  phone: string
): Promise<PotentialDuplicateRequest[]> {
  const siblings = await listRequestsForEvent(eventId);
  const index = indexRequestDuplicates(
    siblings.map((row) => ({
      id: row.request.id,
      eventId: row.event.id,
      email: row.request.requester_email,
      phone: row.request.requester_phone,
    }))
  );

  const info = index.get(requestId);
  if (!info) return [];

  const targetEmail = normalizeRequestEmail(email);
  const targetPhone = normalizeRequestPhone(phone);

  return siblings
    .filter((row) => info.otherIds.includes(row.request.id))
    .map((row) => {
      const matchTypes: RequestDuplicateInfo["matchTypes"] = [];
      if (
        normalizeRequestEmail(row.request.requester_email) === targetEmail
      ) {
        matchTypes.push("email");
      }
      const rowPhone = normalizeRequestPhone(row.request.requester_phone);
      if (
        targetPhone.length >= 8 &&
        rowPhone === targetPhone &&
        rowPhone.length >= 8
      ) {
        if (!matchTypes.includes("phone")) matchTypes.push("phone");
      }
      return {
        id: row.request.id,
        firstName: row.request.requester_first_name,
        lastName: row.request.requester_last_name,
        status: row.request.status,
        submittedAt: row.request.submitted_at,
        matchTypes,
      };
    })
    .sort(
      (a, b) =>
        Date.parse(b.submittedAt) - Date.parse(a.submittedAt)
    );
}
