import Link from "next/link";
import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CrossEventRelatedInfo } from "@/lib/request-related";

export function RelatedEventsBadge({
  info,
  className,
}: {
  info: CrossEventRelatedInfo;
  className?: string;
}) {
  const count = info.otherEventIds.length;
  const label =
    count === 1 ? "1 altro evento" : `${count} altri eventi`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-sky-950",
        className
      )}
      title={`Richieste collegate su ${count} ${
        count === 1 ? "altro evento" : "altri eventi"
      } (stessa email o telefono)`}
    >
      <Layers className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
