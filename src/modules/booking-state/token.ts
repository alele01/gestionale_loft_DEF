import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Completion token utilities. The database stores only the SHA-256 hash
 * (in the `bookings.completion_token_hash` bytea column); the plaintext is
 * sent ONCE to the representative inside the email link and is never
 * persisted in the DB or logs.
 *
 * See docs/SECURITY.md §2 for the rationale.
 */

const TOKEN_BYTES = 32; // 256-bit, URL-safe length ~43 chars

export type IssuedToken = {
  /** Plain text token to embed in the email link. Never stored as-is. */
  plaintext: string;
  /** Raw SHA-256 hash bytes; useful for crypto comparisons in-memory. */
  hash: Buffer;
  /**
   * The Postgres-ready storable representation (`\x<hex>`). This is what
   * MUST be written into and queried from the `bytea` column via PostgREST,
   * because the JS client serializes raw Buffers as JSON which corrupts the
   * column. See docs/SECURITY.md §2.
   */
  storable: string;
  /** Last 4 characters of the plaintext for human-friendly diagnostics. */
  last4: string;
};

export function issueCompletionToken(): IssuedToken {
  const buf = randomBytes(TOKEN_BYTES);
  const plaintext = buf.toString("base64url");
  const hash = hashCompletionToken(plaintext);
  return {
    plaintext,
    hash,
    storable: hashToPostgresHex(hash),
    last4: plaintext.slice(-4),
  };
}

export function hashCompletionToken(plaintext: string): Buffer {
  return createHash("sha256").update(plaintext, "utf8").digest();
}

/**
 * Convert a hash to the hex-encoded form Postgres returns for a bytea
 * column (`\x...`). Use this for both INSERT/UPDATE values and WHERE
 * filters against `completion_token_hash`.
 */
export function hashToPostgresHex(hash: Buffer): string {
  return `\\x${hash.toString("hex")}`;
}
