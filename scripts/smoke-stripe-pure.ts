/* eslint-disable no-console */

/**
 * Pure-logic smoke test for the Stripe module.
 *
 * Mirrors the helpers exposed by `src/server/stripe/checkout.ts` and
 * asserts the same invariants — without importing the `server-only`
 * graph (which throws when loaded outside Next.js).
 *
 * What this covers:
 *  - expires_at clamping window [30min, 24h]
 *  - isSessionUsable rules
 *  - return URL builder shape
 *  - idempotency-key derivation (used by createCheckoutSession)
 *
 * What this does NOT cover (would need a Stripe key):
 *  - real Checkout Session creation / retrieve / expire
 *  - real webhook signature verification against a test secret
 */
type Check = { name: string; ok: boolean; detail?: string };
const results: Check[] = [];
const ok = (name: string, detail?: string) =>
  results.push({ name, ok: true, detail });
const fail = (name: string, detail: string) =>
  results.push({ name, ok: false, detail });

/* ---------- mirrored helpers from src/server/stripe/checkout.ts ---------- */

const MIN_EXPIRY_OFFSET_SECONDS = 30 * 60;
const MAX_EXPIRY_OFFSET_SECONDS = 24 * 60 * 60;

function computeExpiresAt(paymentDeadlineAtIso: string, nowMs: number): number {
  const nowSec = Math.floor(nowMs / 1000);
  const minExpiry = nowSec + MIN_EXPIRY_OFFSET_SECONDS;
  const maxExpiry = nowSec + MAX_EXPIRY_OFFSET_SECONDS;
  const desired = Math.floor(new Date(paymentDeadlineAtIso).getTime() / 1000);
  if (!Number.isFinite(desired) || desired <= 0) return maxExpiry;
  return Math.max(minExpiry, Math.min(maxExpiry, desired));
}

function buildReturnUrls(baseUrl: string): {
  successUrl: string;
  cancelUrl: string;
} {
  const trimmed = baseUrl.replace(/\/+$/u, "");
  return {
    successUrl: `${trimmed}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${trimmed}/payment/cancel?session_id={CHECKOUT_SESSION_ID}`,
  };
}

function isSessionUsable(session: {
  status: string;
  url: string | null;
  expires_at: number | null;
}): boolean {
  if (session.status !== "open") return false;
  if (!session.url) return false;
  if (session.expires_at) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (session.expires_at <= nowSec) return false;
  }
  return true;
}

function idempotencyKey(bookingId: string, revision: number): string {
  return `checkout:${bookingId}:rev${revision}`;
}

/* ---------- 1. expires_at clamping --------------------------------------- */

const now = new Date("2026-05-23T08:00:00Z");
const nowMs = now.getTime();
const nowSec = Math.floor(nowMs / 1000);

const cases: Array<{
  label: string;
  iso: string;
  expected: number;
}> = [
  {
    label: "<30min in the future → clamped to +30min",
    iso: new Date(nowMs + 5 * 60 * 1000).toISOString(),
    expected: nowSec + MIN_EXPIRY_OFFSET_SECONDS,
  },
  {
    label: "exactly 30min → kept as-is",
    iso: new Date(nowMs + 30 * 60 * 1000).toISOString(),
    expected: nowSec + MIN_EXPIRY_OFFSET_SECONDS,
  },
  {
    label: "6h ahead → kept as-is",
    iso: new Date(nowMs + 6 * 60 * 60 * 1000).toISOString(),
    expected: nowSec + 6 * 60 * 60,
  },
  {
    label: ">24h → clamped to +24h",
    iso: new Date(nowMs + 48 * 60 * 60 * 1000).toISOString(),
    expected: nowSec + MAX_EXPIRY_OFFSET_SECONDS,
  },
  {
    label: "deadline in the past → still clamped to +30min minimum",
    iso: new Date(nowMs - 60 * 60 * 1000).toISOString(),
    expected: nowSec + MIN_EXPIRY_OFFSET_SECONDS,
  },
];
for (const c of cases) {
  const got = computeExpiresAt(c.iso, nowMs);
  if (got === c.expected) ok(`computeExpiresAt: ${c.label}`);
  else fail(`computeExpiresAt: ${c.label}`, `got=${got} expect=${c.expected}`);
}

/* ---------- 2. return URL builder ---------------------------------------- */

const urls1 = buildReturnUrls("http://localhost:3000");
if (
  urls1.successUrl ===
    "http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}" &&
  urls1.cancelUrl ===
    "http://localhost:3000/payment/cancel?session_id={CHECKOUT_SESSION_ID}"
) {
  ok("buildReturnUrls: localhost");
} else {
  fail("buildReturnUrls: localhost", JSON.stringify(urls1));
}
const urls2 = buildReturnUrls("https://loft.example.com/");
if (urls2.successUrl.startsWith("https://loft.example.com/payment/success?")) {
  ok("buildReturnUrls: trailing slash stripped");
} else {
  fail("buildReturnUrls: trailing slash", JSON.stringify(urls2));
}

/* ---------- 3. isSessionUsable ------------------------------------------- */

const future = Math.floor(Date.now() / 1000) + 600;
const past = Math.floor(Date.now() / 1000) - 1;

const usableCases: Array<{
  label: string;
  session: { status: string; url: string | null; expires_at: number | null };
  expect: boolean;
}> = [
  {
    label: "open + url + future expiry → usable",
    session: { status: "open", url: "https://stripe", expires_at: future },
    expect: true,
  },
  {
    label: "open + url + null expiry → usable",
    session: { status: "open", url: "https://stripe", expires_at: null },
    expect: true,
  },
  {
    label: "status=complete → not usable",
    session: { status: "complete", url: "https://stripe", expires_at: future },
    expect: false,
  },
  {
    label: "status=expired → not usable",
    session: { status: "expired", url: "https://stripe", expires_at: future },
    expect: false,
  },
  {
    label: "url=null → not usable",
    session: { status: "open", url: null, expires_at: future },
    expect: false,
  },
  {
    label: "expires_at in the past → not usable",
    session: { status: "open", url: "https://stripe", expires_at: past },
    expect: false,
  },
];
for (const c of usableCases) {
  const got = isSessionUsable(c.session);
  if (got === c.expect) ok(`isSessionUsable: ${c.label}`);
  else fail(`isSessionUsable: ${c.label}`, `got=${got} expect=${c.expect}`);
}

/* ---------- 4. idempotency-key derivation -------------------------------- */

if (
  idempotencyKey("b-123", 1) === "checkout:b-123:rev1" &&
  idempotencyKey("b-123", 2) === "checkout:b-123:rev2"
) {
  ok("idempotencyKey: revision bump produces different key");
} else {
  fail("idempotencyKey", "shape mismatch");
}

/* ---------- 5. summary --------------------------------------------------- */

console.log("\nstripe pure-logic smoke");
console.log("-----------------------");
for (const r of results) {
  console.log(`  ${r.ok ? "OK   " : "FAIL "}  ${r.name}`);
  if (!r.ok && r.detail) console.log(`           ${r.detail}`);
}
const passed = results.filter((r) => r.ok).length;
const failedCount = results.length - passed;
console.log(
  `\nsummary: ${passed} passed / ${failedCount} failed (${results.length} total)`
);
if (failedCount > 0) process.exit(1);
