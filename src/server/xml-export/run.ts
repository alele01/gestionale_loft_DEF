import "server-only";

import { appendAuditLog, appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import { buildInvoiceXml, formatRomeDate } from "@/modules/xml-export";
import { sendE10AccountantExport } from "@/server/email";
import { formatCurrencyEUR } from "@/server/email/format";
import { getServiceClient } from "@/server/supabase";

import { loadBookingsForExport, type LoaderArgs } from "./loader";
import { mapToInvoiceInput } from "./mapping";
import {
  generateTransmissionProgressive,
  invoiceYearFor,
  reserveInvoiceNumber,
} from "./numbering";
import { buildManifestArtifacts, type ManifestEntry } from "./manifest";
import { buildZip } from "./zipper";

/** TTL for the signed URL embedded into the E10 email (7 days). */
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export type RunXmlExportInput =
  | {
      mode: "monthly_auto" | "period";
      periodStartIso: string;
      periodEndIso: string;
      adminId?: string | null;
      /** Override the period label shown in the E10 email. */
      periodLabel?: string;
    }
  | {
      mode: "selection";
      bookingIds: string[];
      adminId?: string | null;
      periodLabel?: string;
    };

export type RunXmlExportResult =
  | {
      status: "generated" | "emailed";
      exportId: string;
      invoiceCount: number;
      storagePath: string;
      downloadUrl: string | null;
      emailMessageId: string | null;
    }
  | {
      status: "skipped_empty";
      exportId: string;
    }
  | {
      status: "failed";
      exportId: string | null;
      error: string;
    };

/**
 * Orchestrate one XML export run. Steps:
 *
 *   1. Create an `xml_exports` row with status='generating' (audit anchor
 *      + lock against concurrent runs).
 *   2. Load eligible bookings via the loader (filters out already-exported).
 *   3. For each booking: reserve invoice number, build XML, accumulate
 *      manifest entry. Counter increments are atomic via RPC.
 *   4. Bundle XMLs + manifest into a zip and upload to Supabase Storage.
 *   5. Insert one row per booking into `xml_export_items`.
 *   6. Mark the export as 'generated', then send E10 with a signed URL.
 *   7. Mark as 'emailed' on success.
 *
 * Failure semantics:
 *  - Any error after step 1 transitions the row to 'failed' with
 *    `error_message`, plus an `xml_export.failed` audit row.
 *  - The function never throws past the top-level catch — the caller
 *    inspects `RunXmlExportResult.status`.
 */
export async function runXmlExport(
  input: RunXmlExportInput
): Promise<RunXmlExportResult> {
  const client = getServiceClient();
  let exportId: string | null = null;

  try {
    // ── 1. Settings + initial xml_exports row ──────────────────────
    const settingsRes = await client
      .from("app_settings")
      .select("accountant_email")
      .eq("id", 1)
      .maybeSingle();
    if (settingsRes.error) throw settingsRes.error;
    const accountantEmail = settingsRes.data?.accountant_email;
    if (!accountantEmail) {
      throw new Error("accountant_email not configured in app_settings");
    }

    const periodBounds = derivePeriodBounds(input);
    const initialRow = await client
      .from("xml_exports")
      .insert({
        period_start: periodBounds.startIso,
        period_end: periodBounds.endIso,
        status: "generating",
        recipient_email: accountantEmail,
        created_by: input.adminId ?? null,
      })
      .select("id")
      .single();
    if (initialRow.error || !initialRow.data) throw initialRow.error;
    exportId = initialRow.data.id;

    await appendAuditLogWithClient(client, {
      entityType: AUDIT_ENTITIES.xmlExport,
      entityId: exportId,
      action: AUDIT_ACTIONS.xmlExportStarted,
      actorType: input.adminId ? AUDIT_ACTORS.admin : AUDIT_ACTORS.cron,
      actorId: input.adminId ?? null,
      metadata: {
        mode: input.mode,
        period_start: periodBounds.startIso,
        period_end: periodBounds.endIso,
      },
    });

    // ── 2. Load eligible bookings ──────────────────────────────────
    const loaderArgs: LoaderArgs =
      input.mode === "selection"
        ? { mode: "selection", bookingIds: input.bookingIds }
        : {
            mode: "period",
            periodStartIso: periodBounds.startIso,
            periodEndIso: periodBounds.endIso,
          };
    const bookings = await loadBookingsForExport(client, loaderArgs);

    if (bookings.length === 0) {
      // No work to do; mark the row as failed with a friendly error and
      // bail out. We intentionally do NOT delete the row so the admin
      // sees the empty run in the timeline.
      await client
        .from("xml_exports")
        .update({
          status: "failed",
          error_message: "Nessuna prenotazione idonea nel periodo selezionato.",
        })
        .eq("id", exportId);
      await appendAuditLogWithClient(client, {
        entityType: AUDIT_ENTITIES.xmlExport,
        entityId: exportId,
        action: AUDIT_ACTIONS.xmlExportFailed,
        actorType: AUDIT_ACTORS.system,
        reason: "no_eligible_bookings",
      });
      return { status: "skipped_empty", exportId };
    }

    // ── 3. Generate XMLs + manifest entries ────────────────────────
    const transmissionProgressive = generateTransmissionProgressive();
    const xmlFiles: Array<{ name: string; content: string }> = [];
    const manifestEntries: ManifestEntry[] = [];
    let totalGrossCents = 0;
    let firstInvoiceNumber: string | null = null;
    let lastInvoiceNumber: string | null = null;

    for (const row of bookings) {
      const targetYear = invoiceYearFor(row.paidAtIso);
      const numbering = await reserveInvoiceNumber(client, targetYear);
      const invoiceInput = mapToInvoiceInput({
        row,
        invoiceNumber: numbering.label,
        transmissionProgressive,
      });
      const built = buildInvoiceXml(invoiceInput);
      xmlFiles.push({ name: built.filename, content: built.content });
      totalGrossCents += row.amountPaidCents;
      if (!firstInvoiceNumber) firstInvoiceNumber = numbering.label;
      lastInvoiceNumber = numbering.label;
      manifestEntries.push({
        progressive: numbering.label,
        filename: built.filename,
        bookingId: row.bookingId,
        paidAt: row.paidAtIso,
        fiscalKind: row.fiscal.kind,
        legalName: row.fiscal.legalName,
        taxCode: row.fiscal.taxCode,
        vatNumber: row.fiscal.vatNumber,
        sdiCode: row.fiscal.sdiCode,
        pecEmail: row.fiscal.pecEmail,
        amountEur: (row.amountPaidCents / 100).toFixed(2),
        vatRate: (row.event.vatRateBps / 100).toFixed(2),
        eventTitle: row.event.title,
        eventDate: formatRomeDate(row.event.startsAt),
      });
    }

    const manifest = buildManifestArtifacts(manifestEntries);

    // ── 4. Build zip + upload ──────────────────────────────────────
    const archive = await buildZip([
      ...xmlFiles,
      { name: "manifest.csv", content: manifest.csv },
      { name: "manifest.json", content: manifest.json },
    ]);

    const storagePath = `${invoiceYearFor(bookings[0].paidAtIso)}/${exportId}.zip`;
    const upload = await client.storage
      .from("xml-exports")
      .upload(storagePath, archive, {
        contentType: "application/zip",
        upsert: true,
      });
    if (upload.error) throw upload.error;

    // ── 5. xml_export_items (deduplicated insert) ──────────────────
    const itemsInsert = await client.from("xml_export_items").insert(
      bookings.map((b) => ({
        xml_export_id: exportId!,
        booking_id: b.bookingId,
      }))
    );
    if (itemsInsert.error) throw itemsInsert.error;

    // ── 6. Mark generated + audit ──────────────────────────────────
    const generatedAt = new Date().toISOString();
    await client
      .from("xml_exports")
      .update({
        status: "generated",
        storage_path: storagePath,
        generated_at: generatedAt,
      })
      .eq("id", exportId);

    // Also remember the last run timestamp on app_settings so the admin
    // UI can highlight "last monthly run X ago".
    await client
      .from("app_settings")
      .update({ xml_export_last_run_at: generatedAt })
      .eq("id", 1);

    await appendAuditLogWithClient(client, {
      entityType: AUDIT_ENTITIES.xmlExport,
      entityId: exportId,
      action: AUDIT_ACTIONS.xmlExportGenerated,
      actorType: input.adminId ? AUDIT_ACTORS.admin : AUDIT_ACTORS.cron,
      actorId: input.adminId ?? null,
      metadata: {
        invoice_count: bookings.length,
        total_gross_cents: totalGrossCents,
        storage_path: storagePath,
        first_invoice_number: firstInvoiceNumber,
        last_invoice_number: lastInvoiceNumber,
      },
    });

    // ── 7. Sign URL + send E10 ─────────────────────────────────────
    const signed = await client.storage
      .from("xml-exports")
      .createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS);
    if (signed.error || !signed.data) {
      throw new Error(
        `failed to sign storage URL: ${signed.error?.message ?? "unknown"}`
      );
    }
    const downloadUrl = signed.data.signedUrl;

    const emailResult = await sendE10AccountantExport({
      exportId: exportId,
      accountantEmail,
      periodLabel: input.periodLabel ?? defaultPeriodLabel(periodBounds),
      invoiceCount: bookings.length,
      totalGrossCents,
      firstInvoiceNumber: firstInvoiceNumber!,
      lastInvoiceNumber: lastInvoiceNumber!,
      downloadUrl,
      downloadTtlLabel: "7 giorni",
    });

    if (emailResult.status === "sent") {
      await client
        .from("xml_exports")
        .update({
          status: "emailed",
          email_message_id: emailResult.messageId,
          emailed_at: new Date().toISOString(),
        })
        .eq("id", exportId);
      return {
        status: "emailed",
        exportId,
        invoiceCount: bookings.length,
        storagePath,
        downloadUrl,
        emailMessageId: emailResult.messageId,
      };
    }

    // Email failed: keep the export at status=generated so the admin can
    // resend later. Log the failure separately (sendEmail already wrote
    // an `email_log` row with status=failed).
    await appendAuditLogWithClient(client, {
      entityType: AUDIT_ENTITIES.xmlExport,
      entityId: exportId,
      action: AUDIT_ACTIONS.xmlExportEmailFailed,
      actorType: AUDIT_ACTORS.system,
      metadata: {
        error: emailResult.error,
      },
    });
    return {
      status: "generated",
      exportId,
      invoiceCount: bookings.length,
      storagePath,
      downloadUrl,
      emailMessageId: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (exportId) {
      try {
        await client
          .from("xml_exports")
          .update({
            status: "failed",
            error_message: message.slice(0, 1000),
          })
          .eq("id", exportId);
        await appendAuditLog({
          entityType: AUDIT_ENTITIES.xmlExport,
          entityId: exportId,
          action: AUDIT_ACTIONS.xmlExportFailed,
          actorType: AUDIT_ACTORS.system,
          metadata: { error: message },
        });
      } catch {
        // Swallow secondary errors so we always return a typed result.
      }
    }
    // eslint-disable-next-line no-console
    console.error("[xml-export] run failed", { exportId, error: message });
    return { status: "failed", exportId, error: message };
  }
}

/**
 * Resolve [periodStartIso, periodEndIso) for the run. For `selection`
 * mode we still need a representative window: we take the min/max
 * paid_at of the chosen bookings later, but for the initial row we use
 * a placeholder window of "now ± 1 minute" so the NOT NULL columns are
 * satisfied. The real selection mode runs use the bounds the admin
 * picked on the UI (and pass them through `periodLabel`).
 */
function derivePeriodBounds(input: RunXmlExportInput): {
  startIso: string;
  endIso: string;
} {
  if (input.mode === "selection") {
    const now = new Date();
    const start = new Date(now.getTime() - 60_000);
    const end = new Date(now.getTime() + 60_000);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }
  return { startIso: input.periodStartIso, endIso: input.periodEndIso };
}

function defaultPeriodLabel(bounds: { startIso: string; endIso: string }): string {
  const start = formatRomeDate(bounds.startIso);
  const end = formatRomeDate(bounds.endIso);
  return `${start} → ${end}`;
}

/**
 * Re-issue the E10 email for an existing export without regenerating
 * the zip. Used by the "Re-invia al commercialista" admin action.
 */
export async function resendXmlExportEmail(
  exportId: string,
  adminId?: string | null
): Promise<RunXmlExportResult> {
  const client = getServiceClient();
  try {
    const row = await client
      .from("xml_exports")
      .select(
        "id, status, storage_path, recipient_email, period_start, period_end"
      )
      .eq("id", exportId)
      .maybeSingle();
    if (row.error) throw row.error;
    if (!row.data) throw new Error(`xml_exports row ${exportId} not found`);
    if (!row.data.storage_path) {
      throw new Error("export has no storage_path — cannot resend");
    }

    const itemsRes = await client
      .from("xml_export_items")
      .select("booking_id")
      .eq("xml_export_id", exportId);
    if (itemsRes.error) throw itemsRes.error;
    const invoiceCount = (itemsRes.data ?? []).length;

    // For totals + numbering we trust the prior audit log; if the
    // export was generated by this module the metadata is there.
    const auditRes = await client
      .from("audit_log")
      .select("metadata")
      .eq("entity_type", "xml_export")
      .eq("entity_id", exportId)
      .eq("action", AUDIT_ACTIONS.xmlExportGenerated)
      .maybeSingle();

    const meta = (auditRes.data?.metadata ?? {}) as Record<string, unknown>;
    const totalGrossCents = Number(meta.total_gross_cents ?? 0);
    const firstInvoiceNumber = String(meta.first_invoice_number ?? "-");
    const lastInvoiceNumber = String(meta.last_invoice_number ?? "-");

    const signed = await client.storage
      .from("xml-exports")
      .createSignedUrl(row.data.storage_path, DOWNLOAD_URL_TTL_SECONDS);
    if (signed.error || !signed.data) {
      throw new Error(
        `failed to sign storage URL: ${signed.error?.message ?? "unknown"}`
      );
    }
    const downloadUrl = signed.data.signedUrl;
    const periodLabel = defaultPeriodLabel({
      startIso: row.data.period_start,
      endIso: row.data.period_end,
    });

    const emailResult = await sendE10AccountantExport({
      exportId,
      accountantEmail: row.data.recipient_email,
      periodLabel,
      invoiceCount,
      totalGrossCents,
      firstInvoiceNumber,
      lastInvoiceNumber,
      downloadUrl,
      downloadTtlLabel: "7 giorni",
      resend: true,
    });

    if (emailResult.status === "sent") {
      await client
        .from("xml_exports")
        .update({
          status: "emailed",
          email_message_id: emailResult.messageId,
          emailed_at: new Date().toISOString(),
        })
        .eq("id", exportId);
    }

    await appendAuditLogWithClient(client, {
      entityType: AUDIT_ENTITIES.xmlExport,
      entityId: exportId,
      action: AUDIT_ACTIONS.xmlExportResent,
      actorType: adminId ? AUDIT_ACTORS.admin : AUDIT_ACTORS.system,
      actorId: adminId ?? null,
      metadata: {
        email_status: emailResult.status,
        message_id:
          emailResult.status === "sent" ? emailResult.messageId : null,
        error: emailResult.status === "failed" ? emailResult.error : null,
      },
    });

    return {
      status: emailResult.status === "sent" ? "emailed" : "generated",
      exportId,
      invoiceCount,
      storagePath: row.data.storage_path,
      downloadUrl,
      emailMessageId:
        emailResult.status === "sent" ? emailResult.messageId : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[xml-export] resend failed", { exportId, error: message });
    return { status: "failed", exportId, error: message };
  }
}

/**
 * Generate a short-lived signed URL for an existing export's zip. Used
 * by the admin "Riscarica zip" button.
 */
export async function getXmlExportDownloadUrl(
  exportId: string,
  ttlSeconds = 300
): Promise<string | null> {
  const client = getServiceClient();
  const row = await client
    .from("xml_exports")
    .select("storage_path")
    .eq("id", exportId)
    .maybeSingle();
  if (row.error || !row.data?.storage_path) return null;
  const signed = await client.storage
    .from("xml-exports")
    .createSignedUrl(row.data.storage_path, ttlSeconds);
  return signed.data?.signedUrl ?? null;
}
