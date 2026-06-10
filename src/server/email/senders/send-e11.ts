import "server-only";

import * as React from "react";

import { sendEmail } from "../send";
import { E11PaymentReminder } from "../templates/e11-payment-reminder";
import type { EmailSendResult } from "../types";

export type SendE11Input = {
  bookingId: string;
  mode: "complete" | "pay";
  /** Absolute URL the CTA points to (completion form or payment page). */
  ctaUrl: string;
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountCents: number;
};

/**
 * Rome calendar day (YYYY-MM-DD) used as the daily idempotency anchor.
 * `en-CA` yields the ISO date layout directly.
 */
function romeDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Send E11 (Payment reminder).
 *
 * Trigger: admin bulk action on the event detail page. Idempotency key is
 * `payment_reminder:{bookingId}:{YYYY-MM-DD}` (Rome day): the email_log
 * dedup in `sendEmail` guarantees at most ONE reminder per booking per
 * calendar day, even if the admin clicks the button multiple times.
 */
export async function sendE11PaymentReminder(
  input: SendE11Input
): Promise<EmailSendResult> {
  const idempotencyKey = `payment_reminder:${input.bookingId}:${romeDay(new Date())}`;
  return sendEmail({
    idempotencyKey,
    emailId: "E11",
    entity: { type: "booking", id: input.bookingId },
    to: input.requesterEmail,
    subject: `Promemoria: completa la tua prenotazione per ${input.eventTitle}`,
    react: React.createElement(E11PaymentReminder, {
      requesterFirstName: input.requesterFirstName,
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      people: input.people,
      amountCents: input.amountCents,
      mode: input.mode,
      ctaUrl: input.ctaUrl,
    }),
    headers: {
      "X-Cooker-Booking-Id": input.bookingId,
    },
  });
}
