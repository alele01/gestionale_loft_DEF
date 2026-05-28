import type { InvoiceInput, Buyer, Address } from "./types";

/**
 * Validation of pure inputs before XML generation.
 *
 * Throws `XmlValidationError` on the FIRST inconsistency found, with a
 * machine-readable `field` path (e.g. `buyer.vatNumber`) so the caller
 * (admin UI / job) can surface the precise field to the user / log.
 *
 * Rules implement the SDI FatturaPA FPR12 constraints we rely on:
 *  - Country is locked to `IT` (V1 scope).
 *  - CAP / ZIP: 5 numeric digits (Italian addresses only).
 *  - Provincia: 2 uppercase letters. We do NOT validate against the ISTAT
 *    code list here to keep the module dependency-free; the completion
 *    form already validates against the canonical list.
 *  - Private: 16 alphanumeric (CF persona fisica) OR 11 digits (ditta
 *    individuale using P.IVA as CF). First / last name non-empty.
 *  - Company: P.IVA 11 digits, SDI 7 alphanumeric or "0000000" (when
 *    "0000000" we require PEC).
 *  - Money: grossAmountCents must be a positive integer.
 *  - VAT rate: 0..5000 bps (0% .. 50%). Anything else is a typo.
 *  - InvoiceNumber: non-empty.
 *  - TransmissionProgressive: 1..10 alphanumeric chars (FPR12 schema).
 *  - PaidAtIso: ISO 8601 with timezone; Date.parse must succeed.
 *  - Line: positive integer quantity, positive integer unit price, and
 *    unitGrossPriceCents * quantity must equal grossAmountCents.
 */
export class XmlValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`[${field}] ${message}`);
    this.name = "XmlValidationError";
  }
}

const CF_PRIVATE_REGEX = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
const PIVA_REGEX = /^[0-9]{11}$/;
const SDI_REGEX = /^[A-Z0-9]{7}$/;
const ZIP_REGEX = /^[0-9]{5}$/;
const PROVINCE_REGEX = /^[A-Z]{2}$/;
const PROGRESSIVE_REGEX = /^[A-Za-z0-9]{1,10}$/;
const PEC_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateInvoiceInput(input: InvoiceInput): void {
  if (!input.bookingId || typeof input.bookingId !== "string") {
    throw new XmlValidationError("bookingId", "ID prenotazione mancante");
  }
  if (!input.invoiceNumber || !input.invoiceNumber.trim()) {
    throw new XmlValidationError("invoiceNumber", "Numero fattura mancante");
  }
  if (
    !input.transmissionProgressive ||
    !PROGRESSIVE_REGEX.test(input.transmissionProgressive)
  ) {
    throw new XmlValidationError(
      "transmissionProgressive",
      "Progressivo invio: 1-10 caratteri alfanumerici"
    );
  }
  if (
    !input.paidAtIso ||
    Number.isNaN(Date.parse(input.paidAtIso))
  ) {
    throw new XmlValidationError("paidAtIso", "Data pagamento non valida");
  }
  if (input.currency !== "EUR") {
    throw new XmlValidationError("currency", "Divisa: solo EUR in V1");
  }
  if (
    !Number.isInteger(input.grossAmountCents) ||
    input.grossAmountCents <= 0
  ) {
    throw new XmlValidationError(
      "grossAmountCents",
      "Importo lordo deve essere intero positivo"
    );
  }
  if (
    !Number.isInteger(input.vatRateBps) ||
    input.vatRateBps < 0 ||
    input.vatRateBps > 5000
  ) {
    throw new XmlValidationError(
      "vatRateBps",
      "Aliquota IVA fuori range (0-5000 bps)"
    );
  }

  // Line
  if (!input.line) {
    throw new XmlValidationError("line", "Linea di dettaglio mancante");
  }
  if (!input.line.description || !input.line.description.trim()) {
    throw new XmlValidationError(
      "line.description",
      "Descrizione linea mancante"
    );
  }
  if (
    !Number.isInteger(input.line.quantity) ||
    input.line.quantity <= 0
  ) {
    throw new XmlValidationError(
      "line.quantity",
      "Quantità deve essere intero positivo"
    );
  }
  if (
    !Number.isInteger(input.line.unitGrossPriceCents) ||
    input.line.unitGrossPriceCents <= 0
  ) {
    throw new XmlValidationError(
      "line.unitGrossPriceCents",
      "Prezzo unitario lordo deve essere intero positivo"
    );
  }
  const expectedTotal =
    input.line.unitGrossPriceCents * input.line.quantity;
  if (expectedTotal !== input.grossAmountCents) {
    throw new XmlValidationError(
      "line",
      `Coerenza importi: ${input.line.unitGrossPriceCents}c × ${input.line.quantity} = ${expectedTotal}c ≠ ${input.grossAmountCents}c`
    );
  }

  validateBuyer(input.buyer);
}

function validateBuyer(buyer: Buyer): void {
  if (!buyer) {
    throw new XmlValidationError("buyer", "Soggetto cliente mancante");
  }

  if (buyer.kind === "private") {
    if (!buyer.firstName || !buyer.firstName.trim()) {
      throw new XmlValidationError("buyer.firstName", "Nome del privato richiesto");
    }
    if (!buyer.lastName || !buyer.lastName.trim()) {
      throw new XmlValidationError("buyer.lastName", "Cognome del privato richiesto");
    }
    const tc = (buyer.taxCode || "").toUpperCase().replace(/\s+/g, "");
    if (!tc) {
      throw new XmlValidationError(
        "buyer.taxCode",
        "Codice fiscale richiesto per privato"
      );
    }
    if (!CF_PRIVATE_REGEX.test(tc) && !PIVA_REGEX.test(tc)) {
      throw new XmlValidationError(
        "buyer.taxCode",
        "Codice fiscale non valido (16 alfanumerici o 11 cifre)"
      );
    }
  } else if (buyer.kind === "company") {
    const denomination = (buyer.denomination || "").trim();
    if (!denomination) {
      throw new XmlValidationError(
        "buyer.denomination",
        "Ragione sociale richiesta"
      );
    }
    const vat = (buyer.vatNumber || "").replace(/\s+/g, "");
    if (!PIVA_REGEX.test(vat)) {
      throw new XmlValidationError(
        "buyer.vatNumber",
        "Partita IVA: 11 cifre"
      );
    }
    const sdi = (buyer.sdiCode || "").toUpperCase().trim();
    if (sdi !== "0000000" && !SDI_REGEX.test(sdi)) {
      throw new XmlValidationError(
        "buyer.sdiCode",
        "Codice SDI: 7 caratteri alfanumerici o '0000000'"
      );
    }
    if (sdi === "0000000") {
      const pec = (buyer.pecEmail || "").trim();
      if (!pec || !PEC_REGEX.test(pec)) {
        throw new XmlValidationError(
          "buyer.pecEmail",
          "PEC richiesta quando il codice SDI è 0000000"
        );
      }
    } else if (buyer.pecEmail && !PEC_REGEX.test(buyer.pecEmail.trim())) {
      throw new XmlValidationError("buyer.pecEmail", "PEC non valida");
    }
  } else {
    throw new XmlValidationError(
      "buyer.kind",
      "Tipo soggetto non valido (atteso 'private' o 'company')"
    );
  }

  validateAddress(buyer.address, "buyer.address");
}

function validateAddress(addr: Address | undefined, fieldPrefix: string): void {
  if (!addr) {
    throw new XmlValidationError(fieldPrefix, "Indirizzo mancante");
  }
  if (!addr.street || !addr.street.trim()) {
    throw new XmlValidationError(`${fieldPrefix}.street`, "Via richiesta");
  }
  if (!addr.city || !addr.city.trim()) {
    throw new XmlValidationError(`${fieldPrefix}.city`, "Comune richiesto");
  }
  if (!addr.zip || !ZIP_REGEX.test(addr.zip)) {
    throw new XmlValidationError(`${fieldPrefix}.zip`, "CAP italiano: 5 cifre");
  }
  if (!addr.province || !PROVINCE_REGEX.test(addr.province)) {
    throw new XmlValidationError(
      `${fieldPrefix}.province`,
      "Provincia: 2 lettere maiuscole"
    );
  }
  if (addr.country !== "IT") {
    throw new XmlValidationError(
      `${fieldPrefix}.country`,
      "Nazione: solo IT supportata in V1"
    );
  }
}
