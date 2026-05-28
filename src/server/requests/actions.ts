"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  acceptFromWaitlist,
  acceptRequest,
  BookingStateError,
  deletePrenotazione,
  editPendingRequest,
  rejectRequest,
  waitlistRequest,
} from "@/modules/booking-state";
import {
  AdminInputError,
  adminSchemas,
  parseAdminInput,
} from "@/server/admin/validate-input";
import { requireAdmin } from "@/server/auth/require-admin";

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
  console.error("[requests.actions]", err);
  return { status: "error", message: "Errore inatteso" };
}

function revalidatePrenotazione(requestId: string) {
  revalidatePath(`/admin/prenotazioni/${requestId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/events");
}

const DecisionInputSchema = z.object({
  requestId: adminSchemas.uuid,
  shareWithRequester: z.boolean().optional(),
  reason: adminSchemas.optionalReason,
});

const RejectInputSchema = z.object({
  requestId: adminSchemas.uuid,
  reason: adminSchemas.optionalReason,
  shareWithRequester: z.boolean().optional(),
});

const WaitlistInputSchema = z.object({
  requestId: adminSchemas.uuid,
  reason: adminSchemas.optionalReason,
});

const EditPendingRequestInputSchema = z.object({
  requestId: adminSchemas.uuid,
  people: z.number().int().min(1).max(100).optional(),
  dietaryNotes: adminSchemas.nullableTrimmedString(2000),
  specialOccasion: adminSchemas.nullableTrimmedString(500),
  notes: adminSchemas.nullableTrimmedString(2000),
});

const DeletePrenotazioneInputSchema = z.object({
  requestId: adminSchemas.uuid,
  reason: z.string().trim().min(1).max(2000),
});

export async function acceptRequestAction(input: {
  requestId: string;
  shareWithRequester?: boolean;
  reason?: string | null;
}): Promise<ActionResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(DecisionInputSchema, input);
    await acceptRequest({
      requestId: validated.requestId,
      actor: { type: "admin", adminId: identity.adminUser.id, email: identity.adminUser.email },
      decisionShareWithRequester: validated.shareWithRequester,
      decisionReason: validated.reason ?? null,
    });
    revalidatePrenotazione(validated.requestId);
    return { status: "ok" };
  } catch (err) {
    return asError(err);
  }
}

export async function acceptFromWaitlistAction(input: {
  requestId: string;
  shareWithRequester?: boolean;
  reason?: string | null;
}): Promise<ActionResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(DecisionInputSchema, input);
    await acceptFromWaitlist({
      requestId: validated.requestId,
      actor: { type: "admin", adminId: identity.adminUser.id, email: identity.adminUser.email },
      decisionShareWithRequester: validated.shareWithRequester,
      decisionReason: validated.reason ?? null,
    });
    revalidatePrenotazione(validated.requestId);
    return { status: "ok" };
  } catch (err) {
    return asError(err);
  }
}

export async function rejectRequestAction(input: {
  requestId: string;
  reason?: string | null;
  shareWithRequester?: boolean;
}): Promise<ActionResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(RejectInputSchema, input);
    await rejectRequest({
      requestId: validated.requestId,
      actor: { type: "admin", adminId: identity.adminUser.id, email: identity.adminUser.email },
      reason: validated.reason ?? null,
      shareWithRequester: validated.shareWithRequester ?? false,
    });
    revalidatePrenotazione(validated.requestId);
    return { status: "ok" };
  } catch (err) {
    return asError(err);
  }
}

export async function waitlistRequestAction(input: {
  requestId: string;
  reason?: string | null;
}): Promise<ActionResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(WaitlistInputSchema, input);
    await waitlistRequest({
      requestId: validated.requestId,
      actor: { type: "admin", adminId: identity.adminUser.id, email: identity.adminUser.email },
      reason: validated.reason ?? null,
    });
    revalidatePrenotazione(validated.requestId);
    return { status: "ok" };
  } catch (err) {
    return asError(err);
  }
}

export async function editPendingRequestAction(input: {
  requestId: string;
  people?: number;
  dietaryNotes?: string | null;
  specialOccasion?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(EditPendingRequestInputSchema, input);
    await editPendingRequest({
      requestId: validated.requestId,
      actor: { type: "admin", adminId: identity.adminUser.id, email: identity.adminUser.email },
      patch: {
        people: validated.people,
        dietaryNotes: validated.dietaryNotes,
        specialOccasion: validated.specialOccasion,
        notes: validated.notes,
      },
    });
    revalidatePrenotazione(validated.requestId);
    return { status: "ok" };
  } catch (err) {
    return asError(err);
  }
}

export async function deletePrenotazioneAction(input: {
  requestId: string;
  reason: string;
}): Promise<ActionResult> {
  const identity = await requireAdmin();
  try {
    const validated = parseAdminInput(DeletePrenotazioneInputSchema, input);
    await deletePrenotazione({
      requestId: validated.requestId,
      actor: { type: "admin", adminId: identity.adminUser.id, email: identity.adminUser.email },
      reason: validated.reason,
    });
    revalidatePrenotazione(validated.requestId);
    return { status: "ok" };
  } catch (err) {
    return asError(err);
  }
}
