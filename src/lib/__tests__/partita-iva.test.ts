import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isValidPartitaIva } from "../partita-iva";

describe("isValidPartitaIva", () => {
  it("accepts a P.IVA with a valid check digit", () => {
    // 04049550041 — control digit verified via the official algorithm
    // (sum of weighted digits = 40, multiple of 10).
    assert.equal(isValidPartitaIva("04049550041"), true);
  });

  it("accepts a P.IVA with surrounding/internal spaces", () => {
    assert.equal(isValidPartitaIva(" 04049 550041 "), true);
  });

  it("rejects a P.IVA with a wrong check digit", () => {
    // Same as the valid one but last digit changed 1 → 0.
    assert.equal(isValidPartitaIva("04049550040"), false);
  });

  it("rejects wrong length", () => {
    assert.equal(isValidPartitaIva("0404955004"), false); // 10 digits
    assert.equal(isValidPartitaIva("040495500411"), false); // 12 digits
  });

  it("rejects non-numeric input", () => {
    assert.equal(isValidPartitaIva("0404955004A"), false);
    assert.equal(isValidPartitaIva(""), false);
  });
});
