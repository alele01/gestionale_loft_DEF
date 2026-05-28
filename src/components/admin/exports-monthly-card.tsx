"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceLabel } from "@/components/shared/price-label";
import { formatShortDate } from "@/lib/format";
import { runMonthlyExportAction } from "../../server/xml-export/admin-actions";

type Props = {
  nextRun: { date: Date; periodLabel: string };
  pendingForNextRun: { bookings: number; totalAmountCents: number };
  cronEnabled: boolean;
  lastRunAt: string | null;
};

/**
 * Monthly auto card — read-only view of the cron schedule + the
 * "Esegui adesso" button that triggers the same export the cron will
 * fire on the 1st of next month. The `xml_export_cron_enabled` switch
 * lives on the Impostazioni page (kill switch, not a per-page action).
 */
export function MonthlyAutoCard({
  nextRun,
  pendingForNextRun,
  cronEnabled,
  lastRunAt,
}: Props) {
  const [running, setRunning] = React.useState(false);

  const triggerNow = async () => {
    setRunning(true);
    try {
      const result = await runMonthlyExportAction();
      if (result.status === "ok") {
        toast.success(result.message);
      } else if (result.status === "skipped") {
        toast.message(result.message);
      } else if (result.status === "error") {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <CalendarClock className="mr-1 inline h-4 w-4" />
          Invio automatico mensile
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ogni 1° del mese, alle 03:00, il sistema invia automaticamente al
          commercialista tutte le prenotazioni pagate del mese precedente.
          {cronEnabled
            ? null
            : " — Cron attualmente in pausa (vedi Impostazioni)."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Prossimo invio"
            value={formatShortDate(nextRun.date.toISOString())}
            hint={`includerà ${nextRun.periodLabel}`}
          />
          <Stat
            label="Prenotazioni nel periodo"
            value={String(pendingForNextRun.bookings)}
            hint="pagate · non ancora esportate"
          />
          <Stat
            label="Importo previsto"
            value={
              <PriceLabel
                cents={pendingForNextRun.totalAmountCents}
                size="sm"
              />
            }
            hint="totale lordo"
          />
        </div>

        {lastRunAt ? (
          <p className="text-[11px] text-muted-foreground">
            Ultimo invio automatico: {formatShortDate(lastRunAt)}.
          </p>
        ) : null}

        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={running}
            onClick={triggerNow}
          >
            {running
              ? "Invio in corso…"
              : "Invia ora invece di aspettare il 1°"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
