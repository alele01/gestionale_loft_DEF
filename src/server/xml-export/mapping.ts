import "server-only";

import type { InvoiceInput } from "@/modules/xml-export";

/**
 * Shape returned by the export job's DB loader. Each row is the fully-
 * dehydrated state required to build one invoice.
 *
 * Kept as a plain TS type to avoid coupling the mapper to the
 * Supabase-generated Row types — the loader is responsible for the
 * shape coming out of `from('bookings').select(...)`.
 */
export type ExportBookingRow = {
  bookingId: string;
  paidAtIso: string;
  amountPaidCents: number;
  people: number;
  event: {
    title: string;
    startsAt: string;
    pricePerPersonCents: number;
    vatRateBps: number;
  };
  fiscal: {
    kind: "private" | "company";
    legalName: string;
    firstName: string | null;
    lastName: string | null;
    taxCode: string | null;
    vatNumber: string | null;
    sdiCode: string | null;
    pecEmail: string | null;
    addressStreet: string;
    addressCity: string;
    addressZip: string;
    addressProvince: string;
    addressCountry: string;
  };
};

export type MapToInvoiceInput = {
  row: ExportBookingRow;
  invoiceNumber: string;
  transmissionProgressive: string;
};

/**
 * Translate a DB-side `ExportBookingRow` into the XML module's pure
 * `InvoiceInput`. The function also assembles the `<Descrizione>` text:
 * "{event.title} — {data evento dd/mm/yyyy}", matching the reference
 * sample's "Oggetto: ..." pattern but more compact (the venue's
 * invoices are simpler than the reference XML's media usage example).
 *
 * Validation is delegated to `validateInvoiceInput` (called inside
 * `buildInvoiceXml`); we keep this function dumb and deterministic.
 */
export function mapToInvoiceInput(args: MapToInvoiceInput): InvoiceInput {
  const { row, invoiceNumber, transmissionProgressive } = args;
  const eventDate = formatItalianShortDate(row.event.startsAt);
  const description = `${row.event.title} — Evento del ${eventDate} — ${row.people} ${
    row.people === 1 ? "partecipante" : "partecipanti"
  }`;

  const buyer =
    row.fiscal.kind === "private"
      ? ({
          kind: "private" as const,
          taxCode: row.fiscal.taxCode ?? "",
          firstName: row.fiscal.firstName ?? "",
          lastName: row.fiscal.lastName ?? "",
          address: {
            street: row.fiscal.addressStreet,
            streetNumber: null,
            zip: row.fiscal.addressZip,
            city: row.fiscal.addressCity,
            province: row.fiscal.addressProvince,
            country: "IT" as const,
          },
          sdiCode: row.fiscal.sdiCode,
          pecEmail: row.fiscal.pecEmail,
        })
      : ({
          kind: "company" as const,
          vatNumber: row.fiscal.vatNumber ?? "",
          taxCode: row.fiscal.taxCode ?? null,
          denomination: row.fiscal.legalName,
          address: {
            street: row.fiscal.addressStreet,
            streetNumber: null,
            zip: row.fiscal.addressZip,
            city: row.fiscal.addressCity,
            province: row.fiscal.addressProvince,
            country: "IT" as const,
          },
          sdiCode: row.fiscal.sdiCode ?? "0000000",
          pecEmail: row.fiscal.pecEmail,
        });

  return {
    bookingId: row.bookingId,
    invoiceNumber,
    transmissionProgressive,
    paidAtIso: row.paidAtIso,
    currency: "EUR",
    grossAmountCents: row.amountPaidCents,
    vatRateBps: row.event.vatRateBps,
    line: {
      description,
      quantity: row.people,
      unitGrossPriceCents: row.event.pricePerPersonCents,
    },
    buyer,
    paymentMode: "MP08",
  };
}

/**
 * Render an ISO timestamp as `dd/mm/yyyy` in `Europe/Rome` for the line
 * description. Kept inline because we don't want to share with
 * `src/server/email/format.ts` (different locale conventions).
 */
function formatItalianShortDate(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    day: "2-digit",
  }).format(d);
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    month: "2-digit",
  }).format(d);
  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
  }).format(d);
  return `${day}/${month}/${year}`;
}
