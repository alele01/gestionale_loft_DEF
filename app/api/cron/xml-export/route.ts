import { NextResponse } from "next/server";

import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import { appendAuditLog } from "@/server/audit/log";
import { getCronSecret } from "@/server/env";
import { getServiceClient } from "@/server/supabase";
import { runXmlExport } from "@/server/xml-export";

/**
 * GET /api/cron/xml-export — monthly Vercel Cron that batches the
 * previous calendar month's paid bookings into an XML zip and emails
 * the accountant (E10).
 *
 * Schedule: see vercel.json. Vercel Cron sends
 *   Authorization: Bearer ${CRON_SECRET}
 * automatically when CRON_SECRET is configured. In `NODE_ENV !==
 * "production"` we still enforce the header IF the secret is set
 * locally — this lets `curl` the endpoint during QA.
 *
 * Kill switch: `app_settings.xml_export_cron_enabled`. When false the
 * endpoint returns 200 OK with an explanatory body, so Vercel does not
 * page the operator with retries.
 *
 * The endpoint is idempotent at the booking level: `runXmlExport` skips
 * bookings already linked via `xml_export_items`. Re-running on the
 * same day produces a zero-row run (logged as `skipped_empty`).
 */
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    const secret = getCronSecret();
    const header = request.headers.get("authorization") ?? "";
    if (!secret || header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    const localSecret = getCronSecret();
    if (localSecret) {
      const header = request.headers.get("authorization") ?? "";
      if (header !== `Bearer ${localSecret}`) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }
  }

  const client = getServiceClient();
  const settingsRes = await client
    .from("app_settings")
    .select("xml_export_cron_enabled")
    .eq("id", 1)
    .maybeSingle();
  if (settingsRes.error) {
    return NextResponse.json(
      { error: "settings_load_failed", details: settingsRes.error.message },
      { status: 500 }
    );
  }
  if (!settingsRes.data?.xml_export_cron_enabled) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "xml_export_cron_disabled",
    });
  }

  const bounds = previousMonthBoundsRome(new Date());
  const result = await runXmlExport({
    mode: "monthly_auto",
    periodStartIso: bounds.startIso,
    periodEndIso: bounds.endIso,
    periodLabel: bounds.label,
  });

  if (result.status === "failed") {
    // Best-effort audit row for the cron-initiated failure. The export
    // row itself was already marked failed inside runXmlExport.
    if (result.exportId) {
      await appendAuditLog({
        entityType: AUDIT_ENTITIES.xmlExport,
        entityId: result.exportId,
        action: AUDIT_ACTIONS.xmlExportFailed,
        actorType: AUDIT_ACTORS.cron,
        metadata: { error: result.error, trigger: "monthly_cron" },
      });
    }
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    exportId: "exportId" in result ? result.exportId : null,
    invoiceCount: "invoiceCount" in result ? result.invoiceCount : 0,
    period: bounds.label,
  });
}

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
