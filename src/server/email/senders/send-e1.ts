import "server-only";

import * as React from "react";

import { sendEmail } from "../send";
import { E1RequestReceived } from "../templates/e1-request-received";
import type { EmailSendResult } from "../types";

export type SendE1Input = {
  requestId: string;
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
};

/**
 * Send E1 (Request received) to the requester. Optional template: callers
 * MUST check `app_settings.requester_receipt_email_enabled` before invoking.
 */
export async function sendE1RequestReceived(
  input: SendE1Input
): Promise<EmailSendResult> {
  return sendEmail({
    idempotencyKey: `req_received:${input.requestId}`,
    emailId: "E1",
    entity: { type: "booking_request", id: input.requestId },
    to: input.requesterEmail,
    subject: `Abbiamo ricevuto la tua richiesta — ${input.eventTitle}`,
    react: React.createElement(E1RequestReceived, {
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
