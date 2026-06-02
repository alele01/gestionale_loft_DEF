import Link from "next/link";
import { Copy } from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { duplicateMatchLabel } from "@/lib/request-duplicates";
import { formatDateTime } from "@/lib/format";
import type { PotentialDuplicateRequest } from "@/server/requests/queries";

const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettata",
  rejected: "Rifiutata",
  waitlisted: "Lista d'attesa",
  cancelled: "Annullata",
  expired: "Scaduta",
};

export function DuplicateRequestAlert({
  duplicates,
}: {
  duplicates: PotentialDuplicateRequest[];
}) {
  if (duplicates.length === 0) return null;

  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardContent className="flex items-start gap-3 p-4">
        <Copy className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-amber-950">
            Possibile richiesta duplicata
          </p>
          <p className="text-xs leading-relaxed text-amber-950/80">
            Per questo evento esistono altre richieste con la stessa email o lo
            stesso numero di telefono. È solo un avviso: puoi gestire questa
            richiesta normalmente.
          </p>
          <ul className="space-y-1.5 text-xs">
            {duplicates.map((dup) => (
              <li key={dup.id}>
                <Link
                  href={`/admin/prenotazioni/${dup.id}`}
                  className="font-medium text-amber-950 underline underline-offset-2 hover:text-amber-900"
                >
                  {dup.firstName} {dup.lastName}
                </Link>
                <span className="text-amber-950/70">
                  {" "}
                  · {REQUEST_STATUS_LABEL[dup.status] ?? dup.status} ·{" "}
                  {duplicateMatchLabel({ matchTypes: dup.matchTypes, otherIds: [] }).toLowerCase()} ·{" "}
                  {formatDateTime(dup.submittedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
