import "server-only";

import * as React from "react";

import { sendEmail } from "../send";
import { E4RequestWaitlisted } from "../templates/e4-request-waitlisted";
import type { EmailSendResult } from "../types";

export type SendE4Input = {
  requestId: string;
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
};

/**
 * Send E4 (Request waitlisted) to the requester. No payment link, no token.
 */
export async function sendE4RequestWaitlisted(
  input: SendE4Input
): Promise<EmailSendResult> {
  return sendEmail({
    idempotencyKey: `req_waitlisted:${input.requestId}`,
    emailId: "E4",
    entity: { type: "booking_request", id: input.requestId },
    to: input.requesterEmail,
    subject: `Sei in lista d'attesa per ${input.eventTitle}`,
    react: React.createElement(E4RequestWaitlisted, {
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
