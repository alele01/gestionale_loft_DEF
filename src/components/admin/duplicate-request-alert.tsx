import { Copy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { RelatedRequestRows } from "@/components/admin/related-request-rows";
import type { PotentialDuplicateRequest } from "@/server/requests/queries";

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
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-amber-950">
            Altre richieste per questo evento
          </p>
          <p className="text-xs leading-relaxed text-amber-950/80">
            Stessa email o telefono su questo evento. Controlla lo stato delle
            altre richieste prima di accettare o rifiutare.
          </p>
          <RelatedRequestRows
            rows={duplicates.map((dup) => ({
              id: dup.id,
              firstName: dup.firstName,
              lastName: dup.lastName,
              submittedAt: dup.submittedAt,
              unifiedStatus: dup.unifiedStatus,
              matchTypes: dup.matchTypes,
            }))}
          />
        </div>
      </CardContent>
    </Card>
  );
}
