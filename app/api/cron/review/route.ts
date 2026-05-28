import { NextResponse } from "next/server";

import { getCronSecret, serverEnv } from "@/server/env";
import { sendE9ReviewRequest } from "@/server/email";
import { getServiceClient } from "@/server/supabase";

/**
 * GET /api/cron/review — daily Vercel Cron that emails E9 (Google review
 * request) to representatives whose paid booking ended more than 12 hours
 * ago and who have not yet received the review email.
 *
 * Schedule: see vercel.json. Vercel Cron sends
 *   Authorization: Bearer ${CRON_SECRET}
 * automatically when CRON_SECRET is configured in the Vercel project.
 *
 * Pre-conditions (defense in depth):
 *  - `app_settings.review_email_enabled = true` (kill switch)
 *  - `app_settings.review_url IS NOT NULL` (otherwise we log a warning and
 *    skip every send for this tick)
 *
 * Post-conditions:
 *  - On Resend success → set `bookings.review_email_sent_at = now()`.
 *  - On failure → leave `review_email_sent_at = NULL` so the next tick
 *    retries the send naturally.
 *
 * Implementation note (V1): the "event ended at least 12 hours ago" check
 * is enforced in application code rather than SQL. We fetch every booking
 * still missing a review email and filter by the local `event.starts_at +
 * COALESCE(duration_min, 0) * 60s` cut-off. Cron runs once a day on a tiny
 * candidate set; this is fine.
 */
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    const secret = getCronSecret();
    const header = request.headers.get("authorization") ?? "";
    if (!secret || header !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }
  } else {
    const localSecret = getCronSecret();
    if (localSecret) {
      const header = request.headers.get("authorization") ?? "";
      if (header !== `Bearer ${localSecret}`) {
        return NextResponse.json(
          { error: "unauthorized" },
          { status: 401 }
        );
      }
    }
  }

  const client = getServiceClient();

  const settingsRes = await client
    .from("app_settings")
    .select("review_email_enabled, review_url")
    .eq("id", 1)
    .maybeSingle();
  if (settingsRes.error) {
    return NextResponse.json(
      { error: "settings_load_failed", details: settingsRes.error.message },
      { status: 500 }
    );
  }
  const settings = settingsRes.data;
  if (!settings) {
    return NextResponse.json({ error: "settings_missing" }, { status: 500 });
  }

  if (!settings.review_email_enabled) {
    return NextResponse.json({
      ok: true,
      candidates: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      reason: "review_email_disabled",
    });
  }

  if (!settings.review_url) {
    // eslint-disable-next-line no-console
    console.warn(
      "[cron/review] review_url is null in app_settings; skipping all sends."
    );
    return NextResponse.json({
      ok: true,
      candidates: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      reason: "review_url_null",
    });
  }

  const candidatesRes = await client
    .from("bookings")
    .select(
      `
      id,
      review_email_sent_at,
      cancelled_after_payment_at,
      status,
      booking_requests:request_id ( requester_email, requester_first_name ),
      events:event_id ( title, starts_at, duration_min )
    `
    )
    .eq("status", "paid")
    .is("cancelled_after_payment_at", null)
    .is("review_email_sent_at", null);
  if (candidatesRes.error) {
    return NextResponse.json(
      { error: "candidates_load_failed", details: candidatesRes.error.message },
      { status: 500 }
    );
  }

  const reviewUrl = settings.review_url;
  const now = Date.now();
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidatesRes.data ?? []) {
    const event = candidate.events;
    const request = candidate.booking_requests;
    if (!event || !request) {
      skipped += 1;
      continue;
    }
    const startedAt = new Date(event.starts_at).getTime();
    const endedAt =
      startedAt + (event.duration_min ?? 0) * 60 * 1000;
    if (endedAt > now - TWELVE_HOURS_MS) {
      // Event ended less than 12 hours ago; skip until tomorrow.
      skipped += 1;
      continue;
    }

    const result = await sendE9ReviewRequest({
      bookingId: candidate.id,
      requesterFirstName: request.requester_first_name,
      requesterEmail: request.requester_email,
      eventTitle: event.title,
      reviewUrl,
    });

    if (result.status === "sent") {
      sent += 1;
      const stampRes = await client
        .from("bookings")
        .update({ review_email_sent_at: new Date().toISOString() })
        .eq("id", candidate.id);
      if (stampRes.error) {
        // eslint-disable-next-line no-console
        console.error(
          "[cron/review] failed to stamp review_email_sent_at",
          { bookingId: candidate.id, error: stampRes.error }
        );
      }
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidatesRes.data?.length ?? 0,
    sent,
    failed,
    skipped,
    app_base_url: serverEnv.APP_BASE_URL,
  });
}
