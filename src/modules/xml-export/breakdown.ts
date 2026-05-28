import { bankersRound } from "./rounding";

/**
 * Split a GROSS (IVA-inclusiva) amount into the imponibile + imposta
 * breakdown required by the FatturaPA `DatiRiepilogo` block.
 *
 * Formula (binding, see docs/XML_EXPORT.md §3.1):
 *
 *     imposta_cents     = bankersRound(gross * vatBps / (10000 + vatBps))
 *     imponibile_cents  = gross - imposta_cents
 *
 * Properties:
 *  - `imponibile_cents + imposta_cents === grossAmountCents` exactly,
 *    by construction. The XML generator can assert this invariant.
 *  - Anchors on gross because Stripe charged the gross; recomputing gross
 *    from a stored net would drift on every booking.
 *  - Banker's rounding (half-to-even) avoids systematic upward bias.
 */
export type VatBreakdown = {
  imponibileCents: number;
  impostaCents: number;
  grossCents: number;
  vatRateBps: number;
};

export function computeVatBreakdown(
  grossAmountCents: number,
  vatRateBps: number
): VatBreakdown {
  if (!Number.isInteger(grossAmountCents) || grossAmountCents < 0) {
    throw new Error(
      `computeVatBreakdown: invalid grossAmountCents (${grossAmountCents})`
    );
  }
  if (!Number.isInteger(vatRateBps) || vatRateBps < 0) {
    throw new Error(
      `computeVatBreakdown: invalid vatRateBps (${vatRateBps})`
    );
  }
  const numerator = grossAmountCents * vatRateBps;
  const denominator = 10000 + vatRateBps;
  const impostaCents = bankersRound(numerator / denominator);
  const imponibileCents = grossAmountCents - impostaCents;
  if (imponibileCents + impostaCents !== grossAmountCents) {
    throw new Error(
      `computeVatBreakdown: invariant violated (gross=${grossAmountCents}, imponibile=${imponibileCents}, imposta=${impostaCents})`
    );
  }
  return {
    grossCents: grossAmountCents,
    vatRateBps,
    imponibileCents,
    impostaCents,
  };
}

/**
 * Format a cents value as a `X.YY` (2 decimal) string for FatturaPA
 * amount fields like `ImponibileImporto`, `Imposta`, `ImportoPagamento`,
 * `ImportoTotaleDocumento`.
 */
export function formatCents2(cents: number): string {
  if (!Number.isFinite(cents)) {
    throw new Error(`formatCents2: non-finite input ${cents}`);
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const intPart = Math.trunc(abs / 100);
  const fracPart = abs % 100;
  return `${sign}${intPart}.${fracPart.toString().padStart(2, "0")}`;
}

/**
 * Format a cents value as `X.YYYYYYYY` (8 decimal) — matches the
 * reference XML precision for `PrezzoUnitario`.
 */
export function formatCents8(cents: number): string {
  return formatFixedDecimals(cents, 8);
}

/**
 * Format an euro amount as a fixed-decimal string for FatturaPA
 * `PrezzoUnitario`.
 *
 * Unlike `formatCents8`, this helper accepts sub-cent precision because
 * `PrezzoUnitario = ImponibileImporto / Quantita` can produce a value
 * that is not representable as an integer number of cents (e.g. for an
 * imponibile of 245.90 € split across 3 persons → 81.96666667 € each).
 *
 * The number of decimals is configurable (FatturaPA `Amount8DecimalType`
 * allows up to 8). We use JS `Number.toFixed`, which uses round-half-
 * away-from-zero. This is acceptable here because:
 *   - The authoritative figures for the SDI are `PrezzoTotale`,
 *     `ImponibileImporto`, `Imposta` — all integer-cents amounts that
 *     we control with banker's rounding upstream.
 *   - `PrezzoUnitario × Quantita` is allowed to differ from
 *     `PrezzoTotale` by a few sub-cents; the SDI tolerates this.
 */
export function formatEuroAmount(amountEuro: number, decimals: number): string {
  if (!Number.isFinite(amountEuro)) {
    throw new Error(`formatEuroAmount: non-finite input ${amountEuro}`);
  }
  if (!Number.isInteger(decimals) || decimals < 2 || decimals > 8) {
    throw new Error(
      `formatEuroAmount: decimals must be an integer in [2, 8], got ${decimals}`
    );
  }
  return amountEuro.toFixed(decimals);
}

/**
 * Format a cents value as `X.YYYYYYY` (7 decimal) — matches the
 * reference XML precision for `PrezzoTotale`.
 */
export function formatCents7(cents: number): string {
  return formatFixedDecimals(cents, 7);
}

/**
 * Format a quantity (integer count of persons) as `X.NNNNNNN` (7 decimal)
 * to match the reference XML, which uses 7 decimal places for
 * `Quantita`. Accepts any integer >= 0.
 */
export function formatQuantity7(quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`formatQuantity7: invalid quantity ${quantity}`);
  }
  return `${quantity}.0000000`;
}

function formatFixedDecimals(cents: number, decimals: number): string {
  if (!Number.isFinite(cents)) {
    throw new Error(`formatFixedDecimals: non-finite input ${cents}`);
  }
  if (decimals < 2) {
    throw new Error(`formatFixedDecimals: decimals must be >= 2, got ${decimals}`);
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const intPart = Math.trunc(abs / 100);
  const fracCents = abs % 100;
  // Pad up to `decimals` digits: the first 2 come from cents, the rest
  // are zero (we work in integer-cents space, no sub-cent precision).
  const fracStr =
    fracCents.toString().padStart(2, "0") +
    "0".repeat(decimals - 2);
  return `${sign}${intPart}.${fracStr}`;
}

/**
 * Format a VAT rate (basis points) as `X.YY` (2 decimal). Matches the
 * `AliquotaIVA` precision in the reference XML.
 */
export function formatVatRate(vatRateBps: number): string {
  if (!Number.isInteger(vatRateBps) || vatRateBps < 0) {
    throw new Error(`formatVatRate: invalid vatRateBps ${vatRateBps}`);
  }
  const intPart = Math.trunc(vatRateBps / 100);
  const fracPart = vatRateBps % 100;
  return `${intPart}.${fracPart.toString().padStart(2, "0")}`;
}
