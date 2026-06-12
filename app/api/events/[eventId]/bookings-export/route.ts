import { NextResponse } from "next/server";

import { requireAdmin } from "@/server/auth/require-admin";
import {
  buildBookingsXlsx,
  buildBookingsXlsxFilename,
  loadEventBookingsForExport,
} from "@/server/bookings-export";
import { getEventById } from "@/server/events/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/events/[eventId]/bookings-export
 *
 * Admin-only convenience export: downloads an .xlsx roster of everyone
 * booked on the event whose booking is paid or awaiting payment. This is
 * a standalone feature and is completely unrelated to the fiscal XML /
 * FatturaPA export — it shares no code, writes nothing, and touches no
 * invoice state.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
): Promise<Response> {
  await requireAdmin();

  const { eventId } = await params;
  const event = await getEventById(eventId);
  if (!event) {
    return NextResponse.json({ error: "Evento non trovato." }, { status: 404 });
  }

  const rows = await loadEventBookingsForExport(eventId);
  const meta = { title: event.title, startsAtIso: event.starts_at };
  const buffer = await buildBookingsXlsx(rows, meta);
  const filename = buildBookingsXlsxFilename(meta);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
