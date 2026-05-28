"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarRange, Send } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  runPeriodExportAction,
  type ExportActionState,
} from "../../server/xml-export/admin-actions";

const initialState: ExportActionState = { status: "idle" };

/**
 * Manual export over an arbitrary [start, end] window. The end date is
 * inclusive in the UI; the action shifts it to the start-of-next-day in
 * UTC before passing the range to `runXmlExport`.
 */
export function PeriodExportCard() {
  const now = new Date();
  const startOfPrevMonth = (d: Date) => {
    const x = new Date(d);
    x.setUTCDate(1);
    x.setUTCMonth(x.getUTCMonth() - 1);
    return x.toISOString().slice(0, 10);
  };
  const endOfPrevMonth = (d: Date) => {
    const x = new Date(d);
    x.setUTCDate(0);
    return x.toISOString().slice(0, 10);
  };

  const [state, formAction] = useActionState(
    runPeriodExportAction,
    initialState
  );
  const [from, setFrom] = React.useState(startOfPrevMonth(now));
  const [to, setTo] = React.useState(endOfPrevMonth(now));

  React.useEffect(() => {
    if (state.status === "ok") toast.success(state.message);
    if (state.status === "skipped") toast.message(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <CalendarRange className="mr-1 inline h-4 w-4" />
          Export manuale per periodo
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Scegli un intervallo di date personalizzato e invia al
          commercialista l&apos;export delle prenotazioni pagate in quel
          periodo.
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="period-from">Dal</Label>
              <Input
                id="period-from"
                name="periodStart"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-to">Al (incluso)</Label>
              <Input
                id="period-to"
                name="periodEnd"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              Il sistema includerà tutte le prenotazioni con{" "}
              <strong>data di pagamento</strong> nell&apos;intervallo
              indicato e non ancora esportate.
            </div>
          </div>

          <PeriodSubmit />
        </form>
      </CardContent>
    </Card>
  );
}

function PeriodSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Send className="h-4 w-4" />
      {pending ? "Invio in corso…" : "Invia al commercialista"}
    </Button>
  );
}
