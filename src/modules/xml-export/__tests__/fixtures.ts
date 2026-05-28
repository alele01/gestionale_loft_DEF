/**
 * Shared fixtures for XML generator tests. Each fixture represents a
 * realistic edge case the venue actually expects to handle:
 *
 *  - `companyWithSdi`   — standard B2B (SDI 7-char alphanumeric).
 *  - `companyWithPecOnly` — B2B routed via PEC (SDI = 0000000).
 *  - `privateTorino`    — standard B2C resident in Torino.
 *  - `privateApostrophe` — B2C with apostrophe + accented chars in name/street.
 *  - `privateDittaIndividuale` — privato che usa la propria P.IVA come CF.
 *  - `halfCentRounding` — booking that produces a `.5` half-cent imposta
 *    (verifies banker's rounding).
 */

import type { InvoiceInput } from "../types";

const PAID_AT = "2026-05-23T18:45:00+02:00"; // 23 mag 2026, 18:45 Europe/Rome

export const companyWithSdi: InvoiceInput = {
  bookingId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  invoiceNumber: "2026/0001",
  transmissionProgressive: "A1B2C3D4E5",
  paidAtIso: PAID_AT,
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
    taxCode: "01234567890",
    denomination: "Acme S.r.l.",
    address: {
      street: "Via Garibaldi 1",
      streetNumber: null,
      zip: "10122",
      city: "Torino",
      province: "TO",
      country: "IT",
    },
    sdiCode: "M5UXCR1",
    pecEmail: null,
  },
};

export const companyWithPecOnly: InvoiceInput = {
  ...companyWithSdi,
  bookingId: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
  invoiceNumber: "2026/0002",
  transmissionProgressive: "B2B2B2B2B2",
  buyer: {
    ...companyWithSdi.buyer,
    sdiCode: "0000000",
    pecEmail: "contabilita@pec.acme.it",
  } as InvoiceInput["buyer"],
};

export const privateTorino: InvoiceInput = {
  bookingId: "cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee",
  invoiceNumber: "2026/0003",
  transmissionProgressive: "C3C3C3C3C3",
  paidAtIso: PAID_AT,
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
      street: "Corso Vittorio Emanuele 10",
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

export const privateApostrophe: InvoiceInput = {
  ...privateTorino,
  bookingId: "dddddddd-bbbb-cccc-dddd-eeeeeeeeeeee",
  invoiceNumber: "2026/0004",
  transmissionProgressive: "D4D4D4D4D4",
  buyer: {
    kind: "private",
    taxCode: "DZGLCU90A41L219Z",
    firstName: "Lùcia",
    lastName: "D'Azeglio",
    address: {
      street: "Corso Massimo D'Azeglio 60/H",
      streetNumber: null,
      zip: "10126",
      city: "Torino",
      province: "TO",
      country: "IT",
    },
    sdiCode: null,
    pecEmail: null,
  },
};

export const privateDittaIndividuale: InvoiceInput = {
  ...privateTorino,
  bookingId: "eeeeeeee-bbbb-cccc-dddd-eeeeeeeeeeee",
  invoiceNumber: "2026/0005",
  transmissionProgressive: "E5E5E5E5E5",
  buyer: {
    kind: "private",
    // 11-digit P.IVA used as CF — typical for ditta individuale signing
    // up to a B2C-priced event.
    taxCode: "98765432109",
    firstName: "Giovanna",
    lastName: "Bianchi",
    address: {
      street: "Via Po 12",
      streetNumber: null,
      zip: "10124",
      city: "Torino",
      province: "TO",
      country: "IT",
    },
    sdiCode: null,
    pecEmail: null,
  },
};

/**
 * Edge case: gross that lands on a `.5` half-cent in the imposta
 * calculation. With banker's rounding the imposta rounds DOWN on
 * even-floor (or UP on odd-floor) and the invariant
 * `imponibile + imposta = gross` still holds.
 */
export const halfCentRounding: InvoiceInput = {
  ...privateTorino,
  bookingId: "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee",
  invoiceNumber: "2026/0006",
  transmissionProgressive: "F6F6F6F6F6",
  grossAmountCents: 12200,
  line: {
    description: "Cooker Loft Experience — Evento del 23/05/2026 — 1 partecipante",
    quantity: 1,
    unitGrossPriceCents: 12200,
  },
};

export const ALL_FIXTURES: Record<string, InvoiceInput> = {
  companyWithSdi,
  companyWithPecOnly,
  privateTorino,
  privateApostrophe,
  privateDittaIndividuale,
  halfCentRounding,
};
