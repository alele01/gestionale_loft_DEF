import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import {
  AUDIT_ACTIONS,
  AUDIT_ACTORS,
  AUDIT_ENTITIES,
  type AuditAction,
} from "@/server/audit-actions";
import {
  sendE2RequestAccepted,
  sendE5AcceptedFromWaitlist,
} from "@/server/email";

import { assertCapacityAvailable } from "../capacity";
import { createActionContext } from "../context";
import {
  InvalidTransitionError,
  NotFoundError,
} from "../errors";
import { issueCompletionToken } from "../token";
import type {
  Actor,
  BookingOrigin,
  BookingRequestRow,
  BookingRow,
} from "../types";

export type AcceptRequestInput = {
  requestId: string;
  actor: Actor;
  /** Optional decision note shared with the requester via E2. */
  decisionShareWithRequester?: boolean;
  decisionReason?: string | null;
};

export type AcceptRequestResult = {
  request: BookingRequestRow;
  booking: BookingRow;
  completionTokenPlaintext: string;
};

/**
 * Pending → accepted + creates the booking in awaiting_completion.
 *
 * Side-effects:
 *   - E2 "Request accepted + completion link" → requester (link contains
 *     the plaintext completion token; only stored as SHA-256 in DB).
 */
export async function acceptRequest(
  input: AcceptRequestInput
): Promise<AcceptRequestResult> {
  if (input.actor.type !== "admin") {
    throw new InvalidTransitionError("pending", "accepted", "actor must be admin");
  }

  const ctx = await createActionContext();

  const requestRes = await ctx.client
    .from("booking_requests")
    .select("*, events(id, title, capacity, price_cents, status, starts_at)")
    .eq("id", input.requestId)
    .maybeSingle();
  if (requestRes.error) throw requestRes.error;
  if (!requestRes.data) throw new NotFoundError("Richiesta");

  const request = requestRes.data;
  const event = request.events;
  if (!event) throw new NotFoundError("Evento");

  if (request.status !== "pending") {
    throw new InvalidTransitionError(request.status, "accepted");
  }

  const origin: BookingOrigin = "direct";

  await assertCapacityAvailable(ctx, request.event_id, request.people);

  return await transitionToAccepted({
    ctx,
    request,
    event: {
      id: event.id,
      title: event.title,
      price_cents: event.price_cents,
      starts_at: event.starts_at,
    },
    actor: input.actor,
    origin,
    promotedAuditAction: AUDIT_ACTIONS.requestAccepted,
    shareWithRequester: input.decisionShareWithRequester ?? false,
    decisionReason: input.decisionReason ?? null,
    emailId: "E2",
  });
}

/**
 * Shared core used by both `acceptRequest` and `acceptFromWaitlist`. The
 * only differences are the from-status, audit action, origin, and E-id.
 */
export async function transitionToAccepted({
  ctx,
  request,
  event,
  actor,
  origin,
  promotedAuditAction,
  shareWithRequester,
  decisionReason,
  emailId,
}: {
  ctx: Awaited<ReturnType<typeof createActionContext>>;
  request: BookingRequestRow;
  event: { id: string; title: string; price_cents: number; starts_at: string };
  actor: Actor;
  origin: BookingOrigin;
  promotedAuditAction: AuditAction;
  shareWithRequester: boolean;
  decisionReason: string | null;
  emailId: "E2" | "E5";
}): Promise<AcceptRequestResult> {
  if (actor.type !== "admin") {
    throw new InvalidTransitionError(request.status, "accepted", "actor must be admin");
  }

  const decidedAt = ctx.now.toISOString();
  const completionDeadline = new Date(
    ctx.now.getTime() + ctx.settings.completion_window_hours * 60 * 60 * 1000
  );

  const token = issueCompletionToken();
  const amountCents = request.people * event.price_cents;

  const requestUpdate = await ctx.client
    .from("booking_requests")
    .update({
      status: "accepted",
      decided_at: decidedAt,
      decided_by: actor.adminId,
      decision_share_with_requester: shareWithRequester,
      decision_reason: decisionReason,
    })
    .eq("id", request.id)
    .select("*")
    .single();
  if (requestUpdate.error || !requestUpdate.data) {
    throw requestUpdate.error ?? new Error("Update booking_request failed");
  }

  const bookingInsert = await ctx.client
    .from("bookings")
    .insert({
      request_id: request.id,
      event_id: request.event_id,
      status: "awaiting_completion",
      revision: 1,
      origin,
      people: request.people,
      amount_cents: amountCents,
      currency: "EUR",
      completion_token_hash: token.storable,
      completion_token_last4: token.last4,
      completion_token_issued_at: decidedAt,
      completion_deadline_at: completionDeadline.toISOString(),
      payment_deadline_at: null,
      special_occasion: request.special_occasion,
      dietary_notes: request.dietary_notes,
    })
    .select("*")
    .single();
  if (bookingInsert.error || !bookingInsert.data) {
    throw bookingInsert.error ?? new Error("Insert booking failed");
  }

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.bookingRequest,
    entityId: request.id,
    action: promotedAuditAction,
    actorType: AUDIT_ACTORS.admin,
    actorId: actor.adminId,
    fromState: origin === "waitlist" ? "waitlisted" : "pending",
    toState: "accepted",
    reason: decisionReason ?? null,
    metadata: {
      booking_id: bookingInsert.data.id,
      share_with_requester: shareWithRequester,
    },
  });

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: bookingInsert.data.id,
    action: AUDIT_ACTIONS.bookingCreated,
    actorType: AUDIT_ACTORS.admin,
    actorId: actor.adminId,
    toState: "awaiting_completion",
    metadata: {
      origin,
      people: request.people,
      amount_cents: amountCents,
      completion_deadline_at: completionDeadline.toISOString(),
    },
  });

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: bookingInsert.data.id,
    action: AUDIT_ACTIONS.bookingCompletionLinkIssued,
    actorType: AUDIT_ACTORS.system,
    metadata: {
      completion_link_token: token.plaintext,
      completion_token_last4: token.last4,
      revision: bookingInsert.data.revision,
      origin,
    },
  });

  if (emailId === "E2") {
    await sendE2RequestAccepted({
      bookingId: bookingInsert.data.id,
      revision: bookingInsert.data.revision,
      mode: "initial",
      requesterFirstName: request.requester_first_name,
      requesterEmail: request.requester_email,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      people: request.people,
      amountCents,
      completionTokenPlaintext: token.plaintext,
    });
  } else {
    await sendE5AcceptedFromWaitlist({
      bookingId: bookingInsert.data.id,
      revision: bookingInsert.data.revision,
      mode: "initial",
      requesterFirstName: request.requester_first_name,
      requesterEmail: request.requester_email,
      eventTitle: event.title,
      eventStartsAt: event.starts_at,
      people: request.people,
      amountCents,
      completionTokenPlaintext: token.plaintext,
    });
  }

  return {
    request: requestUpdate.data,
    booking: bookingInsert.data,
    completionTokenPlaintext: token.plaintext,
  };
}
