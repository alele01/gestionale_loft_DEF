/**
 * Pure TypeScript types consumed by the XML export module.
 *
 * The module is intentionally framework-agnostic: it does NOT import from
 * `@/server/*`, Next.js, Supabase or React. Inputs are plain values built
 * by the caller (the runXmlExport job).
 *
 * Money values are integer cents (`bigint` widening to `number` is safe
 * within EUR amounts up to ~9e15 cents). VAT rates are basis points
 * (e.g. 2200 = 22.00 %).
 */

export type FiscalKind = "private" | "company";

export type Address = {
  street: string;
  /** Optional civic number; the reference XML keeps it as a separate tag. */
  streetNumber: string | null;
  zip: string;
  city: string;
  province: string;
  country: "IT";
};

export type PrivateParty = {
  kind: "private";
  /** Codice Fiscale: 16 alphanumeric chars (CF persona fisica) OR 11 digits (ditta individuale). */
  taxCode: string;
  firstName: string;
  lastName: string;
  address: Address;
  /** SDI is always "0000000" for private buyers (B2C); kept for completeness. */
  sdiCode?: string | null;
  pecEmail?: string | null;
};

export type CompanyParty = {
  kind: "company";
  /** P.IVA: 11 numeric digits. */
  vatNumber: string;
  /** Codice Fiscale (often identical to P.IVA for SRL/SPA). Optional. */
  taxCode?: string | null;
  /** Ragione sociale. */
  denomination: string;
  address: Address;
  /** 7-char alphanumeric, OR "0000000" if missing (then PEC required). */
  sdiCode: string;
  pecEmail?: string | null;
};

export type Buyer = PrivateParty | CompanyParty;

export type LineItem = {
  /** Free-text description (FatturaPA `Descrizione`). */
  description: string;
  /** Quantity (FatturaPA `Quantita`, persone for our use-case). */
  quantity: number;
  /** Per-unit GROSS price in cents (IVA inclusa). */
  unitGrossPriceCents: number;
};

export type InvoiceInput = {
  /** Booking UUID (for filename collision avoidance / audit). */
  bookingId: string;
  /** Progressive invoice number assigned by the export run. E.g. "2026/0001". */
  invoiceNumber: string;
  /**
   * Transmission progressive — 10-char alphanumeric, generated per send.
   * Lowercase letters and digits are accepted; the FPR12 schema allows
   * up to 10 alphanumeric chars.
   */
  transmissionProgressive: string;
  /**
   * Stripe `paid_at` in ISO-8601 with timezone. The XML emits the calendar
   * date in `Europe/Rome`, so we keep the source as a timezone-aware ISO.
   */
  paidAtIso: string;
  /** Currency code; locked to EUR for V1. */
  currency: "EUR";
  /** Gross amount (IVA inclusa), in cents. */
  grossAmountCents: number;
  /** VAT rate in basis points (e.g. 2200 = 22.00%). */
  vatRateBps: number;
  /** One line per booking. */
  line: LineItem;
  /** Buyer fiscal identity. */
  buyer: Buyer;
  /**
   * Optional payment mode override. Defaults to `MP08` (carta di credito)
   * because V1 always charges via Stripe. The constant lives in the
   * generator; we accept an override for tests / accountant tweaks.
   */
  paymentMode?: "MP01" | "MP02" | "MP05" | "MP08";
};

export type BuiltInvoice = {
  /** Deterministic filename, e.g. "IT04049550041_2026_0001.xml". */
  filename: string;
  /** Raw XML payload (UTF-8 string). */
  content: string;
};
