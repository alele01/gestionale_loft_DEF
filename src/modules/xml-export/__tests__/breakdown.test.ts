import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  computeVatBreakdown,
  formatCents2,
  formatCents7,
  formatCents8,
  formatQuantity7,
  formatVatRate,
} from "../breakdown";

describe("computeVatBreakdown", () => {
  it("matches the reference example (240€ gross, 22% VAT)", () => {
    const b = computeVatBreakdown(24000, 2200);
    assert.equal(b.grossCents, 24000);
    assert.equal(b.vatRateBps, 2200);
    assert.equal(b.impostaCents, 4328);
    assert.equal(b.imponibileCents, 19672);
    assert.equal(b.impostaCents + b.imponibileCents, 24000);
  });

  it("preserves the gross-equals-sum invariant for several rates", () => {
    const fixtures: Array<[number, number]> = [
      [12000, 400], // 120€ @ 4%
      [12000, 1000], // 120€ @ 10%
      [12000, 2200], // 120€ @ 22%
      [1, 2200], // 1c @ 22%
      [999999, 2200], // 9_999.99 @ 22%
      [50_000, 0], // VAT-free transaction
    ];
    for (const [gross, vatBps] of fixtures) {
      const b = computeVatBreakdown(gross, vatBps);
      assert.equal(
        b.impostaCents + b.imponibileCents,
        gross,
        `invariant failed for gross=${gross}, vatBps=${vatBps}`
      );
    }
  });

  it("uses banker's rounding on .5 half-cents", () => {
    // 1.10€ gross @ 100% VAT: imposta = 110 * 10000 / 20000 = 55c exactly.
    // 55 is odd → banker's rounding of a .0 is itself, no ambiguity.
    const b = computeVatBreakdown(110, 10000);
    assert.equal(b.impostaCents, 55);
    assert.equal(b.imponibileCents, 55);
  });

  it("rejects negative gross", () => {
    assert.throws(() => computeVatBreakdown(-1, 2200));
  });

  it("rejects non-integer gross", () => {
    assert.throws(() => computeVatBreakdown(99.9, 2200));
  });

  it("rejects negative VAT rate", () => {
    assert.throws(() => computeVatBreakdown(1000, -1));
  });
});

describe("amount formatters", () => {
  it("formatCents2 emits 2 decimal places", () => {
    assert.equal(formatCents2(0), "0.00");
    assert.equal(formatCents2(5), "0.05");
    assert.equal(formatCents2(99), "0.99");
    assert.equal(formatCents2(100), "1.00");
    assert.equal(formatCents2(24000), "240.00");
    assert.equal(formatCents2(634400), "6344.00");
  });

  it("formatCents7 emits 7 decimal places", () => {
    assert.equal(formatCents7(24000), "240.0000000");
    assert.equal(formatCents7(5200000), "52000.0000000");
  });

  it("formatCents8 emits 8 decimal places (PrezzoUnitario precision)", () => {
    assert.equal(formatCents8(12000), "120.00000000");
    assert.equal(formatCents8(520000), "5200.00000000");
  });

  it("formatQuantity7 emits 7-decimal integer quantity", () => {
    assert.equal(formatQuantity7(1), "1.0000000");
    assert.equal(formatQuantity7(2), "2.0000000");
    assert.equal(formatQuantity7(10), "10.0000000");
  });

  it("formatQuantity7 rejects non-integers and negative values", () => {
    assert.throws(() => formatQuantity7(-1));
    assert.throws(() => formatQuantity7(1.5));
  });

  it("formatVatRate emits 2-decimal percent", () => {
    assert.equal(formatVatRate(2200), "22.00");
    assert.equal(formatVatRate(1000), "10.00");
    assert.equal(formatVatRate(400), "4.00");
    assert.equal(formatVatRate(0), "0.00");
    assert.equal(formatVatRate(550), "5.50");
  });
});
