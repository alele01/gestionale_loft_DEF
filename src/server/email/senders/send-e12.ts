import "server-only";

import * as React from "react";

import { sendEmail } from "../send";
import { E12BookingVoided } from "../templates/e12-booking-voided";
import type { EmailSendResult } from "../types";

export type SendE12Input = {
  bookingId: string;
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
};

/**
 * Send E12 (booking voided before payment).
 *
 * Trigger: admin deletes a prenotazione whose booking is still in
 * awaiting_completion or awaiting_payment. One email per booking
 * (idempotency: `booking_voided_notify:{bookingId}`).
 */
export async function sendE12BookingVoided(
  input: SendE12Input
): Promise<EmailSendResult> {
  return sendEmail({
    idempotencyKey: `booking_voided_notify:${input.bookingId}`,
    emailId: "E12",
    entity: { type: "booking", id: input.bookingId },
    to: input.requesterEmail,
    subject: `Aggiornamento sulla tua prenotazione — ${input.eventTitle}`,
    react: React.createElement(E12BookingVoided, {
      requesterFirstName: input.requesterFirstName,
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      people: input.people,
    }),
    headers: {
      "X-Cooker-Booking-Id": input.bookingId,
    },
  });
}
