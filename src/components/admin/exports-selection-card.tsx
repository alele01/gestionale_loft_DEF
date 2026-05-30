"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Search, Send, Users } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PriceLabel } from "@/components/shared/price-label";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { runSelectionExportAction } from "../../server/xml-export/admin-actions";

export type SelectableBooking = {
  id: string;
  paidAt: string | null;
  amountPaidCents: number | null;
  cancelledAfterPaymentAt: string | null;
  requester: { firstName: string; lastName: string; id: string };
  event: { title: string; startsAt: string };
};

type Props = {
  bookings: SelectableBooking[];
};

/**
 * Selection card — admin manually picks one or more paid bookings and
 * exports them on demand. Used for re-issues, post-hoc fixes, and any
 * booking outside the monthly window.
 */
export function SelectionExportCard({ bookings }: Props) {
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [running, setRunning] = React.useState(false);
  const [preview, setPreview] = React.useState<{
    bookingId: string;
    requester: string;
    content: string;
    error?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState<string | null>(
    null
  );
  const [query, setQuery] = React.useState("");

  const visibleBookings = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => {
      const haystack =
        `${b.requester.firstName} ${b.requester.lastName} ${b.event.title}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [bookings, query]);

  const previewBooking = async (b: SelectableBooking) => {
    setPreviewLoading(b.id);
    try {
      const res = await fetch(
        `/api/xml-export/preview?bookingId=${encodeURIComponent(b.id)}`,
        { cache: "no-store" }
      );
      const text = await res.text();
      const requester = `${b.requester.firstName} ${b.requester.lastName}`;
      if (!res.ok) {
        let message = text;
        try {
          const parsed = JSON.parse(text) as {
            error?: string;
            details?: string;
          };
          message = parsed.details || parsed.error || text;
        } catch {
          // text is already the message
        }
        setPreview({
          bookingId: b.id,
          requester,
          content: "",
          error: message,
        });
      } else {
        setPreview({ bookingId: b.id, requester, content: text });
      }
    } catch (err) {
      setPreview({
        bookingId: b.id,
        requester: `${b.requester.firstName} ${b.requester.lastName}`,
        content: "",
        error: (err as Error).message,
      });
    } finally {
      setPreviewLoading(null);
    }
  };

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedCount = selectedIds.length;
  const selectedTotal = bookings
    .filter((b) => selected[b.id])
    .reduce((s, b) => s + (b.amountPaidCents ?? 0), 0);

  const visibleSelectedCount = visibleBookings.filter(
    (b) => selected[b.id]
  ).length;
  const allSelected =
    visibleBookings.length > 0 &&
    visibleSelectedCount === visibleBookings.length;
  const someSelected = visibleSelectedCount > 0 && !allSelected;

  const toggleAll = (v: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const b of visibleBookings) next[b.id] = v;
      return next;
    });
  };

  const send = async () => {
    if (selectedCount === 0) return;
    setRunning(true);
    try {
      const result = await runSelectionExportAction(selectedIds);
      if (result.status === "ok") {
        toast.success(result.message);
        setSelected({});
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
          <Users className="mr-1 inline h-4 w-4" />
          Invio per selezione
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Scegli a mano una o più prenotazioni pagate non ancora esportate
          e inviale subito al commercialista. Utile per correzioni o invii
          fuori cadenza.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna prenotazione pagata disponibile per l&apos;export.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca per nome o evento…"
                className="pl-9"
                aria-label="Cerca prenotazioni per nome o evento"
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Checkbox
                        checked={
                          allSelected
                            ? true
                            : someSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(v) => toggleAll(v === true)}
                        aria-label="Seleziona tutte"
                      />
                    </TableHead>
                    <TableHead>Richiedente</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Pagato il</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Anteprima</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleBookings.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        Nessuna prenotazione trovata per &quot;{query}&quot;.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {visibleBookings.map((b) => {
                    const isCancelled = b.cancelledAfterPaymentAt !== null;
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected[b.id] === true}
                            onCheckedChange={(v) =>
                              setSelected((prev) => ({
                                ...prev,
                                [b.id]: v === true,
                              }))
                            }
                            aria-label={`Seleziona ${b.requester.firstName}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/prenotazioni/${b.requester.id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {b.requester.firstName} {b.requester.lastName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{b.event.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatShortDate(b.event.startsAt)}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.paidAt ? formatDateTime(b.paidAt) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {b.amountPaidCents !== null ? (
                            <PriceLabel
                              cents={b.amountPaidCents}
                              size="sm"
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {isCancelled ? (
                            <Badge className="border-transparent bg-rose-100 text-rose-900">
                              Cancellata dopo pagamento
                            </Badge>
                          ) : (
                            <Badge variant="muted">Pagata</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={previewLoading === b.id}
                            onClick={() => previewBooking(b)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {previewLoading === b.id ? "…" : "XML"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col items-start justify-between gap-3 rounded-md bg-muted/30 p-3 sm:flex-row sm:items-center">
              <div className="text-sm">
                {selectedCount === 0
                  ? "Seleziona una o più prenotazioni per inviarle."
                  : `${selectedCount} prenotazioni selezionate · totale `}
                {selectedCount > 0 ? (
                  <PriceLabel cents={selectedTotal} size="sm" />
                ) : null}
              </div>
              <Button
                onClick={send}
                disabled={selectedCount === 0 || running}
              >
                <Send className="h-4 w-4" />
                {running
                  ? "Invio in corso…"
                  : "Invia selezione al commercialista"}
              </Button>
            </div>

            {preview ? (
              <div className="space-y-2 rounded-md border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Anteprima XML — {preview.requester}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreview(null)}
                  >
                    Chiudi
                  </Button>
                </div>
                {preview.error ? (
                  <p className="text-sm text-rose-700">{preview.error}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Anteprima generata al volo. Il numero fattura è un
                      placeholder ({`PREVIEW/L`}); il valore reale viene
                      assegnato al momento dell&apos;invio.
                    </p>
                    <pre className="max-h-80 overflow-auto rounded bg-slate-950 p-3 text-[11px] leading-tight text-slate-100">
                      {preview.content}
                    </pre>
                  </>
                )}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
