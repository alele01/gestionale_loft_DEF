import "server-only";

import type { ServiceClient } from "@/server/supabase";

import type { ExportBookingRow } from "./mapping";

export type LoaderArgs =
  | {
      mode: "period";
      periodStartIso: string;
      /** Exclusive upper bound. */
      periodEndIso: string;
    }
  | {
      mode: "selection";
      bookingIds: string[];
    };

/**
 * Load the rows required by the XML export job, deduplicated against
 * already-exported bookings via `xml_export_items`.
 *
 * Filtering rules:
 *  - booking.status = 'paid' (only paid bookings produce a fattura).
 *  - booking.cancelled_after_payment_at is null OR mode = 'selection'
 *    (admins can explicitly opt-in to re-issue a cancelled booking by
 *     picking it from the selection UI; the period and monthly cron
 *     never include them).
 *  - booking.id NOT IN (select booking_id from xml_export_items) — every
 *    booking is exported AT MOST ONCE. Re-issues go via a new export
 *    that explicitly references the same booking (out of scope for V1).
 *  - For mode='period': booking.paid_at ∈ [start, end).
 *
 * Returns an empty array (not an error) when no eligible bookings exist;
 * the caller decides whether to insert a "zero-rows" xml_exports row.
 */
export async function loadBookingsForExport(
  client: ServiceClient,
  args: LoaderArgs
): Promise<ExportBookingRow[]> {
  // 1. Collect booking_ids already exported (we filter on the client
  //    because PostgREST cannot express subqueries in select filters).
  const exported = await client.from("xml_export_items").select("booking_id");
  if (exported.error) throw exported.error;
  const exportedIds = new Set<string>(
    (exported.data ?? []).map((r) => r.booking_id as string)
  );

  let query = client
    .from("bookings")
    .select(
      `
      id, paid_at, amount_paid_cents, amount_cents, people,
      cancelled_after_payment_at,
      events:event_id (
        title, starts_at, price_cents, vat_rate_bps
      ),
      fiscal_profiles!fiscal_profiles_booking_id_fkey (
        kind, legal_name, first_name, last_name,
        tax_code, vat_number, sdi_code, pec_email,
        address_street, address_city, address_zip, address_province, address_country
      )
    `
    )
    .eq("status", "paid")
    .not("paid_at", "is", null);

  if (args.mode === "period") {
    query = query
      .gte("paid_at", args.periodStartIso)
      .lt("paid_at", args.periodEndIso)
      .is("cancelled_after_payment_at", null);
  } else {
    query = query.in("id", args.bookingIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows: ExportBookingRow[] = [];
  for (const row of data ?? []) {
    if (exportedIds.has(row.id)) continue;
    // The Supabase JS client returns related rows as arrays even for
    // one-to-one foreign keys; we coerce to single objects here.
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    const fiscal = Array.isArray(row.fiscal_profiles)
      ? row.fiscal_profiles[0]
      : row.fiscal_profiles;
    if (!event || !fiscal) continue;

    rows.push({
      bookingId: row.id,
      paidAtIso: row.paid_at as string,
      amountPaidCents:
        (row.amount_paid_cents as number | null) ??
        (row.amount_cents as number),
      people: row.people as number,
      event: {
        title: event.title,
        startsAt: event.starts_at,
        pricePerPersonCents: event.price_cents,
        vatRateBps: event.vat_rate_bps,
      },
      fiscal: {
        kind: fiscal.kind as "private" | "company",
        legalName: fiscal.legal_name,
        firstName: fiscal.first_name,
        lastName: fiscal.last_name,
        taxCode: fiscal.tax_code,
        vatNumber: fiscal.vat_number,
        sdiCode: fiscal.sdi_code,
        pecEmail: fiscal.pec_email,
        addressStreet: fiscal.address_street,
        addressCity: fiscal.address_city,
        addressZip: fiscal.address_zip,
        addressProvince: fiscal.address_province ?? "",
        addressCountry: fiscal.address_country,
      },
    });
  }

  // Stable ordering: ascending by paid_at, then by booking id. This
  // makes invoice numbering deterministic for a given period.
  rows.sort((a, b) => {
    const ta = Date.parse(a.paidAtIso);
    const tb = Date.parse(b.paidAtIso);
    if (ta !== tb) return ta - tb;
    return a.bookingId.localeCompare(b.bookingId);
  });

  return rows;
}
