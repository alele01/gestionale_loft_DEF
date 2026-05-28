import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UnifiedStatusBadge } from "@/components/shared/unified-status-badge";
import { formatDateTime } from "@/lib/format";
import type { Prenotazione } from "@/lib/mock/store";

export function PrenotazioniTable({
  prenotazioni,
}: {
  prenotazioni: Prenotazione[];
}) {
  if (prenotazioni.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
        Nessuna prenotazione in questo stato.
      </div>
    );
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Richiedente</TableHead>
            <TableHead>Persone</TableHead>
            <TableHead>Ricevuta il</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="text-right">Apri</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prenotazioni.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {p.request.firstName} {p.request.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.request.email}
                  </p>
                </div>
              </TableCell>
              <TableCell className="tabular-nums">
                {p.booking?.people ?? p.request.people}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDateTime(p.request.submittedAt)}
              </TableCell>
              <TableCell>
                <UnifiedStatusBadge status={p.unifiedStatus} />
              </TableCell>
              <TableCell className="text-right">
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/prenotazioni/${p.id}`}>
                    Apri
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
