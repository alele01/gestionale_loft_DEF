import "server-only";

import Stripe from "stripe";

import { requireStripeSecretKey } from "@/server/env";

/**
 * Singleton Stripe SDK client.
 *
 * - The API version is pinned to the one the SDK itself is type-locked
 *   against. TypeScript will refuse the constructor call if this string
 *   does not match `LatestApiVersion` exactly, so bumping `stripe` to a
 *   newer major surfaces here as a build error.
 *   We do NOT expose the version via env: passing an older value would
 *   silently lose type safety on response objects (line items, intents).
 * - `appInfo` is forwarded to Stripe support tooling so that any issue
 *   we open can be traced back to this codebase.
 */
let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cached) return cached;
  cached = new Stripe(requireStripeSecretKey(), {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: {
      name: "cooker-loft-v1",
      version: "0.1.0",
    },
    maxNetworkRetries: 2,
  });
  return cached;
}
