import "server-only";

import * as React from "react";

import { sendEmail } from "../send";
import { E9ReviewRequest } from "../templates/e9-review-request";
import type { EmailSendResult } from "../types";

export type SendE9Input = {
  bookingId: string;
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  reviewUrl: string;
};

/**
 * Send E9 (Google review request) to the representative. Cron-triggered;
 * idempotency key `review_request:{bookingId}` keeps it one-shot per
 * booking.
 */
export async function sendE9ReviewRequest(
  input: SendE9Input
): Promise<EmailSendResult> {
  return sendEmail({
    idempotencyKey: `review_request:${input.bookingId}`,
    emailId: "E9",
    entity: { type: "booking", id: input.bookingId },
    to: input.requesterEmail,
    subject: "Grazie, dal team di COOKER LOFT ❤️",
    react: React.createElement(E9ReviewRequest, {
      requesterFirstName: input.requesterFirstName,
      eventTitle: input.eventTitle,
      reviewUrl: input.reviewUrl,
    }),
    headers: {
      "X-Cooker-Booking-Id": input.bookingId,
    },
  });
}
