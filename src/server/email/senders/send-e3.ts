import "server-only";

import * as React from "react";

import { sendEmail } from "../send";
import { E3RequestRejected } from "../templates/e3-request-rejected";
import type { EmailSendResult } from "../types";

export type SendE3Input = {
  requestId: string;
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
};

/**
 * Send E3 (Request rejected) to the requester. Body is fixed and neutral;
 * the admin's internal note is NEVER included.
 */
export async function sendE3RequestRejected(
  input: SendE3Input
): Promise<EmailSendResult> {
  return sendEmail({
    idempotencyKey: `req_rejected:${input.requestId}`,
    emailId: "E3",
    entity: { type: "booking_request", id: input.requestId },
    to: input.requesterEmail,
    subject: `Aggiornamento sulla tua richiesta — ${input.eventTitle}`,
    react: React.createElement(E3RequestRejected, {
      requesterFirstName: input.requesterFirstName,
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      people: input.people,
    }),
    headers: {
      "X-Cooker-Request-Id": input.requestId,
    },
  });
}
