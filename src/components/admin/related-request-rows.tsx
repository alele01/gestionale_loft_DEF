import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { UnifiedStatusBadge } from "@/components/shared/unified-status-badge";
import { duplicateMatchLabel } from "@/lib/request-duplicates";
import { formatDateTime } from "@/lib/format";
import type { UnifiedStatus } from "@/lib/status";
import type { RequestDuplicateInfo } from "@/lib/request-duplicates";

export type RelatedRequestRow = {
  id: string;
  firstName: string;
  lastName: string;
  submittedAt: string;
  unifiedStatus: UnifiedStatus;
  matchTypes: RequestDuplicateInfo["matchTypes"];
  eventTitle?: string;
  eventStartsAt?: string;
};

export function RelatedRequestRows({
  rows,
  showEvent = false,
}: {
  rows: RelatedRequestRow[];
  showEvent?: boolean;
}) {
  return (
    <ul className="space-y-2 text-xs">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-inherit bg-white/40 px-2 py-1.5"
        >
          <Link
            href={`/admin/prenotazioni/${row.id}`}
            className="font-medium underline underline-offset-2 hover:opacity-80"
          >
            {row.firstName} {row.lastName}
          </Link>
          {showEvent && row.eventTitle && row.eventStartsAt ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3 w-3 shrink-0" />
              {row.eventTitle} · {formatDateTime(row.eventStartsAt)}
            </span>
          ) : null}
          <UnifiedStatusBadge status={row.unifiedStatus} className="text-[10px]" />
          <span className="text-muted-foreground">
            {duplicateMatchLabel({
              matchTypes: row.matchTypes,
              otherIds: [],
            }).toLowerCase()}{" "}
            · {formatDateTime(row.submittedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
