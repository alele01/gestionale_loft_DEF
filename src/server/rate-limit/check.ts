import "server-only";

import { headers } from "next/headers";

import { getServiceClient } from "@/server/supabase";

/**
 * Atomic, Postgres-backed fixed-window rate limiter.
 *
 * Scope and philosophy
 * --------------------
 * This is an **anti-abuse soft throttle**, NOT a DDoS shield. The real
 * DDoS protection lives at the Vercel / CDN layer (per-IP request
 * limits, regional shield, bot mitigation). What this layer adds is:
 *
 *   - Slow down obvious automated abuse (token enumeration, request
 *     spam from a single client).
 *   - Cap how much a single misbehaving caller can stress the DB.
 *
 * Every cap is intentionally GENEROUS so that legitimate traffic
 * patterns we expect during a launch — carrier-grade NAT clusters,
 * corporate proxies, hotel/school Wi-Fi sharing a single egress IP,
 * users with multiple tabs open, network retries — are NEVER blocked.
 *
 * Why Postgres and not Upstash / Vercel KV: this codebase already runs
 * on Supabase, so the existing service-role client can call
 * `check_rate_limit` without adding a new dependency, a new free-tier
 * integration, or a new secret to rotate. The implementation handles
 * the expected V1 traffic comfortably (the function is a single
 * UPSERT, indexed on bucket_key). If we ever need millions of
 * requests/minute, swap the backend; the wrapper API stays the same.
 *
 * Design notes:
 *   - One bucket per (action, identifier) pair, e.g.
 *     `embed_submit:ip:1.2.3.4` or `complete_booking:token:abc…`.
 *   - The `check_rate_limit` SQL function atomically inserts/updates
 *     the row and returns the new hit count + window start, so there
 *     is no check-then-act race even under concurrent load.
 *   - DEGRADE-OPEN: any failure mode (network blip, Postgres slow,
 *     unexpected exception) results in the request being LET THROUGH
 *     with `degraded: true`. A rate limit that breaks the entire site
 *     under DB pressure would be strictly worse than a leaky one.
 */

export type RateLimitOutcome = {
  allowed: boolean;
  hitCount: number;
  windowStartedAtIso: string;
  /** True if Postgres errored out and we fell back to allowing the request. */
  degraded: boolean;
};

export type EnforceRateLimitInput = {
  /**
   * Logical action name (e.g. `embed_submit`, `complete_booking_form`,
   * `pay_landing`, `booking_status_poll`). Used as the bucket key prefix
   * so the same identifier on a different action is tracked separately.
   */
  action: string;
  /** Stable identifier for the caller (IP, token hash, booking id, …). */
  identifier: string;
  /** Window size in seconds. Must be > 0. */
  windowSeconds: number;
  /** Maximum allowed hits inside one window. Must be > 0. */
  maxHits: number;
};

/**
 * Check the rate limit for a given action + identifier. The function
 * NEVER throws: on Postgres/network failure it falls back to allowing
 * the request and sets `degraded: true` so the caller can log it.
 */
export async function checkRateLimit(
  input: EnforceRateLimitInput
): Promise<RateLimitOutcome> {
  const bucketKey = `${input.action}:${input.identifier}`;
  const client = getServiceClient();
  try {
    const { data, error } = await client.rpc("check_rate_limit", {
      p_bucket_key: bucketKey,
      p_window_seconds: input.windowSeconds,
      p_max_hits: input.maxHits,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit] rpc error", error.message);
      return {
        allowed: true,
        hitCount: 0,
        windowStartedAtIso: new Date().toISOString(),
        degraded: true,
      };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        allowed: true,
        hitCount: 0,
        windowStartedAtIso: new Date().toISOString(),
        degraded: true,
      };
    }
    return {
      allowed: Boolean(row.allowed),
      hitCount: Number(row.hit_count),
      windowStartedAtIso: String(row.window_started_at),
      degraded: false,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[rate-limit] unexpected error", err);
    return {
      allowed: true,
      hitCount: 0,
      windowStartedAtIso: new Date().toISOString(),
      degraded: true,
    };
  }
}

/**
 * Helper for endpoints that simply want to refuse the request when the
 * limit is exceeded. Throws `RateLimitExceededError` on block; callers
 * map it to a 429 response or a non-blocking form error.
 */
export async function enforceRateLimit(
  input: EnforceRateLimitInput
): Promise<RateLimitOutcome> {
  const outcome = await checkRateLimit(input);
  if (!outcome.allowed) {
    throw new RateLimitExceededError(input.action, outcome);
  }
  return outcome;
}

export class RateLimitExceededError extends Error {
  readonly code = "RATE_LIMITED";
  readonly outcome: RateLimitOutcome;
  readonly action: string;

  constructor(action: string, outcome: RateLimitOutcome) {
    super(
      `Rate limit exceeded for action="${action}" (hit_count=${outcome.hitCount})`
    );
    this.name = "RateLimitExceededError";
    this.action = action;
    this.outcome = outcome;
  }
}

/**
 * Best-effort client IP extraction from Vercel headers. Vercel sets
 * `x-forwarded-for` to a comma-separated list with the original client
 * first; we take the first value and strip whitespace. Falls back to
 * the literal "unknown" so the bucket key still has a stable shape.
 *
 * Note: returning "unknown" means many unrelated callers can share a
 * bucket. That's intentional for V1: a misconfigured proxy is a worse
 * outcome than a few false positives on the rate limit.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
