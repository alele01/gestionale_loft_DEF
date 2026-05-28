/**
 * Banker's rounding (round half to even).
 *
 * Rationale: invoice VAT breakdowns add up to the IVA-inclusiva gross.
 * Repeating banker's rounding across many small invoices removes the
 * systematic upward bias that `Math.round` (half-away-from-zero) would
 * introduce on `.5` half-cents.
 *
 * Input is a non-finite-safe float (cents-domain). Output is the closest
 * integer per banker's rule.
 *
 * Edge cases:
 *  - `NaN`/`Infinity` → throws (callers must validate inputs upstream).
 *  - Negative numbers are supported (refunds in future iterations).
 *  - JS float drift on `.5` is tolerated through an EPSILON tolerance so
 *    values that conceptually land on `.5` but read as e.g. `0.4999999...`
 *    still hit the tie-break branch.
 */
export function bankersRound(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`bankersRound: non-finite input: ${value}`);
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const diff = abs - floor;

  // Tolerance against float drift, e.g. 0.4999999999999999 should still
  // be treated as a tie when the exact algebraic value is 0.5.
  const EPS = 1e-9;
  if (Math.abs(diff - 0.5) < EPS) {
    return sign * (floor % 2 === 0 ? floor : floor + 1);
  }
  if (diff < 0.5) return sign * floor;
  return sign * (floor + 1);
}
