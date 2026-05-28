import "server-only";

import { AUDIT_ACTIONS } from "@/server/audit-actions";

import { assertCapacityAvailable } from "../capacity";
import { createActionContext } from "../context";
import { InvalidTransitionError, NotFoundError } from "../errors";
import type { Actor } from "../types";

import {
  transitionToAccepted,
  type AcceptRequestResult,
} from "./accept-request";

export type AcceptFromWaitlistInput = {
  requestId: string;
  actor: Actor;
  decisionShareWithRequester?: boolean;
  decisionReason?: string | null;
};

/**
 * Waitlisted → accepted (+ booking creation, origin='waitlist').
 *
 * Side-effects: E5 "Accepted from waitlist + completion link".
 */
export async function acceptFromWaitlist(
  input: AcceptFromWaitlistInput
): Promise<AcceptRequestResult> {
  if (input.actor.type !== "admin") {
    throw new InvalidTransitionError(
      "waitlisted",
      "accepted",
      "actor must be admin"
    );
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

  if (request.status !== "waitlisted") {
    throw new InvalidTransitionError(request.status, "accepted");
  }

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
    origin: "waitlist",
    promotedAuditAction: AUDIT_ACTIONS.requestPromotedFromWaitlist,
    shareWithRequester: input.decisionShareWithRequester ?? false,
    decisionReason: input.decisionReason ?? null,
    emailId: "E5",
  });
}
