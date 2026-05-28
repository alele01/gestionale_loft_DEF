import "server-only";

import * as React from "react";

import { sendEmail } from "../send";
import { E6PaymentConfirmation } from "../templates/e6-payment-confirmation";
import type { EmailSendResult } from "../types";

export type SendE6Input = {
  bookingId: string;
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountPaidCents: number;
  fiscalLegalName: string;
  fiscalCity: string;
};

/**
 * Send E6 (Payment confirmation).
 *
 * Trigger: Stripe webhook handler, in the same logical operation that
 * transitions the booking to `paid`. Idempotency anchor is just
 * `payment_confirmed:{bookingId}` because `paid` is terminal — there is no
 * revision after this point. The webhook handler is also idempotent on
 * `payments.stripe_event_id` (UNIQUE), so even with Stripe retries this
 * sender is invoked at most once per booking.
 */
export async function sendE6PaymentConfirmation(
  input: SendE6Input
): Promise<EmailSendResult> {
  const idempotencyKey = `payment_confirmed:${input.bookingId}`;
  const subject = `Pagamento ricevuto — ${input.eventTitle}`;
  return sendEmail({
    idempotencyKey,
    emailId: "E6",
    entity: { type: "booking", id: input.bookingId },
    to: input.requesterEmail,
    subject,
    react: React.createElement(E6PaymentConfirmation, {
      requesterFirstName: input.requesterFirstName,
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      people: input.people,
      amountPaidCents: input.amountPaidCents,
      fiscalLegalName: input.fiscalLegalName,
      fiscalCity: input.fiscalCity,
    }),
    headers: {
      "X-Cooker-Booking-Id": input.bookingId,
    },
  });
}
