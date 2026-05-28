import "server-only";

import { z } from "zod";

/**
 * Server-only environment variables for Cooker Loft V1.
 *
 * This module is the single source of truth for any secret or server-side
 * configuration used by route handlers, server actions, and scripts.
 *
 * Hard rules (see docs/SECURITY.md §8):
 *  - No secret variable carries the NEXT_PUBLIC_ prefix.
 *  - This file is marked `server-only`; importing it from a client component
 *    or a client module will fail the Next.js build.
 *  - The schema below is intentionally strict: a missing or empty required
 *    variable aborts the process at startup with a readable error.
 *
 * Phase 0 / Phase 1 keep the surface narrow: Supabase + app base URL + the
 * accountant fallback. Phase 4 (Resend) and Phase 5 (Stripe) extended this
 * file with the relevant entries.
 */

const ServerEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  /**
   * Optional at the central validator level so that runtimes which never
   * touch the privileged client (e.g. Next.js Edge middleware) can boot
   * without the secret being visible. The actual non-empty assertion is
   * enforced lazily by `requireServiceRoleKey()` below.
   */
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  APP_BASE_URL: z.string().url(),
  ACCOUNTANT_FALLBACK_EMAIL: z
    .string()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Contact email surfaced on the completion page when the representative
   * needs to correct read-only data. See docs/COMPLETION_PAGE_REFERENCE.md.
   * Falls back to ACCOUNTANT_FALLBACK_EMAIL, then to a static placeholder.
   */
  VENUE_CONTACT_EMAIL: z
    .string()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Resend API key (Bearer credential). Required to send transactional email.
   * Optional at central validator so middleware / Edge runtimes do not fail
   * when the secret is unavailable; the actual non-empty assertion is done
   * lazily by `requireResendApiKey()` below.
   */
  RESEND_API_KEY: z
    .string()
    .min(10)
    .regex(/^re_/u, "RESEND_API_KEY must start with 're_'")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * From header used on every outbound email. Format:
   *   `Cooker Loft <noreply@mail.cookerloft.example>`
   * The bare domain must be a Resend-verified sender (DKIM/SPF/DMARC OK).
   */
  RESEND_FROM_EMAIL: z
    .string()
    .min(5)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Optional Reply-To address. Falls back to VENUE_CONTACT_EMAIL when empty.
   */
  RESEND_REPLY_TO_EMAIL: z
    .string()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Shared secret enforced by `app/api/cron/review/route.ts`. Vercel Cron
   * sends `Authorization: Bearer ${CRON_SECRET}` automatically when this
   * value is configured in the Vercel project settings.
   */
  CRON_SECRET: z
    .string()
    .min(16)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Stripe secret key. Format: `sk_test_...` in sandbox, `sk_live_...` in
   * production. Required to create Checkout sessions and to verify webhook
   * signatures. Optional at central validator so middleware / Edge runtimes
   * can boot without it; asserted lazily by `requireStripeSecretKey()`.
   */
  STRIPE_SECRET_KEY: z
    .string()
    .min(10)
    .regex(/^sk_/u, "STRIPE_SECRET_KEY must start with 'sk_'")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Stripe webhook signing secret. Format: `whsec_...`. In local dev this is
   * the ephemeral secret printed by `stripe listen`; in production it is the
   * permanent secret of the registered webhook endpoint.
   */
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(10)
    .regex(/^whsec_/u, "STRIPE_WEBHOOK_SECRET must start with 'whsec_'")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cachedEnv: ServerEnv | null = null;

function loadServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = ServerEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_BASE_URL: process.env.APP_BASE_URL,
    ACCOUNTANT_FALLBACK_EMAIL: process.env.ACCOUNTANT_FALLBACK_EMAIL,
    VENUE_CONTACT_EMAIL: process.env.VENUE_CONTACT_EMAIL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_REPLY_TO_EMAIL: process.env.RESEND_REPLY_TO_EMAIL,
    CRON_SECRET: process.env.CRON_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment. Check .env.local against .env.example.\n${formatted}`
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/**
 * Lazily-validated server environment. Throws on first access if invalid.
 *
 * Use a getter rather than evaluating at module load so that scripts importing
 * downstream modules can still be type-checked / linted without a populated
 * .env.local.
 */
export const serverEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: keyof ServerEnv) {
    return loadServerEnv()[prop];
  },
});

/**
 * Returns `SUPABASE_SERVICE_ROLE_KEY` asserting it is configured. Use this
 * from the privileged Supabase client only — never from Edge runtime.
 */
export function requireServiceRoleKey(): string {
  const env = loadServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for privileged Supabase access. " +
        "Set it in .env.local (see .env.example)."
    );
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Resolve the contact email shown on the completion page when the
 * representative needs to correct read-only data. Order:
 *  1. VENUE_CONTACT_EMAIL
 *  2. ACCOUNTANT_FALLBACK_EMAIL (so at least someone is reachable)
 *  3. Static `team@example.invalid` (logged once to console)
 */
let warnedVenueFallback = false;
export function getVenueContactEmail(): string {
  const env = loadServerEnv();
  if (env.VENUE_CONTACT_EMAIL) return env.VENUE_CONTACT_EMAIL;
  if (env.ACCOUNTANT_FALLBACK_EMAIL) return env.ACCOUNTANT_FALLBACK_EMAIL;
  if (!warnedVenueFallback) {
    warnedVenueFallback = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[env] No VENUE_CONTACT_EMAIL or ACCOUNTANT_FALLBACK_EMAIL set; falling back to team@example.invalid."
    );
  }
  return "team@example.invalid";
}

/**
 * Returns the Resend API key asserting it is configured. Use this from
 * server-only Resend sender code; never from middleware / Edge.
 */
export function requireResendApiKey(): string {
  const env = loadServerEnv();
  if (!env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is required to send transactional email. " +
        "Set it in .env.local (see .env.example)."
    );
  }
  return env.RESEND_API_KEY;
}

/**
 * Returns the RESEND_FROM_EMAIL header, asserted non-empty. Format:
 *   "Cooker Loft <noreply@mail.example.com>"
 */
export function requireResendFromEmail(): string {
  const env = loadServerEnv();
  if (!env.RESEND_FROM_EMAIL) {
    throw new Error(
      "RESEND_FROM_EMAIL is required to send transactional email. " +
        "Set it in .env.local (see .env.example)."
    );
  }
  return env.RESEND_FROM_EMAIL;
}

/**
 * Reply-To header for outbound emails. Falls back to the venue contact when
 * RESEND_REPLY_TO_EMAIL is not configured.
 */
export function getResendReplyToEmail(): string {
  const env = loadServerEnv();
  return env.RESEND_REPLY_TO_EMAIL ?? getVenueContactEmail();
}

/**
 * Returns the cron shared secret asserting it is configured. Used by
 * `app/api/cron/review/route.ts` to authenticate Vercel Cron requests.
 * In development we accept a missing secret only when NODE_ENV !== 'production'.
 */
export function requireCronSecret(): string {
  const env = loadServerEnv();
  if (!env.CRON_SECRET) {
    throw new Error(
      "CRON_SECRET is required to authenticate cron requests in production."
    );
  }
  return env.CRON_SECRET;
}

export function getCronSecret(): string | undefined {
  const env = loadServerEnv();
  return env.CRON_SECRET;
}

/**
 * Returns the Stripe secret key asserting it is configured. Use this from
 * server-only Stripe code (Checkout session creation, webhook verification);
 * never from middleware / Edge / client code.
 */
export function requireStripeSecretKey(): string {
  const env = loadServerEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is required to create Stripe Checkout sessions. " +
        "Set it in .env.local (see .env.example). Use sk_test_... in sandbox."
    );
  }
  return env.STRIPE_SECRET_KEY;
}

/**
 * Returns the Stripe webhook signing secret asserting it is configured.
 * Used by `app/api/stripe/webhook/route.ts` to verify Stripe-Signature.
 */
export function requireStripeWebhookSecret(): string {
  const env = loadServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required to verify Stripe webhook signatures. " +
        "In local dev, grab it from `stripe listen --forward-to localhost:3000/api/stripe/webhook`."
    );
  }
  return env.STRIPE_WEBHOOK_SECRET;
}
