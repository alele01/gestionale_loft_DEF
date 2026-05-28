import "server-only";

import type { ServiceClient } from "@/server/supabase";

/**
 * Reserve the next `(year, number)` pair for an invoice. Implemented as
 * a PL/pgSQL function (`public.reserve_invoice_number`) so the counter
 * read-then-write is atomic under concurrent callers.
 *
 * Returns the user-facing string `"YYYY/NNNN"` ready to put inside
 * `<Numero>`. The number is zero-padded to 4 digits to match the
 * accountant's preferred shape (the V1 venue is far from exhausting 4
 * digits in a year).
 */
export async function reserveInvoiceNumber(
  client: ServiceClient,
  targetYear: number
): Promise<{ year: number; number: number; label: string }> {
  const { data, error } = await client.rpc("reserve_invoice_number", {
    target_year: targetYear,
  });
  if (error) {
    throw new Error(
      `reserveInvoiceNumber RPC failed: ${error.message ?? String(error)}`
    );
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row.year !== "number" || typeof row.number !== "number") {
    throw new Error("reserveInvoiceNumber: unexpected RPC payload");
  }
  return {
    year: row.year,
    number: row.number,
    label: `${row.year}/${row.number.toString().padStart(4, "0")}`,
  };
}

/**
 * Derive the year to use for an invoice. We anchor on the booking's
 * `paid_at` because that is the fiscal event date (the SDI cares about
 * the date the supply was paid, not the date the XML was generated).
 *
 * Uses `Europe/Rome` to match the calendar boundary that the accountant
 * works with.
 */
export function invoiceYearFor(paidAtIso: string): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
  });
  const yearStr = formatter.format(new Date(paidAtIso));
  const year = Number.parseInt(yearStr, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error(`invoiceYearFor: unexpected year derived from ${paidAtIso}`);
  }
  return year;
}

/**
 * Generate a 10-character alphanumeric `ProgressivoInvio` (FatturaPA
 * header). Uses a uppercase A-Z + 0-9 alphabet (32 + 26 = 58? actually
 * 36, but we keep it readable). Uniqueness is per-transmission so a
 * fresh value per export run is plenty.
 */
export function generateTransmissionProgressive(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
