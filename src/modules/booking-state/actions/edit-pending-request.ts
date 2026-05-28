import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import type { TablesUpdate } from "@/server/supabase";

import { createActionContext } from "../context";
import { InvalidTransitionError, NotFoundError, ValidationError } from "../errors";
import type { Actor, BookingRequestRow } from "../types";

export type EditPendingRequestInput = {
  requestId: string;
  actor: Actor;
  patch: {
    people?: number;
    dietaryNotes?: string | null;
    specialOccasion?: string | null;
    notes?: string | null;
    requesterFirstName?: string;
    requesterLastName?: string;
    requesterPhone?: string;
  };
};

export type EditPendingRequestResult = {
  request: BookingRequestRow;
};

/**
 * Admin-only edit of a still-pending request before any decision (accept /
 * reject / waitlist). Once decided, the immutable booking carries the
 * canonical values and edits go through `editBookingPrePayment`.
 */
export async function editPendingRequest(
  input: EditPendingRequestInput
): Promise<EditPendingRequestResult> {
  if (input.actor.type !== "admin") {
    throw new InvalidTransitionError("pending", "pending", "actor must be admin");
  }
  if (input.patch.people !== undefined && input.patch.people <= 0) {
    throw new ValidationError("Numero ospiti non valido");
  }

  const ctx = await createActionContext();

  const existingRes = await ctx.client
    .from("booking_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  if (existingRes.error) throw existingRes.error;
  if (!existingRes.data) throw new NotFoundError("Richiesta");

  const existing = existingRes.data;
  if (existing.status !== "pending") {
    throw new InvalidTransitionError(
      existing.status,
      existing.status,
      "solo le richieste pending sono modificabili"
    );
  }

  const updates: TablesUpdate<"booking_requests"> = {};
  const before: Record<string, unknown> = {};
  if (input.patch.people !== undefined && input.patch.people !== existing.people) {
    updates.people = input.patch.people;
    before.people = existing.people;
  }
  if (
    input.patch.dietaryNotes !== undefined &&
    (input.patch.dietaryNotes ?? null) !== existing.dietary_notes
  ) {
    updates.dietary_notes = input.patch.dietaryNotes ?? null;
    before.dietary_notes = existing.dietary_notes;
  }
  if (
    input.patch.specialOccasion !== undefined &&
    (input.patch.specialOccasion ?? null) !== existing.special_occasion
  ) {
    updates.special_occasion = input.patch.specialOccasion ?? null;
    before.special_occasion = existing.special_occasion;
  }
  if (
    input.patch.notes !== undefined &&
    (input.patch.notes ?? null) !== existing.notes
  ) {
    updates.notes = input.patch.notes ?? null;
    before.notes = existing.notes;
  }
  if (
    input.patch.requesterFirstName !== undefined &&
    input.patch.requesterFirstName !== existing.requester_first_name
  ) {
    updates.requester_first_name = input.patch.requesterFirstName;
    before.requester_first_name = existing.requester_first_name;
  }
  if (
    input.patch.requesterLastName !== undefined &&
    input.patch.requesterLastName !== existing.requester_last_name
  ) {
    updates.requester_last_name = input.patch.requesterLastName;
    before.requester_last_name = existing.requester_last_name;
  }
  if (
    input.patch.requesterPhone !== undefined &&
    input.patch.requesterPhone !== existing.requester_phone
  ) {
    updates.requester_phone = input.patch.requesterPhone;
    before.requester_phone = existing.requester_phone;
  }

  if (Object.keys(updates).length === 0) {
    return { request: existing };
  }

  const { data, error } = await ctx.client
    .from("booking_requests")
    .update(updates)
    .eq("id", input.requestId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Update booking_request failed");

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.bookingRequest,
    entityId: data.id,
    action: AUDIT_ACTIONS.requestEditedPending,
    actorType: AUDIT_ACTORS.admin,
    actorId: input.actor.adminId,
    metadata: { before, after: updates },
  });

  return { request: data };
}
