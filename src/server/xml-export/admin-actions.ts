"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/server/auth/require-admin";
import {
  getXmlExportDownloadUrl,
  resendXmlExportEmail,
  runXmlExport,
  type RunXmlExportResult,
} from "@/server/xml-export";

/**
 * Server actions for the /admin/exports page.
 *
 * All actions:
 *  - Authenticate the caller via `requireAdmin` (redirects to login on
 *    failure).
 *  - Validate inputs with zod.
 *  - Return a discriminated union so the client can show errors inline.
 *  - Revalidate /admin/exports on success so the new row appears.
 */

export type ExportActionState =
  | { status: "idle" }
  | {
      status: "ok";
      exportId: string;
      invoiceCount?: number;
      downloadUrl?: string | null;
      message: string;
    }
  | { status: "skipped"; message: string }
  | { status: "error"; message: string };

/**
 * Run the monthly auto export immediately (previous calendar month
 * boundary in Europe/Rome). Used by the "Esegui adesso" admin button.
 */
export async function runMonthlyExportAction(): Promise<ExportActionState> {
  const admin = await requireAdmin();
  const bounds = previousMonthBoundsRome(new Date());
  const result = await runXmlExport({
    mode: "monthly_auto",
    periodStartIso: bounds.startIso,
    periodEndIso: bounds.endIso,
    periodLabel: bounds.label,
    adminId: admin.adminUser.id,
  });
  revalidatePath("/admin/exports");
  return summarise(result, `Export mensile (${bounds.label})`);
}

const PeriodSchema = z.object({
  periodStart: z.string().trim().min(1, "Data inizio richiesta"),
  periodEnd: z.string().trim().min(1, "Data fine richiesta"),
});

/**
 * Run a manual export for an arbitrary [start, end) window. The dates
 * are interpreted as Europe/Rome calendar days at 00:00 and we add 1
 * day to make `end` exclusive.
 */
export async function runPeriodExportAction(
  _prev: ExportActionState,
  formData: FormData
): Promise<ExportActionState> {
  const admin = await requireAdmin();
  const parsed = PeriodSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Periodo non valido" };
  }
  const startIso = romeDateToIso(parsed.data.periodStart, "start");
  const endIso = romeDateToIso(parsed.data.periodEnd, "end");
  if (!startIso || !endIso) {
    return { status: "error", message: "Date non valide" };
  }
  const result = await runXmlExport({
    mode: "period",
    periodStartIso: startIso,
    periodEndIso: endIso,
    periodLabel: `${parsed.data.periodStart} → ${parsed.data.periodEnd}`,
    adminId: admin.adminUser.id,
  });
  revalidatePath("/admin/exports");
  return summarise(
    result,
    `Export periodo ${parsed.data.periodStart} → ${parsed.data.periodEnd}`
  );
}

const SelectionSchema = z.object({
  bookingIds: z
    .array(z.string().uuid("ID prenotazione non valido"))
    .min(1, "Seleziona almeno una prenotazione"),
});

/**
 * Run an export over an explicit booking selection. Useful for ad-hoc
 * reissues and edge cases (e.g. a booking that was paid outside the
 * monthly window).
 */
export async function runSelectionExportAction(
  bookingIds: string[]
): Promise<ExportActionState> {
  const admin = await requireAdmin();
  const parsed = SelectionSchema.safeParse({ bookingIds });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Selezione non valida",
    };
  }
  const result = await runXmlExport({
    mode: "selection",
    bookingIds: parsed.data.bookingIds,
    adminId: admin.adminUser.id,
  });
  revalidatePath("/admin/exports");
  return summarise(result, "Export selezione");
}

/**
 * Re-issue the E10 email for a past export. The zip itself is not
 * regenerated; the signed download URL is refreshed.
 */
export async function resendExportAction(
  exportId: string
): Promise<ExportActionState> {
  const admin = await requireAdmin();
  if (!exportId) return { status: "error", message: "ID export mancante" };
  const result = await resendXmlExportEmail(exportId, admin.adminUser.id);
  revalidatePath("/admin/exports");
  return summarise(result, "Re-invio email commercialista");
}

/**
 * Return a short-lived (5 minute) signed URL for the zip. The admin UI
 * uses it for the "Riscarica zip" button.
 */
export async function getExportDownloadUrlAction(
  exportId: string
): Promise<{ status: "ok"; url: string } | { status: "error"; message: string }> {
  await requireAdmin();
  if (!exportId) return { status: "error", message: "ID export mancante" };
  const url = await getXmlExportDownloadUrl(exportId, 300);
  if (!url) {
    return {
      status: "error",
      message: "Download non disponibile (file mancante in storage)",
    };
  }
  return { status: "ok", url };
}

// ────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────

function summarise(
  result: RunXmlExportResult,
  ctxLabel: string
): ExportActionState {
  switch (result.status) {
    case "emailed":
    case "generated":
      return {
        status: "ok",
        exportId: result.exportId,
        invoiceCount: result.invoiceCount,
        downloadUrl: result.downloadUrl,
        message:
          result.status === "emailed"
            ? `${ctxLabel}: ${result.invoiceCount} fatture inviate al commercialista`
            : `${ctxLabel}: ${result.invoiceCount} fatture generate (email fallita, puoi riprovare)`,
      };
    case "skipped_empty":
      return {
        status: "skipped",
        message: `${ctxLabel}: nessuna prenotazione idonea`,
      };
    case "failed":
      return { status: "error", message: result.error };
  }
}

/**
 * Boundary helper: compute the previous calendar month in Europe/Rome,
 * returning ISO timestamps that the loader can compare against
 * `bookings.paid_at` (timestamptz).
 *
 * Example: invoked at 2026-06-03T08:00 Europe/Rome ⇒ returns
 * 2026-05-01T00:00 Europe/Rome → 2026-06-01T00:00 Europe/Rome.
 */
function previousMonthBoundsRome(now: Date): {
  startIso: string;
  endIso: string;
  label: string;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const targetMonth = month === 1 ? 12 : month - 1;
  const targetYear = month === 1 ? year - 1 : year;
  // We approximate the Europe/Rome midnight with a UTC offset that
  // covers both CET (+01:00) and CEST (+02:00). For boundary purposes
  // the difference of 1 hour does not affect which calendar day a
  // `paid_at` falls into when stored as UTC. We anchor to +02:00 in
  // summer and +01:00 in winter by deriving the offset from the
  // resulting Date instance.
  const startUtc = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
  const endUtc = new Date(Date.UTC(targetYear, targetMonth, 1));
  const label = new Date(targetYear, targetMonth - 1, 1).toLocaleString(
    "it-IT",
    { month: "long", year: "numeric", timeZone: "Europe/Rome" }
  );
  return {
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
    label,
  };
}

function romeDateToIso(dateInput: string, edge: "start" | "end"): string | null {
  // Accept either "YYYY-MM-DD" (from <input type="date">) or full ISO.
  const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, y, m, d] = match;
    if (edge === "start") {
      // Treat YYYY-MM-DD as the start of that day in UTC. Close enough
      // for the loader filter against paid_at.
      return new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString();
    }
    // Inclusive end: shift to start of next day.
    const dt = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString();
  }
  if (!Number.isNaN(Date.parse(dateInput))) {
    return new Date(dateInput).toISOString();
  }
  return null;
}
