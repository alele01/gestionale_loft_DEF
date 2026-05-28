/**
 * Italian Codice Fiscale validator (client + server safe, no I/O).
 *
 * Two accepted shapes:
 *
 *   1. Persona fisica — 16 alphanumeric characters following the pattern
 *      SSSNNN YY M GG NNNNN X, where the final X is a check letter
 *      computed deterministically from the first 15 characters via the
 *      official odd/even lookup tables (DM 23/12/1976).
 *
 *   2. Ditta individuale / partita IVA used as CF — 11 digits. We accept
 *      the format but do NOT verify the Luhn-style P.IVA check digit yet
 *      (rare for B2C events; the server zod schema enforces shape
 *      strictly anyway).
 *
 * The function returns a discriminated union so the caller can show a
 * different hint per failure mode. It is NEVER blocking — the
 * authoritative validation lives in the server `completion/schema.ts`.
 *
 * Edge cases NOT yet supported:
 *   - Omocodia (collision-resolved CFs where some digits are replaced
 *     by letters via a substitution table). Statistically <1‰; we
 *     surface them as `checksum_invalid` so the user double-checks.
 */

export type TaxCodeValidation =
  | { kind: "empty" }
  | { kind: "valid"; subkind: "personal" | "vat_number" }
  | { kind: "invalid"; reason: TaxCodeInvalidReason };

export type TaxCodeInvalidReason =
  | "length"
  | "format"
  | "checksum";

const PERSONAL_RE =
  /^[A-Z]{6}[0-9]{2}[ABCDEHLMPRST][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;

/**
 * Odd-position values (positions 1, 3, 5, …, 15 — counting from 1).
 * Source: Decreto Ministeriale 23/12/1976, allegato 1.
 */
const ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9,
  "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15,
  H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20,
  O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16,
  V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

/**
 * Even-position values (positions 2, 4, …, 14). Letters map 0–25 in
 * alphabet order; digits map to themselves.
 */
const EVEN: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
  "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6,
  H: 7, I: 8, J: 9, K: 10, L: 11, M: 12, N: 13,
  O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20,
  V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

/**
 * Validate a Codice Fiscale or a P.IVA used as CF. Empty input returns
 * `{ kind: "empty" }` (so the caller can choose not to show a hint at
 * all). Trims and uppercases internally — the caller does not need to
 * normalise.
 */
export function validateItalianTaxCode(raw: string): TaxCodeValidation {
  const value = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (value.length === 0) {
    return { kind: "empty" };
  }
  if (value.length === 11 && /^\d{11}$/.test(value)) {
    return { kind: "valid", subkind: "vat_number" };
  }
  if (value.length !== 16) {
    return { kind: "invalid", reason: "length" };
  }
  if (!PERSONAL_RE.test(value)) {
    return { kind: "invalid", reason: "format" };
  }
  if (!isChecksumValid(value)) {
    return { kind: "invalid", reason: "checksum" };
  }
  return { kind: "valid", subkind: "personal" };
}

function isChecksumValid(cf: string): boolean {
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    const ch = cf[i];
    // Positions are 1-based in the spec — index 0 is position 1 (odd).
    const lookup = (i + 1) % 2 === 1 ? ODD : EVEN;
    const value = lookup[ch];
    if (value === undefined) return false;
    sum += value;
  }
  const expected = String.fromCharCode("A".charCodeAt(0) + (sum % 26));
  return expected === cf[15];
}
