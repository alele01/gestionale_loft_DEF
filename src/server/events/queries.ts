import "server-only";

import { getServiceClient, type Tables } from "../supabase";

export type EventRow = Tables<"events">;

/**
 * Counts of bookings/requests grouped per useful bucket. The admin pages
 * use these to render the dashboard tiles + event detail counters.
 */
export type EventCounters = {
  requestsPending: number;
  requestsWaitlisted: number;
  bookingsAwaitingCompletion: number;
  bookingsAwaitingPayment: number;
  bookingsPaid: number;
  bookingsPaidCancelled: number;
  requestsRejected: number;
  paidPeople: number;
};

const ZERO_COUNTERS: EventCounters = {
  requestsPending: 0,
  requestsWaitlisted: 0,
  bookingsAwaitingCompletion: 0,
  bookingsAwaitingPayment: 0,
  bookingsPaid: 0,
  bookingsPaidCancelled: 0,
  requestsRejected: 0,
  paidPeople: 0,
};

export async function listEvents(
  options: { includeArchived?: boolean } = {}
): Promise<EventRow[]> {
  const client = getServiceClient();
  let query = client.from("events").select("*").order("starts_at", { ascending: true });
  if (!options.includeArchived) {
    query = query.neq("status", "archived");
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getEventById(eventId: string): Promise<EventRow | null> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Public-embed lookup: returns the event only if it is currently
 * `published`. Other statuses (draft, closed, archived) yield null so the
 * caller can render a 404.
 */
export async function getPublishedEventBySlug(slug: string): Promise<EventRow | null> {
  const event = await getEventBySlug(slug);
  if (!event) return null;
  if (event.status !== "published") return null;
  return event;
}

/**
 * Compute all admin-visible counters for an event in a single Postgres
 * round-trip. We project the minimum columns we need and bucket in JS.
 */
export async function getEventCounters(eventId: string): Promise<EventCounters> {
  const client = getServiceClient();
  const counters: EventCounters = { ...ZERO_COUNTERS };

  const [requestsRes, bookingsRes] = await Promise.all([
    client
      .from("booking_requests")
      .select("status")
      .eq("event_id", eventId),
    client
      .from("bookings")
      .select("status, people, cancelled_after_payment_at")
      .eq("event_id", eventId),
  ]);

  if (requestsRes.error) throw requestsRes.error;
  if (bookingsRes.error) throw bookingsRes.error;

  for (const row of requestsRes.data ?? []) {
    if (row.status === "pending") counters.requestsPending += 1;
    else if (row.status === "waitlisted") counters.requestsWaitlisted += 1;
    else if (row.status === "rejected") counters.requestsRejected += 1;
  }

  for (const row of bookingsRes.data ?? []) {
    if (row.status === "awaiting_completion") counters.bookingsAwaitingCompletion += 1;
    else if (row.status === "awaiting_payment") counters.bookingsAwaitingPayment += 1;
    else if (row.status === "paid") {
      if (row.cancelled_after_payment_at !== null) {
        counters.bookingsPaidCancelled += 1;
      } else {
        counters.bookingsPaid += 1;
        counters.paidPeople += row.people ?? 0;
      }
    }
  }

  return counters;
}

export type EventWithCounters = EventRow & { counters: EventCounters };

export async function listEventsWithCounters(
  options: { includeArchived?: boolean } = {}
): Promise<EventWithCounters[]> {
  const events = await listEvents(options);
  const counters = await Promise.all(events.map((e) => getEventCounters(e.id)));
  return events.map((event, i) => ({ ...event, counters: counters[i] }));
}
