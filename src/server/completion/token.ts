import "server-only";

import { hashCompletionToken, hashToPostgresHex } from "@/modules/booking-state/token";
import { getServiceClient, type Tables } from "@/server/supabase";

export type CompletionLookup = {
  booking: Tables<"bookings">;
  request: Tables<"booking_requests">;
  event: Pick<Tables<"events">, "id" | "title" | "starts_at" | "price_cents" | "capacity" | "duration_min">;
  state: "ready" | "already_completed" | "already_paid" | "void" | "expired";
};

/**
 * Resolve a /complete/[token] route against the bookings table. Returns
 * null when the token does not match any booking (so the page can render
 * a generic "link non valido" view without leaking info).
 *
 * Adds a derived `state` summary so the server page can branch cleanly.
 */
export async function lookupCompletion(
  tokenPlaintext: string
): Promise<CompletionLookup | null> {
  if (!tokenPlaintext || tokenPlaintext.length < 8) return null;
  const hash = hashCompletionToken(tokenPlaintext);
  const client = getServiceClient();

  const bookingRes = await client
    .from("bookings")
    .select("*")
    .filter("completion_token_hash", "eq", hashToPostgresHex(hash))
    .maybeSingle();
  if (bookingRes.error) throw bookingRes.error;
  if (!bookingRes.data) return null;
  const booking = bookingRes.data;

  const [requestRes, eventRes] = await Promise.all([
    client
      .from("booking_requests")
      .select("*")
      .eq("id", booking.request_id)
      .maybeSingle(),
    client
      .from("events")
      .select("id, title, starts_at, price_cents, capacity, duration_min")
      .eq("id", booking.event_id)
      .maybeSingle(),
  ]);
  if (requestRes.error) throw requestRes.error;
  if (eventRes.error) throw eventRes.error;
  if (!requestRes.data || !eventRes.data) return null;

  const now = new Date();
  let state: CompletionLookup["state"] = "ready";
  if (booking.status === "void") state = "void";
  else if (booking.status === "expired") state = "expired";
  else if (booking.status === "paid") state = "already_paid";
  else if (booking.status === "awaiting_payment" || booking.completion_token_used_at)
    state = "already_completed";
  else if (booking.completion_deadline_at && new Date(booking.completion_deadline_at) < now)
    state = "expired";

  return {
    booking,
    request: requestRes.data,
    event: eventRes.data,
    state,
  };
}
