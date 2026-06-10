import { Layers } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { RelatedRequestRows } from "@/components/admin/related-request-rows";
import type { RelatedRequestOnOtherEvent } from "@/server/requests/queries";

export function RelatedRequestsOnOtherEventsAlert({
  related,
}: {
  related: RelatedRequestOnOtherEvent[];
}) {
  if (related.length === 0) return null;

  return (
    <Card className="border-sky-300 bg-sky-50/50">
      <CardContent className="flex items-start gap-3 p-4">
        <Layers className="mt-0.5 h-5 w-5 shrink-0 text-sky-800" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-sky-950">
            Richieste su altri eventi
          </p>
          <p className="text-xs leading-relaxed text-sky-950/80">
            La stessa persona ha inviato richieste anche per altri eventi (stessa
            email o telefono). Verifica lo stato di ciascuna prima di decidere su
            questa.
          </p>
          <RelatedRequestRows
            showEvent
            rows={related.map((row) => ({
              id: row.id,
              firstName: row.firstName,
              lastName: row.lastName,
              submittedAt: row.submittedAt,
              unifiedStatus: row.unifiedStatus,
              matchTypes: row.matchTypes,
              eventTitle: row.eventTitle,
              eventStartsAt: row.eventStartsAt,
            }))}
          />
        </div>
      </CardContent>
    </Card>
  );
}
