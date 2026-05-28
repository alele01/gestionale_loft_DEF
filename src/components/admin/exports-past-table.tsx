"use client";

import * as React from "react";
import {
  CheckCircle2,
  Download,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatShortDate } from "@/lib/format";
import {
  getExportDownloadUrlAction,
  resendExportAction,
} from "../../server/xml-export/admin-actions";

export type PastExportRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: "generating" | "generated" | "emailed" | "failed";
  storagePath: string | null;
  emailedAt: string | null;
  invoiceCount: number;
  recipientEmail: string;
};

type Props = {
  rows: PastExportRow[];
};

export function PastExportsTable({ rows }: Props) {
  const [busy, setBusy] = React.useState<Record<string, "resend" | "download" | null>>(
    {}
  );

  const setRowBusy = (id: string, action: "resend" | "download" | null) =>
    setBusy((p) => ({ ...p, [id]: action }));

  const download = async (id: string) => {
    setRowBusy(id, "download");
    try {
      const res = await getExportDownloadUrlAction(id);
      if (res.status === "ok") {
        window.open(res.url, "_blank", "noopener");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRowBusy(id, null);
    }
  };

  const resend = async (id: string) => {
    setRowBusy(id, "resend");
    try {
      const res = await resendExportAction(id);
      if (res.status === "ok") toast.success(res.message);
      else if (res.status === "skipped") toast.message(res.message);
      else if (res.status === "error") toast.error(res.message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRowBusy(id, null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              <ScrollText className="mr-1 inline h-4 w-4" />
              Invii passati al commercialista
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cronologia degli invii automatici e manuali.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun invio ancora effettuato.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Esito</TableHead>
                  <TableHead className="text-right">Fatture</TableHead>
                  <TableHead>Inviato il</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="text-sm">
                      {formatShortDate(x.periodStart)} —{" "}
                      {formatShortDate(x.periodEnd)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={x.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {x.invoiceCount}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {x.emailedAt ? formatDateTime(x.emailedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !x.storagePath || busy[x.id] === "download"
                          }
                          onClick={() => download(x.id)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Zip
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            !x.storagePath || busy[x.id] === "resend"
                          }
                          onClick={() => resend(x.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Re-invia
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: PastExportRow["status"] }) {
  if (status === "emailed") {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Consegnato
      </span>
    );
  }
  if (status === "failed") {
    return <Badge className="border-transparent bg-rose-100 text-rose-900">Fallito</Badge>;
  }
  if (status === "generated") {
    return <Badge variant="muted">Generato (email pendente)</Badge>;
  }
  return <Badge variant="muted">In corso</Badge>;
}
