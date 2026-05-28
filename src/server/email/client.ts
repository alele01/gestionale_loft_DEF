import "server-only";

import { Resend } from "resend";

import { requireResendApiKey } from "@/server/env";

let cachedClient: Resend | null = null;

/**
 * Singleton Resend client. Server-only. Throws if RESEND_API_KEY is missing.
 *
 * Never import this from middleware (Edge runtime) — use the dedicated
 * senders from `src/server/email/senders/*` from Node-only contexts (Server
 * Actions, Route Handlers).
 */
export function getResendClient(): Resend {
  if (cachedClient) return cachedClient;
  cachedClient = new Resend(requireResendApiKey());
  return cachedClient;
}
