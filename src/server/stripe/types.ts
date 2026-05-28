import "server-only";

import type Stripe from "stripe";

/**
 * Input for `createCheckoutSession`. The caller is responsible for having
 * already loaded the booking, its event, and the requester profile in a
 * single consistent snapshot — we do not refetch inside the helper.
 */
export type CreateCheckoutSessionInput = {
  booking: {
    id: string;
    revision: number;
    people: number;
    /** Gross amount in cents = event.price_cents * people. */
    amountCents: number;
    /** ISO timestamp used to derive Stripe `expires_at`. */
    paymentDeadlineAt: string;
  };
  event: {
    id: string;
    title: string;
    /** Per-person gross price (IVA inclusa) in cents. */
    pricePerPersonCents: number;
  };
  requester: {
    email: string;
    fullName: string;
  };
};

export type CreateCheckoutSessionResult = {
  sessionId: string;
  sessionUrl: string;
  expiresAt: number;
};

/**
 * Result of `retrieveCheckoutSession`. Mirrors a subset of the Stripe object
 * to avoid leaking the full payload into our application layer.
 */
export type RetrievedCheckoutSession = {
  raw: Stripe.Checkout.Session;
  isUsable: boolean;
};
