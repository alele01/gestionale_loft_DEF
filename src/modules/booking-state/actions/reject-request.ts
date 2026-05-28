import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import { sendE3RequestRejected } from "@/server/email";

import { createActionContext } from "../context";
import { InvalidTransitionError, NotFoundError } from "../errors";
import type { Actor, BookingRequestRow } from "../types";

export type RejectRequestInput = {
  requestId: string;
  actor: Actor;
  /** Optional internal note. Never surfaced to the requester. */
  reason?: string | null;
  /**
   * Kept for API stability but ignored: the rejection email (E3) does not
   * surface the admin note to the requester. The note is internal-only.
   */
  shareWithRequester?: boolean;
};

export type RejectRequestResult = {
  request: BookingRequestRow;
};

/**
 * Pending or waitlisted → rejected.
 *
 * Side-effect: E3 "Request rejected" → requester (always, with a neutral
 * template; admin internal notes are NOT shared with the requester).
 */
export async function rejectRequest(
  input: RejectRequestInput
): Promise<RejectRequestResult> {
  if (input.actor.type !== "admin") {
    throw new InvalidTransitionError("pending", "rejected", "actor must be admin");
  }

  const ctx = await createActionContext();

  const requestRes = await ctx.client
    .from("booking_requests")
    .select("*, events(id, title, starts_at)")
    .eq("id", input.requestId)
    .maybeSingle();
  if (requestRes.error) throw requestRes.error;
  if (!requestRes.data) throw new NotFoundError("Richiesta");

  const request = requestRes.data;
  if (request.status !== "pending" && request.status !== "waitlisted") {
    throw new InvalidTransitionError(request.status, "rejected");
  }

  const trimmedReason = input.reason?.trim() || null;
  const decidedAt = ctx.now.toISOString();
  const update = await ctx.client
    .from("booking_requests")
    .update({
      status: "rejected",
      decided_at: decidedAt,
      decided_by: input.actor.adminId,
      decision_reason: trimmedReason,
      decision_share_with_requester: false,
    })
    .eq("id", request.id)
    .select("*")
    .single();
  if (update.error || !update.data) throw update.error ?? new Error("Update failed");

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.bookingRequest,
    entityId: request.id,
    action: AUDIT_ACTIONS.requestRejected,
    actorType: AUDIT_ACTORS.admin,
    actorId: input.actor.adminId,
    fromState: request.status,
    toState: "rejected",
    reason: trimmedReason,
    metadata: { share_with_requester: false },
  });

  if (request.events) {
    await sendE3RequestRejected({
      requestId: request.id,
      requesterFirstName: request.requester_first_name,
      requesterEmail: request.requester_email,
      eventTitle: request.events.title,
      eventStartsAt: request.events.starts_at,
      people: request.people,
    });
  }

  return { request: update.data };
}
