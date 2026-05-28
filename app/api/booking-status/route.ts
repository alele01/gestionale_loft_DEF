import { NextResponse } from "next/server";

import { checkRateLimit, getClientIp } from "@/server/rate-limit/check";
import { getServiceClient } from "@/server/supabase";

/**
 * GET /api/booking-status?bookingId=uuid
 *
 * Tiny status endpoint used by `<PaymentStatusPoller />` on /payment/success
 * to detect the moment the Stripe webhook flips the booking to `paid`.
 *
 * Returns only the minimum data needed for the polling state machine —
 * never PII. The booking id is not a credential, but neither is the
 * field set returned here, so we accept anonymous polling.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId");
  if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return NextResponse.json({ error: "invalid_booking_id" }, { status: 400 });
  }

  // Anti-abuse soft throttle. The poller in `<PaymentStatusPoller />`
  // does 1 hit / 3s for up to 30s (~10 hits) per booking-success tab.
  // A user might also have multiple tabs open or reload the page —
  // hence the very generous cap. We only block obvious automated abuse.
  //
  //   - 300 hits / minute per (IP, booking) — 5/sec, ~30x the real
  //     poller. Lots of room for multiple tabs / hot reload / network
  //     retries without ever bothering a legitimate user.
  //
  // Degrade-open on DB errors: failing to throttle is always preferable
  // to failing the poll (which would surface as "pagamento in
  // elaborazione" forever to the user).
  const ip = await getClientIp();
  const limit = await checkRateLimit({
    action: "booking_status_poll",
    identifier: `ip:${ip}:b:${bookingId}`,
    windowSeconds: 60,
    maxHits: 300,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      }
    );
  }

  const client = getServiceClient();
  const res = await client
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .maybeSingle();
  if (res.error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!res.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ status: res.data.status });
}
