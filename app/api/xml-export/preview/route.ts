import { NextResponse } from "next/server";

import { buildInvoiceXml } from "@/modules/xml-export";
import { requireAdmin } from "@/server/auth/require-admin";
import { getServiceClient } from "@/server/supabase";
import { loadBookingsForExport, mapToInvoiceInput } from "@/server/xml-export";

/**
 * GET /api/xml-export/preview?bookingId=...
 *
 * Returns the XML that WOULD be generated for `bookingId`, without
 * persisting anything: no `xml_exports` row, no counter increment, no
 * email. The invoice number is a placeholder ("PREVIEW/L") so the
 * admin can spot it in the preview and avoid confusion with real
 * progressives.
 *
 * Used by the admin /admin/exports page to show a live XML preview for
 * any single paid booking. Returns:
 *   - 200 + application/xml on success
 *   - 401 if the user is not an admin
 *   - 404 if the booking is missing / not paid / lacking fiscal data
 */
export async function GET(request: Request): Promise<Response> {
  await requireAdmin();

  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "missing bookingId" }, { status: 400 });
  }

  const client = getServiceClient();
  const rows = await loadBookingsForExport(client, {
    mode: "selection",
    bookingIds: [bookingId],
  });
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Prenotazione non trovata o priva di dati fiscali / pagamento.",
      },
      { status: 404 }
    );
  }

  const row = rows[0];
  try {
    const invoice = buildInvoiceXml(
      mapToInvoiceInput({
        row,
        invoiceNumber: `PREVIEW/L`,
        transmissionProgressive: "PREVIEW000",
      })
    );
    return new NextResponse(invoice.content, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "X-Filename": invoice.filename,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "preview_failed", details: message },
      { status: 422 }
    );
  }
}
