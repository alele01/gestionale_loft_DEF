import "server-only";

import * as React from "react";

import { serverEnv } from "@/server/env";

import { buildCompletionUrl } from "../format";
import { sendEmail } from "../send";
import { E2RequestAccepted } from "../templates/e2-request-accepted";
import type { AcceptanceMode, EmailSendResult } from "../types";

export type SendE2Input = {
  bookingId: string;
  revision: number;
  mode: AcceptanceMode;
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountCents: number;
  completionTokenPlaintext: string;
  /**
   * When set, overrides the default `req_accepted:{bookingId}:rev{n}` key.
   * Used by the admin "Re-invia email" action, which forces a new send by
   * passing a timestamped key.
   */
  idempotencyKeyOverride?: string;
};

/**
 * Send E2 (Request accepted + completion link) for bookings with
 * origin='direct'. The plaintext token only ever appears in this email; the
 * DB stores sha256(token) only.
 */
export async function sendE2RequestAccepted(
  input: SendE2Input
): Promise<EmailSendResult> {
  const idempotencyKey =
    input.idempotencyKeyOverride ??
    `req_accepted:${input.bookingId}:rev${input.revision}`;
  const completionUrl = buildCompletionUrl(
    serverEnv.APP_BASE_URL,
    input.completionTokenPlaintext
  );
  const subject =
    input.mode === "amendment"
      ? `Prenotazione aggiornata — completa nuovamente per ${input.eventTitle}`
      : `Richiesta accettata — completa la prenotazione per ${input.eventTitle}`;
  return sendEmail({
    idempotencyKey,
    emailId: "E2",
    entity: { type: "booking", id: input.bookingId },
    to: input.requesterEmail,
    subject,
    react: React.createElement(E2RequestAccepted, {
      mode: input.mode,
      requesterFirstName: input.requesterFirstName,
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      people: input.people,
      amountCents: input.amountCents,
      completionUrl,
    }),
    headers: {
      "X-Cooker-Booking-Id": input.bookingId,
    },
  });
}
