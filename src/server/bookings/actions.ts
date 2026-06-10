"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  BookingStateError,
  editBookingPrePayment,
  markOperationallyCancelled,
} from "@/modules/booking-state";
import {
  AdminInputError,
  adminSchemas,
  parseAdminInput,
} from "@/server/admin/validate-input";
import { appendAuditLog } from "@/server/audit/log";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTORS,
  AUDIT_ENTITIES,
} from "@/server/audit-actions";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  sendE2RequestAccepted,
  sendE5AcceptedFromWaitlist,
  sendE7PaymentRetry,
  sendE11PaymentReminder,
  type EmailSendResult,
} from "@/server/email";
import { buildPaymentRetryUrl } from "@/server/email/format";
import { serverEnv } from "@/server/env";
import { getServiceClient } from "@/server/supabase";

export type ActionResult =
  | { status: "ok" }
  | { status: "error"; message: string; code?: string };

function asError(err: unknown): ActionResult {
  if (err instanceof AdminInputError) {
    return { status: "error", code: err.code, message: err.message };
  }
  if (err instanceof BookingStateError) {
    return { status: "error", code: err.code, message: err.message };
  }
  // eslint-disable-next-line no-console
  console.error("[bookings.actions]", err);
  return { status: "error", message: "Errore inatteso" };
}

const EditBookingInputSchema = z.object({
  bookingId: adminSchemas.uuid,
  requestId: adminSchemas.uuid.optional(),
  people: z.number().int().min(1).max(100).optional(),
  dietaryNotes: adminSchemas.nullableTrimmedString(2000),
  specialOccasion: adminSchemas.nullableTrimmedString(500),
});

const GetCompletionLinkInputSchema = z.object({
  bookingId: adminSchemas.uuid,
});

const ResendCompletionEmailInputSchema = z.object({
  bookingId: adminSchemas.uuid,
  requestId: adminSchemas.uuid.optional(),
});

const MarkOperationallyCancelledInputSchema = z.object({
  bookingId: adminSchemas.uuid,
  requestId: adminSchemas.uuid.optional(),
  reason: z.string().trim().min(1).max(2000),
  affectsReviewEmail: z.boolean().optional(),
});

function revalidatePrenotazione(requestId?: string) {
  if (requestId) revalidatePath(`/admin/prenotazioni/${requestId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/events");
}

export async function editBookingAction(input: {
  bookingId: string;
  requestId?: string;
  people?: number;
  dietaryNotes?: string | null;
  specialOccasion?: string | null;
}): Promise<ActionResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(EditBookingInputSchema, input);
    await editBookingPrePayment({
      bookingId: validated.bookingId,
      actor: { type: "admin", adminId: identity.adminUser.id, email: identity.adminUser.email },
      patch: {
        people: validated.people,
        dietaryNotes: validated.dietaryNotes,
        specialOccasion: validated.specialOccasion,
      },
    });
    revalidatePrenotazione(validated.requestId);
    return { status: "ok" };
  } catch (err) {
    return asError(err);
  }
}

export type CompletionLinkResult =
  | { status: "ok"; url: string; issuedAt: string | null }
  | { status: "error"; message: string };

/**
 * Recovers the latest plaintext completion link for a booking by reading
 * the most recent `booking.completion_link_issued` audit_log row. The
 * audit_log is admin-only via RLS; product decision is that completion
 * links do not expire, so admins can copy them manually if needed.
 */
export async function getCompletionLinkAction(input: {
  bookingId: string;
}): Promise<CompletionLinkResult> {
  await requireAdmin();
  try {
    const validated = parseAdminInput(GetCompletionLinkInputSchema, input);
    const client = getServiceClient();
    const { data: booking, error: bookingErr } = await client
      .from("bookings")
      .select("id, status")
      .eq("id", validated.bookingId)
      .maybeSingle();
    if (bookingErr) throw bookingErr;
    if (!booking) {
      return { status: "error", message: "Prenotazione non trovata." };
    }
    if (
      booking.status !== "awaiting_completion" &&
      booking.status !== "awaiting_payment"
    ) {
      return {
        status: "error",
        message:
          "Il link di completamento è disponibile solo prima del pagamento.",
      };
    }

    const { data: rows, error: auditErr } = await client
      .from("audit_log")
      .select("metadata, created_at")
      .eq("entity_type", "booking")
      .eq("entity_id", validated.bookingId)
      .eq("action", "booking.completion_link_issued")
      .order("created_at", { ascending: false })
      .limit(1);
    if (auditErr) throw auditErr;

    const token = rows
      ?.map((row) => {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const t = meta.completion_link_token;
        return typeof t === "string" && t.length > 0
          ? { token: t, issuedAt: row.created_at }
          : null;
      })
      .find((r): r is { token: string; issuedAt: string } => r !== null);

    if (!token) {
      return {
        status: "error",
        message:
          "Nessun link di completamento trovato. Prova ad accettare nuovamente la richiesta.",
      };
    }

    const url = `${serverEnv.APP_BASE_URL.replace(/\/$/, "")}/complete/${token.token}`;
    return { status: "ok", url, issuedAt: token.issuedAt };
  } catch (err) {
    if (err instanceof AdminInputError) {
      return { status: "error", message: err.message };
    }
    // eslint-disable-next-line no-console
    console.error("[bookings.getCompletionLinkAction]", err);
    return { status: "error", message: "Errore inatteso" };
  }
}

export type ResendCompletionEmailResult =
  | { status: "ok"; deduplicated: boolean }
  | { status: "error"; message: string };

/**
 * Manually re-send a "next-step" email to the customer from the admin UI.
 *
 * The email kind depends on the booking status:
 *
 *   - `awaiting_completion` → E2 (direct) or E5 (waitlist) with the
 *     `/complete/[token]` link. The token is the current (non-rotated)
 *     one; to rotate, use `editBookingPrePayment` (changing `people`
 *     also expires the Stripe session and sends an "amendment" variant).
 *
 *   - `awaiting_payment` → E7 "payment retry" with the `/pay/[bookingId]`
 *     link. The completion token has already been used by this point, so
 *     re-sending E2/E5 would deliver a "link non valido" experience. E7
 *     instead triggers `recreateCheckoutSession` server-side and bounces
 *     the user directly to a fresh Stripe Checkout.
 *
 * Both branches use a timestamped idempotency key so the admin can
 * legitimately re-send (each click produces a new email_log row).
 */
export async function resendCompletionEmailAction(input: {
  bookingId: string;
  requestId?: string;
}): Promise<ResendCompletionEmailResult> {
  await requireAdmin();
  try {
    const validated = parseAdminInput(
      ResendCompletionEmailInputSchema,
      input
    );
    const client = getServiceClient();

    const { data: booking, error } = await client
      .from("bookings")
      .select(
        "id, status, revision, origin, people, amount_cents, request_id, stripe_session_id, events(title, starts_at), booking_requests:request_id (requester_first_name, requester_email)"
      )
      .eq("id", validated.bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!booking) {
      return { status: "error", message: "Prenotazione non trovata." };
    }
    const event = booking.events;
    const request = booking.booking_requests;
    if (!event || !request) {
      return { status: "error", message: "Dati incompleti per il re-invio." };
    }

    let result: EmailSendResult;

    if (booking.status === "awaiting_payment") {
      result = await sendE7PaymentRetry({
        bookingId: booking.id,
        // `stripe_session_id` is normally set in awaiting_payment, but
        // we fall back to a synthetic anchor to avoid a runtime crash
        // if the Stripe session expired and was cleared by an edit.
        stripeSessionId:
          booking.stripe_session_id ?? `admin_resend_${booking.id}`,
        reason: "session_expired",
        requesterFirstName: request.requester_first_name,
        requesterEmail: request.requester_email,
        eventTitle: event.title,
        eventStartsAt: event.starts_at,
        people: booking.people,
        amountCents: booking.amount_cents,
        idempotencyKeyOverride: `payment_retry_resend:${booking.id}:${Date.now()}`,
      });
    } else {
      // awaiting_completion → E2 / E5 with the /complete/[token] link.
      const linkResult = await getCompletionLinkAction({
        bookingId: validated.bookingId,
      });
      if (linkResult.status !== "ok") {
        return { status: "error", message: linkResult.message };
      }
      const url = new URL(linkResult.url);
      const token = url.pathname.split("/").filter(Boolean).pop();
      if (!token) {
        return { status: "error", message: "Token non valido nel link." };
      }

      const payload = {
        bookingId: booking.id,
        revision: booking.revision,
        mode: "initial" as const,
        requesterFirstName: request.requester_first_name,
        requesterEmail: request.requester_email,
        eventTitle: event.title,
        eventStartsAt: event.starts_at,
        people: booking.people,
        amountCents: booking.amount_cents,
        completionTokenPlaintext: token,
        idempotencyKeyOverride:
          booking.origin === "waitlist"
            ? `req_accepted_from_waitlist_resend:${booking.id}:${Date.now()}`
            : `req_accepted_resend:${booking.id}:${Date.now()}`,
      };

      if (booking.origin === "waitlist") {
        result = await sendE5AcceptedFromWaitlist(payload);
      } else {
        result = await sendE2RequestAccepted(payload);
      }
    }

    if (result.status === "failed") {
      return {
        status: "error",
        message: `Invio fallito: ${result.error}`,
      };
    }
    revalidatePrenotazione(validated.requestId);
    return { status: "ok", deduplicated: result.deduplicated };
  } catch (err) {
    if (err instanceof AdminInputError) {
      return { status: "error", message: err.message };
    }
    // eslint-disable-next-line no-console
    console.error("[bookings.resendCompletionEmailAction]", err);
    return { status: "error", message: "Errore inatteso" };
  }
}

const SendEventPaymentRemindersInputSchema = z.object({
  eventId: adminSchemas.uuid,
});

export type EventPaymentRemindersResult =
  | {
      status: "ok";
      /** Reminders actually sent in this run. */
      sent: number;
      /** Skipped because a reminder already went out today (daily dedup). */
      alreadySentToday: number;
      /** awaiting_completion bookings whose completion link is expired. */
      skippedExpiredLink: number;
      /** Sends that failed (transport error or missing data). */
      failed: number;
    }
  | { status: "error"; message: string };

/**
 * Bulk "payment reminder" for one event: sends E11 to every booking still
 * in `awaiting_completion` / `awaiting_payment`.
 *
 * Safety properties (see docs/SECURITY.md §5–§6 for the payment side):
 *  - No Stripe session is created here. The E11 CTA points to the existing
 *    `/complete/[token]` or `/pay/[bookingId]` pages; checkout sessions are
 *    created/reused only when the user clicks, with all the usual guards
 *    (revision check, amount check, paid-state no-op).
 *  - Daily idempotency: the sender anchors on
 *    `payment_reminder:{bookingId}:{romeDay}`, so a double click cannot
 *    spam recipients — already-reminded bookings count as
 *    `alreadySentToday`.
 *  - `awaiting_completion` bookings past their `completion_deadline_at`
 *    are skipped (their link would land on "link scaduto").
 */
export async function sendEventPaymentRemindersAction(input: {
  eventId: string;
}): Promise<EventPaymentRemindersResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(
      SendEventPaymentRemindersInputSchema,
      input
    );
    const client = getServiceClient();

    const { data: bookings, error } = await client
      .from("bookings")
      .select(
        "id, status, people, amount_cents, completion_deadline_at, events:event_id (title, starts_at), booking_requests:request_id (requester_first_name, requester_email)"
      )
      .eq("event_id", validated.eventId)
      .in("status", ["awaiting_completion", "awaiting_payment"]);
    if (error) throw error;

    const now = new Date();
    let sent = 0;
    let alreadySentToday = 0;
    let skippedExpiredLink = 0;
    let failed = 0;

    for (const booking of bookings ?? []) {
      const event = booking.events;
      const request = booking.booking_requests;
      if (!event || !request) {
        failed += 1;
        continue;
      }

      let mode: "complete" | "pay";
      let ctaUrl: string;

      if (booking.status === "awaiting_completion") {
        if (
          booking.completion_deadline_at &&
          new Date(booking.completion_deadline_at) < now
        ) {
          skippedExpiredLink += 1;
          continue;
        }
        const linkResult = await getCompletionLinkAction({
          bookingId: booking.id,
        });
        if (linkResult.status !== "ok") {
          failed += 1;
          continue;
        }
        mode = "complete";
        ctaUrl = linkResult.url;
      } else {
        mode = "pay";
        ctaUrl = buildPaymentRetryUrl(serverEnv.APP_BASE_URL, booking.id);
      }

      const result = await sendE11PaymentReminder({
        bookingId: booking.id,
        mode,
        ctaUrl,
        requesterFirstName: request.requester_first_name,
        requesterEmail: request.requester_email,
        eventTitle: event.title,
        eventStartsAt: event.starts_at,
        people: booking.people,
        amountCents: booking.amount_cents,
      });

      if (result.status === "failed") failed += 1;
      else if (result.deduplicated) alreadySentToday += 1;
      else sent += 1;
    }

    await appendAuditLog({
      entityType: AUDIT_ENTITIES.event,
      entityId: validated.eventId,
      action: AUDIT_ACTIONS.eventPaymentRemindersSent,
      actorType: AUDIT_ACTORS.admin,
      actorId: identity.adminUser.id,
      metadata: {
        sent,
        already_sent_today: alreadySentToday,
        skipped_expired_link: skippedExpiredLink,
        failed,
        eligible: (bookings ?? []).length,
      },
    });

    return { status: "ok", sent, alreadySentToday, skippedExpiredLink, failed };
  } catch (err) {
    if (err instanceof AdminInputError) {
      return { status: "error", message: err.message };
    }
    // eslint-disable-next-line no-console
    console.error("[bookings.sendEventPaymentRemindersAction]", err);
    return { status: "error", message: "Errore inatteso" };
  }
}

export async function markOperationallyCancelledAction(input: {
  bookingId: string;
  requestId?: string;
  reason: string;
  affectsReviewEmail?: boolean;
}): Promise<ActionResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(
      MarkOperationallyCancelledInputSchema,
      input
    );
    await markOperationallyCancelled({
      bookingId: validated.bookingId,
      actor: { type: "admin", adminId: identity.adminUser.id, email: identity.adminUser.email },
      reason: validated.reason,
      affectsReviewEmail: validated.affectsReviewEmail,
    });
    revalidatePrenotazione(validated.requestId);
    return { status: "ok" };
  } catch (err) {
    return asError(err);
  }
}
