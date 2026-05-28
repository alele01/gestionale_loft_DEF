import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import {
  sendE1RequestReceived,
  sendE8AdminNewRequest,
} from "@/server/email";

import { createActionContext } from "../context";
import { ConsentMissingError, NotFoundError, ValidationError } from "../errors";
import type { BookingRequestRow, SubmitRequestInput } from "../types";

export type SubmitRequestResult = {
  request: BookingRequestRow;
};

/**
 * Persist a public-embed submission. The CHECK constraints already enforce
 * the consent triplet at the DB level; we re-check in code so we can return
 * a domain error instead of a Postgres exception string.
 *
 * Side-effects (real Resend sends, see docs/EMAILS.md):
 *   - E1 "Request received" → requester (only when
 *     `app_settings.requester_receipt_email_enabled = true`).
 *   - E8 "Admin internal notice" → every admin_users row (only when
 *     `app_settings.admin_new_request_email_enabled = true`).
 *
 * Resend failures are logged to `email_log` + `audit_log` but never roll
 * back the request insert.
 */
export async function submitBookingRequest(
  input: SubmitRequestInput
): Promise<SubmitRequestResult> {
  if (!input.requesterEmail.trim()) {
    throw new ValidationError("Email obbligatoria");
  }
  if (input.people <= 0) {
    throw new ValidationError("Numero ospiti non valido");
  }
  if (
    !input.consentTermsVersion ||
    !input.consentPrivacyVersion ||
    !input.consentHealthVersion
  ) {
    throw new ConsentMissingError();
  }

  const ctx = await createActionContext();

  const eventRes = await ctx.client
    .from("events")
    .select("id, status, capacity, title, starts_at")
    .eq("id", input.eventId)
    .maybeSingle();
  if (eventRes.error) throw eventRes.error;
  if (!eventRes.data) throw new NotFoundError("Evento");
  if (eventRes.data.status !== "published") {
    throw new ValidationError("Evento non disponibile per nuove prenotazioni");
  }
  const eventForEmail = {
    title: eventRes.data.title,
    starts_at: eventRes.data.starts_at,
  };

  const submittedAt = ctx.now.toISOString();

  const { data, error } = await ctx.client
    .from("booking_requests")
    .insert({
      event_id: input.eventId,
      requester_first_name: input.requesterFirstName.trim(),
      requester_last_name: input.requesterLastName.trim(),
      requester_email: input.requesterEmail.trim(),
      requester_phone: input.requesterPhone.trim(),
      people: input.people,
      dietary_notes: input.dietaryNotes ?? null,
      special_occasion: input.specialOccasion ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "embed",
      status: "pending",
      submitted_at: submittedAt,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      consent_terms_accepted: true,
      consent_terms_accepted_at: submittedAt,
      consent_terms_version: input.consentTermsVersion,
      consent_privacy_accepted: true,
      consent_privacy_accepted_at: submittedAt,
      consent_privacy_version: input.consentPrivacyVersion,
      consent_health_accepted: true,
      consent_health_accepted_at: submittedAt,
      consent_health_version: input.consentHealthVersion,
      consent_submitted_at: submittedAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Insert booking_request failed");
  }

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.bookingRequest,
    entityId: data.id,
    action: AUDIT_ACTIONS.requestSubmitted,
    actorType: AUDIT_ACTORS.system,
    toState: "pending",
    metadata: {
      event_id: input.eventId,
      people: input.people,
      source: input.source ?? "embed",
    },
  });

  if (ctx.settings.requester_receipt_email_enabled) {
    await sendE1RequestReceived({
      requestId: data.id,
      requesterFirstName: data.requester_first_name,
      requesterEmail: data.requester_email,
      eventTitle: eventForEmail.title,
      eventStartsAt: eventForEmail.starts_at,
      people: data.people,
    });
  }

  if (ctx.settings.admin_new_request_email_enabled) {
    const adminsRes = await ctx.client
      .from("admin_users")
      .select("id, email");
    if (adminsRes.error) {
      // eslint-disable-next-line no-console
      console.error("[E8] failed to fetch admin_users", adminsRes.error);
    } else {
      const fullName =
        `${data.requester_first_name} ${data.requester_last_name}`.trim();
      await Promise.all(
        (adminsRes.data ?? []).map((admin) =>
          sendE8AdminNewRequest({
            requestId: data.id,
            adminId: admin.id,
            adminEmail: admin.email,
            eventTitle: eventForEmail.title,
            eventStartsAt: eventForEmail.starts_at,
            people: data.people,
            requesterFullName: fullName,
            requesterEmail: data.requester_email,
          })
        )
      );
    }
  }

  return { request: data };
}
