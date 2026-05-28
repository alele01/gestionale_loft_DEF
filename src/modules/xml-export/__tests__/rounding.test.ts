import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { bankersRound } from "../rounding";

describe("bankersRound", () => {
  it("rounds down values below .5", () => {
    assert.equal(bankersRound(0.49), 0);
    assert.equal(bankersRound(1.49), 1);
    assert.equal(bankersRound(99.4), 99);
  });

  it("rounds up values above .5", () => {
    assert.equal(bankersRound(0.51), 1);
    assert.equal(bankersRound(1.501), 2);
    assert.equal(bankersRound(99.6), 100);
  });

  it("rounds .5 to the nearest EVEN integer (banker's rule)", () => {
    assert.equal(bankersRound(0.5), 0);
    assert.equal(bankersRound(1.5), 2);
    assert.equal(bankersRound(2.5), 2);
    assert.equal(bankersRound(3.5), 4);
    assert.equal(bankersRound(4.5), 4);
    assert.equal(bankersRound(5.5), 6);
  });

  it("handles large values", () => {
    assert.equal(bankersRound(1_000_000.5), 1_000_000);
    assert.equal(bankersRound(1_000_001.5), 1_000_002);
  });

  it("handles negative values symmetrically (rounds to even on tie)", () => {
    // bankersRound(-0.5) can return -0 in IEEE-754, which is numerically
    // equal to 0 (so `imponibile + imposta = gross` still holds) but
    // fails `assert.strictEqual`. Use `===` (which treats -0 === 0).
    assert.ok(bankersRound(-0.5) === 0);
    assert.equal(bankersRound(-1.5), -2);
    assert.equal(bankersRound(-2.5), -2);
    assert.equal(bankersRound(-3.5), -4);
  });

  it("tolerates float drift on values conceptually on .5", () => {
    // 0.1 + 0.4 in IEEE 754 = 0.5 (clean), but 0.5 - Number.EPSILON
    // should still be treated as a tie by the EPS-tolerant comparison.
    assert.equal(bankersRound(0.5 - Number.EPSILON), 0);
    assert.equal(bankersRound(1.5 - Number.EPSILON), 2);
  });

  it("throws on non-finite inputs", () => {
    assert.throws(() => bankersRound(NaN));
    assert.throws(() => bankersRound(Infinity));
    assert.throws(() => bankersRound(-Infinity));
  });
});
