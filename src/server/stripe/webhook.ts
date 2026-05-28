import "server-only";

import type Stripe from "stripe";

import { requireStripeWebhookSecret } from "@/server/env";

import { getStripeClient } from "./client";

/**
 * Tolerance window for the `Stripe-Signature` timestamp check, in seconds.
 * Stripe's default is 300s (5min). We enforce the same value explicitly so
 * the policy is auditable in this file.
 *
 * Combined with the UNIQUE constraint on `payments.stripe_event_id` this
 * neutralizes replay attacks (see docs/SECURITY.md §5.4).
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type VerifyResult =
  | { ok: true; event: Stripe.Event }
  | { ok: false; status: 400; reason: string };

/**
 * Verify the inbound Stripe webhook request. NEVER pass a JSON-parsed body —
 * `stripe.webhooks.constructEvent` requires the *raw* body to recompute the
 * HMAC signature. The route handler must call `await req.text()` and forward
 * the exact string here, with the value of the `stripe-signature` header.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null
): VerifyResult {
  if (!signatureHeader) {
    return { ok: false, status: 400, reason: "missing_signature_header" };
  }
  // Materialise both secrets up-front. If the deployment is misconfigured
  // (no STRIPE_SECRET_KEY or no STRIPE_WEBHOOK_SECRET) we DO NOT want to
  // leak that detail in the response body — it would tell an attacker
  // exactly which knob to probe. We log the underlying cause and return
  // a generic `verify_failed` instead.
  let stripe;
  let webhookSecret: string;
  try {
    stripe = getStripeClient();
    webhookSecret = requireStripeWebhookSecret();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[stripe/webhook] misconfigured", {
      reason: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 400, reason: "verify_failed" };
  }
  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      webhookSecret,
      WEBHOOK_TOLERANCE_SECONDS
    );
    return { ok: true, event };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "verify_failed";
    return { ok: false, status: 400, reason };
  }
}
