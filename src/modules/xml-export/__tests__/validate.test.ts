import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { InvoiceInput } from "../types";
import { XmlValidationError, validateInvoiceInput } from "../validate";

function baseCompanyInput(): InvoiceInput {
  return {
    bookingId: "11111111-2222-3333-4444-555555555555",
    invoiceNumber: "2026/0001",
    transmissionProgressive: "A1B2C3D4E5",
    paidAtIso: "2026-05-23T12:00:00+02:00",
    currency: "EUR",
    grossAmountCents: 24000,
    vatRateBps: 2200,
    line: {
      description: "Cooker Loft Experience — Evento del 23/05/2026 — 2 partecipanti",
      quantity: 2,
      unitGrossPriceCents: 12000,
    },
    buyer: {
      kind: "company",
      vatNumber: "01234567890",
      denomination: "Acme S.r.l.",
      address: {
        street: "Via Roma 1",
        streetNumber: null,
        zip: "10100",
        city: "Torino",
        province: "TO",
        country: "IT",
      },
      sdiCode: "ABCDE12",
      pecEmail: null,
    },
  };
}

function basePrivateInput(): InvoiceInput {
  return {
    bookingId: "11111111-2222-3333-4444-555555555556",
    invoiceNumber: "2026/0002",
    transmissionProgressive: "X9Y8Z7Q6R5",
    paidAtIso: "2026-05-23T12:00:00+02:00",
    currency: "EUR",
    grossAmountCents: 24000,
    vatRateBps: 2200,
    line: {
      description: "Cooker Loft Experience — Evento del 23/05/2026 — 2 partecipanti",
      quantity: 2,
      unitGrossPriceCents: 12000,
    },
    buyer: {
      kind: "private",
      taxCode: "RSSMRA85M01H501Z",
      firstName: "Mario",
      lastName: "Rossi",
      address: {
        street: "Corso Vittorio 10",
        streetNumber: null,
        zip: "10121",
        city: "Torino",
        province: "TO",
        country: "IT",
      },
      sdiCode: null,
      pecEmail: null,
    },
  };
}

describe("validateInvoiceInput — happy paths", () => {
  it("accepts a well-formed company invoice", () => {
    assert.doesNotThrow(() => validateInvoiceInput(baseCompanyInput()));
  });

  it("accepts a well-formed private invoice", () => {
    assert.doesNotThrow(() => validateInvoiceInput(basePrivateInput()));
  });

  it("accepts a private buyer with an 11-digit ditta-individuale tax code", () => {
    const i = basePrivateInput();
    i.buyer = { ...i.buyer, taxCode: "01234567890" } as typeof i.buyer;
    assert.doesNotThrow(() => validateInvoiceInput(i));
  });

  it("accepts a company with sdiCode '0000000' when PEC is supplied", () => {
    const i = baseCompanyInput();
    (i.buyer as { sdiCode: string; pecEmail: string | null }).sdiCode = "0000000";
    (i.buyer as { sdiCode: string; pecEmail: string | null }).pecEmail =
      "pec@example.pec";
    assert.doesNotThrow(() => validateInvoiceInput(i));
  });
});

describe("validateInvoiceInput — error paths", () => {
  function expectField(input: InvoiceInput, expectedField: string) {
    try {
      validateInvoiceInput(input);
      assert.fail("expected XmlValidationError");
    } catch (err) {
      assert.ok(
        err instanceof XmlValidationError,
        `expected XmlValidationError, got ${err}`
      );
      assert.equal(
        (err as XmlValidationError).field,
        expectedField,
        `expected field=${expectedField}, got ${(err as XmlValidationError).field}`
      );
    }
  }

  it("rejects missing bookingId", () => {
    const i = baseCompanyInput();
    i.bookingId = "";
    expectField(i, "bookingId");
  });

  it("rejects missing invoiceNumber", () => {
    const i = baseCompanyInput();
    i.invoiceNumber = "   ";
    expectField(i, "invoiceNumber");
  });

  it("rejects invalid transmission progressive (too long)", () => {
    const i = baseCompanyInput();
    i.transmissionProgressive = "ABCDEFGHIJK";
    expectField(i, "transmissionProgressive");
  });

  it("rejects unparseable paidAtIso", () => {
    const i = baseCompanyInput();
    i.paidAtIso = "not-a-date";
    expectField(i, "paidAtIso");
  });

  it("rejects non-EUR currency", () => {
    const i = baseCompanyInput();
    (i as { currency: string }).currency = "USD";
    expectField(i, "currency");
  });

  it("rejects non-integer gross amount", () => {
    const i = baseCompanyInput();
    i.grossAmountCents = 240.5;
    expectField(i, "grossAmountCents");
  });

  it("rejects 0-cent gross", () => {
    const i = baseCompanyInput();
    i.grossAmountCents = 0;
    expectField(i, "grossAmountCents");
  });

  it("rejects out-of-range VAT rate (>50%)", () => {
    const i = baseCompanyInput();
    i.vatRateBps = 6000;
    expectField(i, "vatRateBps");
  });

  it("rejects negative VAT rate", () => {
    const i = baseCompanyInput();
    i.vatRateBps = -1;
    expectField(i, "vatRateBps");
  });

  it("rejects line.quantity × unit ≠ gross", () => {
    const i = baseCompanyInput();
    i.grossAmountCents = 25000;
    expectField(i, "line");
  });

  it("rejects 0-quantity line", () => {
    const i = baseCompanyInput();
    i.line.quantity = 0;
    expectField(i, "line.quantity");
  });

  it("rejects private buyer with missing firstName", () => {
    const i = basePrivateInput();
    (i.buyer as { firstName: string }).firstName = "  ";
    expectField(i, "buyer.firstName");
  });

  it("rejects private buyer with missing lastName", () => {
    const i = basePrivateInput();
    (i.buyer as { lastName: string }).lastName = "";
    expectField(i, "buyer.lastName");
  });

  it("rejects private buyer with malformed tax code", () => {
    const i = basePrivateInput();
    (i.buyer as { taxCode: string }).taxCode = "123";
    expectField(i, "buyer.taxCode");
  });

  it("rejects company with missing denomination", () => {
    const i = baseCompanyInput();
    (i.buyer as { denomination: string }).denomination = "";
    expectField(i, "buyer.denomination");
  });

  it("rejects company with non-numeric P.IVA", () => {
    const i = baseCompanyInput();
    (i.buyer as { vatNumber: string }).vatNumber = "ABCDE12345F";
    expectField(i, "buyer.vatNumber");
  });

  it("rejects company with 10-digit P.IVA", () => {
    const i = baseCompanyInput();
    (i.buyer as { vatNumber: string }).vatNumber = "1234567890";
    expectField(i, "buyer.vatNumber");
  });

  it("rejects company with malformed SDI code", () => {
    const i = baseCompanyInput();
    (i.buyer as { sdiCode: string }).sdiCode = "TOO-LONG-1";
    expectField(i, "buyer.sdiCode");
  });

  it("rejects company with SDI=0000000 and no PEC", () => {
    const i = baseCompanyInput();
    (i.buyer as { sdiCode: string; pecEmail: string | null }).sdiCode = "0000000";
    (i.buyer as { sdiCode: string; pecEmail: string | null }).pecEmail = null;
    expectField(i, "buyer.pecEmail");
  });

  it("rejects company with invalid PEC", () => {
    const i = baseCompanyInput();
    (i.buyer as { sdiCode: string; pecEmail: string | null }).pecEmail =
      "no-at-symbol";
    expectField(i, "buyer.pecEmail");
  });

  it("rejects malformed CAP", () => {
    const i = baseCompanyInput();
    i.buyer.address.zip = "1212";
    expectField(i, "buyer.address.zip");
  });

  it("rejects malformed province", () => {
    const i = baseCompanyInput();
    i.buyer.address.province = "ROMA";
    expectField(i, "buyer.address.province");
  });

  it("rejects non-IT country", () => {
    const i = baseCompanyInput();
    (i.buyer.address as { country: string }).country = "FR";
    expectField(i, "buyer.address.country");
  });
});
