/**
 * Public barrel for the XML export module.
 *
 * This module is PURE: no Next.js, no Supabase, no React, no
 * `server-only`. Side effects (DB reads, storage, email) live in
 * `src/server/xml-export/`. The barrier is intentional so we can:
 *  - unit-test the generator against fixtures in isolation;
 *  - run the official AdE XSD validator on its output offline;
 *  - swap the schema or rounding rule without touching the runtime layer.
 *
 * See docs/XML_EXPORT.md §2 for the module contract.
 */

export { buildInvoiceXml, buildFilename, escapeXml, formatRomeDate, sanitizeFatturaText } from "./xml-builder";
export { computeVatBreakdown, formatCents2, formatCents7, formatCents8, formatQuantity7, formatVatRate } from "./breakdown";
export { bankersRound } from "./rounding";
export { validateInvoiceInput, XmlValidationError } from "./validate";
export { VENDOR } from "./vendor";
export type { VendorIdentity } from "./vendor";
export type {
  Address,
  Buyer,
  BuiltInvoice,
  CompanyParty,
  FiscalKind,
  InvoiceInput,
  LineItem,
  PrivateParty,
} from "./types";
