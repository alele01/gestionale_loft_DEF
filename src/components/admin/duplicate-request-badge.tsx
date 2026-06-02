import { Copy } from "lucide-react";

import {
  duplicateMatchLabel,
  type RequestDuplicateInfo,
} from "@/lib/request-duplicates";
import { cn } from "@/lib/utils";

export function DuplicateRequestBadge({
  info,
  className,
}: {
  info: RequestDuplicateInfo;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-amber-950",
        className
      )}
      title={`Possibile duplicato nello stesso evento (${duplicateMatchLabel(info).toLowerCase()})`}
    >
      <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
      Possibile duplicato
    </span>
  );
}
