import "server-only";

import * as React from "react";

import { serverEnv } from "@/server/env";

import { buildPaymentRetryUrl } from "../format";
import { sendEmail } from "../send";
import { E7PaymentRetry } from "../templates/e7-payment-retry";
import type { EmailSendResult } from "../types";

export type SendE7Input = {
  bookingId: string;
  /**
   * Stripe Checkout Session id that just expired or whose payment intent
   * failed. Used as part of the idempotency key so that multiple declines
   * within the SAME session do not produce multiple emails (Stripe lets
   * the user retry inline), while a brand-new session after recreate
   * triggers a fresh retry mail when it too fails.
   */
  stripeSessionId: string;
  reason: "session_expired" | "payment_failed";
  requesterFirstName: string;
  requesterEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountCents: number;
  /**
   * Override the default idempotency anchor. Used by the admin "re-send
   * payment link" action: a timestamped key produces a fresh email_log
   * row each time, instead of deduplicating against the session-anchored
   * key the webhook uses.
   */
  idempotencyKeyOverride?: string;
};

/**
 * Send E7 (Payment retry).
 *
 * Trigger: Stripe webhook handler, in the branches that observe a payment
 * attempt going wrong (`checkout.session.expired`,
 * `payment_intent.payment_failed`). Sender-level idempotency anchor is
 * `payment_retry:{bookingId}:{stripeSessionId}` — see template doc for
 * rationale.
 */
export async function sendE7PaymentRetry(
  input: SendE7Input
): Promise<EmailSendResult> {
  const idempotencyKey =
    input.idempotencyKeyOverride ??
    `payment_retry:${input.bookingId}:${input.stripeSessionId}`;
  const payRetryUrl = buildPaymentRetryUrl(
    serverEnv.APP_BASE_URL,
    input.bookingId
  );
  const subject =
    input.reason === "session_expired"
      ? `Pagamento non concluso — riprendi per ${input.eventTitle}`
      : `Pagamento non riuscito — riprova per ${input.eventTitle}`;
  return sendEmail({
    idempotencyKey,
    emailId: "E7",
    entity: { type: "booking", id: input.bookingId },
    to: input.requesterEmail,
    subject,
    react: React.createElement(E7PaymentRetry, {
      requesterFirstName: input.requesterFirstName,
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      people: input.people,
      amountCents: input.amountCents,
      reason: input.reason,
      payRetryUrl,
    }),
    headers: {
      "X-Cooker-Booking-Id": input.bookingId,
    },
  });
}
