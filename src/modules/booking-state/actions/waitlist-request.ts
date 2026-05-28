import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import { sendE4RequestWaitlisted } from "@/server/email";

import { createActionContext } from "../context";
import { InvalidTransitionError, NotFoundError } from "../errors";
import type { Actor, BookingRequestRow } from "../types";

export type WaitlistRequestInput = {
  requestId: string;
  actor: Actor;
  reason?: string | null;
};

export type WaitlistRequestResult = {
  request: BookingRequestRow;
};

/**
 * Pending → waitlisted. Side-effect: E4 "Request waitlisted".
 */
export async function waitlistRequest(
  input: WaitlistRequestInput
): Promise<WaitlistRequestResult> {
  if (input.actor.type !== "admin") {
    throw new InvalidTransitionError("pending", "waitlisted", "actor must be admin");
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
  if (request.status !== "pending") {
    throw new InvalidTransitionError(request.status, "waitlisted");
  }

  const decidedAt = ctx.now.toISOString();
  const update = await ctx.client
    .from("booking_requests")
    .update({
      status: "waitlisted",
      decided_at: decidedAt,
      decided_by: input.actor.adminId,
      decision_reason: input.reason ?? null,
    })
    .eq("id", request.id)
    .select("*")
    .single();
  if (update.error || !update.data) throw update.error ?? new Error("Update failed");

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.bookingRequest,
    entityId: request.id,
    action: AUDIT_ACTIONS.requestWaitlisted,
    actorType: AUDIT_ACTORS.admin,
    actorId: input.actor.adminId,
    fromState: "pending",
    toState: "waitlisted",
    reason: input.reason ?? null,
  });

  if (request.events) {
    await sendE4RequestWaitlisted({
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
