import { Info } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { MonthlyAutoCard } from "@/components/admin/exports-monthly-card";
import { PeriodExportCard } from "@/components/admin/exports-period-card";
import {
  SelectionExportCard,
  type SelectableBooking,
} from "@/components/admin/exports-selection-card";
import {
  PastExportsTable,
  type PastExportRow,
} from "@/components/admin/exports-past-table";
import { requireAdmin } from "@/server/auth/require-admin";
import { getServiceClient } from "@/server/supabase";

export const dynamic = "force-dynamic";

function nextFirstOfMonth(now: Date) {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(3, 0, 0, 0);
  return d;
}

function previousMonthLabel(d: Date) {
  const prev = new Date(d);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  return prev.toLocaleString("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function AdminExportsPage() {
  await requireAdmin();
  const client = getServiceClient();

  // Settings (kill switch + recipient + last run timestamp)
  const settingsRes = await client
    .from("app_settings")
    .select(
      "accountant_email, xml_export_cron_enabled, xml_export_last_run_at"
    )
    .eq("id", 1)
    .maybeSingle();
  const settings = settingsRes.data;

  // Past exports (most recent first), with their invoice counts.
  const exportsRes = await client
    .from("xml_exports")
    .select(
      "id, period_start, period_end, status, storage_path, emailed_at, recipient_email"
    )
    .order("created_at", { ascending: false })
    .limit(50);
  const exportsRaw = exportsRes.data ?? [];

  // Map xml_export_items to count per export id.
  const itemsRes = exportsRaw.length
    ? await client
        .from("xml_export_items")
        .select("xml_export_id")
        .in(
          "xml_export_id",
          exportsRaw.map((e) => e.id)
        )
    : { data: [] as { xml_export_id: string }[] };
  const itemsCount = new Map<string, number>();
  for (const i of itemsRes.data ?? []) {
    itemsCount.set(
      i.xml_export_id,
      (itemsCount.get(i.xml_export_id) ?? 0) + 1
    );
  }

  const pastExports: PastExportRow[] = exportsRaw.map((e) => ({
    id: e.id,
    periodStart: e.period_start,
    periodEnd: e.period_end,
    status: e.status as PastExportRow["status"],
    storagePath: e.storage_path,
    emailedAt: e.emailed_at,
    invoiceCount: itemsCount.get(e.id) ?? 0,
    recipientEmail: e.recipient_email,
  }));

  // Eligible bookings for the selection card: paid, not yet exported.
  const exported = await client.from("xml_export_items").select("booking_id");
  const exportedIds = new Set<string>(
    (exported.data ?? []).map((r) => r.booking_id as string)
  );
  const paidRes = await client
    .from("bookings")
    .select(
      `
      id, paid_at, amount_paid_cents, cancelled_after_payment_at,
      request_id,
      booking_requests:request_id (
        id, requester_first_name, requester_last_name
      ),
      events:event_id (
        title, starts_at
      )
    `
    )
    .eq("status", "paid")
    .order("paid_at", { ascending: false });
  const selectable: SelectableBooking[] = [];
  for (const b of paidRes.data ?? []) {
    if (exportedIds.has(b.id)) continue;
    const req = Array.isArray(b.booking_requests)
      ? b.booking_requests[0]
      : b.booking_requests;
    const ev = Array.isArray(b.events) ? b.events[0] : b.events;
    if (!req || !ev) continue;
    selectable.push({
      id: b.id,
      paidAt: b.paid_at,
      amountPaidCents: b.amount_paid_cents,
      cancelledAfterPaymentAt: b.cancelled_after_payment_at,
      requester: {
        id: req.id,
        firstName: req.requester_first_name,
        lastName: req.requester_last_name,
      },
      event: {
        title: ev.title,
        startsAt: ev.starts_at,
      },
    });
  }

  // Monthly forecast: bookings paid in the current calendar month and
  // not yet exported. They are what the next cron run will export.
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  const pendingForNextRun = selectable.filter((b) => {
    if (!b.paidAt) return false;
    const t = Date.parse(b.paidAt);
    return (
      t >= monthStart.getTime() &&
      t < monthEnd.getTime() &&
      !b.cancelledAfterPaymentAt
    );
  });
  const pendingTotal = pendingForNextRun.reduce(
    (s, b) => s + (b.amountPaidCents ?? 0),
    0
  );

  const next = nextFirstOfMonth(now);

  return (
    <>
      <PageHeader
        title="Invio al commercialista"
        description="Da qui invii al commercialista le prenotazioni pagate. Il sistema lo fa in automatico ogni mese, ma puoi anche inviare manualmente quando ti serve."
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Invio al commercialista" },
        ]}
      />

      <Card className="border-slate-300 bg-slate-50/60">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Info className="mt-0.5 h-5 w-5 text-slate-700" />
          <div className="space-y-1">
            <p className="font-medium">
              Il commercialista riceve un&apos;email con il file zip delle
              fatture XML del periodo.
            </p>
            <p className="text-muted-foreground">
              Il gestionale non invia nulla all&apos;Agenzia delle Entrate e
              non si integra con servizi tipo Fatture in Cloud. La
              correttezza fiscale dei dati e l&apos;invio allo SDI restano
              a cura del commercialista.
            </p>
            <p className="text-xs text-muted-foreground">
              Destinatario configurato:{" "}
              <span className="font-medium text-foreground">
                {settings?.accountant_email ?? "—"}
              </span>{" "}
              · modificabile in{" "}
              <a className="underline" href="/admin/settings">
                Impostazioni
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <MonthlyAutoCard
        nextRun={{ date: next, periodLabel: previousMonthLabel(next) }}
        pendingForNextRun={{
          bookings: pendingForNextRun.length,
          totalAmountCents: pendingTotal,
        }}
        cronEnabled={settings?.xml_export_cron_enabled ?? false}
        lastRunAt={settings?.xml_export_last_run_at ?? null}
      />

      <PeriodExportCard />

      <SelectionExportCard bookings={selectable} />

      <PastExportsTable rows={pastExports} />
    </>
  );
}
