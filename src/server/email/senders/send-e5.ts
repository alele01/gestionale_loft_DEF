import "server-only";

import * as React from "react";

import { serverEnv } from "@/server/env";

import { buildCompletionUrl } from "../format";
import { sendEmail } from "../send";
import { E5AcceptedFromWaitlist } from "../templates/e5-accepted-from-waitlist";
import type { AcceptanceMode, EmailSendResult } from "../types";

export type SendE5Input = {
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
  idempotencyKeyOverride?: string;
};

/**
 * Send E5 (Accepted from waitlist + completion link) for bookings with
 * origin='waitlist'. Same security properties as E2.
 */
export async function sendE5AcceptedFromWaitlist(
  input: SendE5Input
): Promise<EmailSendResult> {
  const idempotencyKey =
    input.idempotencyKeyOverride ??
    `req_accepted_from_waitlist:${input.bookingId}:rev${input.revision}`;
  const completionUrl = buildCompletionUrl(
    serverEnv.APP_BASE_URL,
    input.completionTokenPlaintext
  );
  const subject =
    input.mode === "amendment"
      ? `Prenotazione aggiornata — completa nuovamente per ${input.eventTitle}`
      : `Buone notizie: posto disponibile per ${input.eventTitle} — completa la prenotazione`;
  return sendEmail({
    idempotencyKey,
    emailId: "E5",
    entity: { type: "booking", id: input.bookingId },
    to: input.requesterEmail,
    subject,
    react: React.createElement(E5AcceptedFromWaitlist, {
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
