/**
 * Italian Partita IVA validator (client + server safe, no I/O).
 *
 * A valid P.IVA is exactly 11 digits where the 11th digit is a check
 * digit computed from the first 10 via the Luhn-style algorithm defined
 * in DPR 633/1972 (allegato) — the same scheme used by the Agenzia delle
 * Entrate / SDI. The algorithm:
 *
 *   1. Sum the digits in odd positions (1, 3, 5, 7, 9, 11 — 1-indexed)
 *      as-is.
 *   2. For digits in even positions (2, 4, 6, 8, 10): double them; if the
 *      result is > 9 subtract 9.
 *   3. The total (including the check digit) must be a multiple of 10.
 *
 * This catches the vast majority of typos (single-digit errors and most
 * transpositions). It does NOT prove the P.IVA is actually assigned to a
 * real company — only that it is formally well-formed.
 *
 * The function is NEVER blocking by itself; it is consumed by the server
 * zod schema and the booking state machine to gate submission before the
 * customer pays.
 */
export function isValidPartitaIva(raw: string): boolean {
  const value = (raw ?? "").replace(/\s+/g, "");
  if (!/^\d{11}$/.test(value)) return false;

  let sum = 0;
  for (let i = 0; i < 11; i += 1) {
    let digit = value.charCodeAt(i) - 48; // '0' === 48
    // Even positions in the 1-indexed spec are odd 0-based indexes.
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
