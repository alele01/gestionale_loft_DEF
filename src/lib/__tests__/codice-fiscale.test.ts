import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateItalianTaxCode } from "../codice-fiscale";

describe("validateItalianTaxCode", () => {
  it("empty input returns empty", () => {
    assert.equal(validateItalianTaxCode("").kind, "empty");
    assert.equal(validateItalianTaxCode("   ").kind, "empty");
  });

  it("accepts well-formed personal CF with valid checksum", () => {
    // RSSMRA85M01H501Q — Mario Rossi, 01/08/1985, Roma (H501).
    // Check letter Q computed via DM 23/12/1976 odd/even lookup.
    const result = validateItalianTaxCode("RSSMRA85M01H501Q");
    assert.equal(result.kind, "valid");
    assert.equal(
      result.kind === "valid" ? result.subkind : null,
      "personal"
    );
  });

  it("accepts CF with leading/trailing spaces and lowercase", () => {
    const result = validateItalianTaxCode("  rssmra85m01h501q  ");
    assert.equal(result.kind, "valid");
  });

  it("rejects CF with wrong check digit", () => {
    // Same CF as above but with the last char changed (Q → A).
    const result = validateItalianTaxCode("RSSMRA85M01H501A");
    assert.equal(result.kind, "invalid");
    assert.equal(
      result.kind === "invalid" ? result.reason : null,
      "checksum"
    );
  });

  it("rejects CF with wrong format (e.g. digit where a letter belongs)", () => {
    const result = validateItalianTaxCode("RSSMRA85M01H50Q1");
    assert.equal(result.kind, "invalid");
    assert.equal(
      result.kind === "invalid" ? result.reason : null,
      "format"
    );
  });

  it("rejects CF with wrong month letter", () => {
    // 'Z' is not a valid month code (allowed: A,B,C,D,E,H,L,M,P,R,S,T).
    const result = validateItalianTaxCode("RSSMRA85Z01H501Q");
    assert.equal(result.kind, "invalid");
    assert.equal(
      result.kind === "invalid" ? result.reason : null,
      "format"
    );
  });

  it("rejects CF of wrong length", () => {
    assert.equal(
      validateItalianTaxCode("RSSMRA85M01H501").kind,
      "invalid"
    );
    assert.equal(
      validateItalianTaxCode("RSSMRA85M01H501QQ").kind,
      "invalid"
    );
    const short = validateItalianTaxCode("RSSMRA85M01H501");
    assert.equal(
      short.kind === "invalid" ? short.reason : null,
      "length"
    );
  });

  it("accepts 11-digit P.IVA used as CF (ditta individuale)", () => {
    const result = validateItalianTaxCode("01234567890");
    assert.equal(result.kind, "valid");
    assert.equal(
      result.kind === "valid" ? result.subkind : null,
      "vat_number"
    );
  });

  it("rejects 10-digit or 12-digit numeric strings", () => {
    assert.equal(validateItalianTaxCode("0123456789").kind, "invalid");
    assert.equal(validateItalianTaxCode("012345678901").kind, "invalid");
  });
});
