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
  unifiedStatus: UnifiedStatus;
  submittedAt: string;
  matchTypes: RequestDuplicateInfo["matchTypes"];
};

export type RelatedRequestOnOtherEvent = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  firstName: string;
  lastName: string;
  submittedAt: string;
  unifiedStatus: UnifiedStatus;
  matchTypes: RequestDuplicateInfo["matchTypes"];
};

function matchTypesForContact(
  rowEmail: string,
  rowPhone: string,
  targetEmail: string,
  targetPhone: string
): RequestDuplicateInfo["matchTypes"] {
  const matchTypes: RequestDuplicateInfo["matchTypes"] = [];
  if (normalizeRequestEmail(rowEmail) === targetEmail) {
    matchTypes.push("email");
  }
  const rowPhoneNorm = normalizeRequestPhone(rowPhone);
  if (
    targetPhone.length >= 8 &&
    rowPhoneNorm === targetPhone &&
    rowPhoneNorm.length >= 8
  ) {
    if (!matchTypes.includes("phone")) matchTypes.push("phone");
  }
  return matchTypes;
}

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
    .map((row) => ({
      id: row.request.id,
      firstName: row.request.requester_first_name,
      lastName: row.request.requester_last_name,
      status: row.request.status,
      unifiedStatus: row.unifiedStatus,
      submittedAt: row.request.submitted_at,
      matchTypes: matchTypesForContact(
        row.request.requester_email,
        row.request.requester_phone,
        targetEmail,
        targetPhone
      ),
    }))
    .sort(
      (a, b) =>
        Date.parse(b.submittedAt) - Date.parse(a.submittedAt)
    );
}

/**
 * Other requests on *different* events that share email or phone with the
 * current one. Used for cross-event duplicate warnings (informational only).
 */
export async function listRelatedRequestsOnOtherEvents(
  eventId: string,
  requestId: string,
  email: string,
  phone: string
): Promise<RelatedRequestOnOtherEvent[]> {
  const client = getServiceClient();
  const targetEmail = normalizeRequestEmail(email);
  const targetPhone = normalizeRequestPhone(phone);

  const { data, error } = await client
    .from("booking_requests")
    .select(
      `id, event_id, requester_first_name, requester_last_name, requester_email, requester_phone, status, submitted_at, events(${EVENT_SELECT}), bookings(status, cancelled_after_payment_at, voided_at)`
    )
    .neq("id", requestId)
    .neq("event_id", eventId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  const rows: RelatedRequestOnOtherEvent[] = [];

  for (const row of data ?? []) {
    const matchTypes = matchTypesForContact(
      row.requester_email,
      row.requester_phone,
      targetEmail,
      targetPhone
    );
    if (matchTypes.length === 0) continue;

    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!event) continue;

    const bookingsArr = Array.isArray(row.bookings)
      ? row.bookings
      : row.bookings
        ? [row.bookings]
        : [];
    const booking = bookingsArr[0] ?? null;

    rows.push({
      id: row.id,
      eventId: row.event_id,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      firstName: row.requester_first_name,
      lastName: row.requester_last_name,
      submittedAt: row.submitted_at,
      unifiedStatus: deriveUnifiedStatus(
        { status: row.status },
        booking
      ),
      matchTypes,
    });
  }

  return rows.sort(
    (a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)
  );
}
