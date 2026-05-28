import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  unifiedStatusLabel,
  unifiedStatusTone,
  type UnifiedStatus,
} from "@/lib/status";

const toneClass: Record<string, string> = {
  neutral: "bg-blue-100 text-blue-900 hover:bg-blue-200",
  amber: "bg-amber-100 text-amber-900 hover:bg-amber-200",
  indigo: "bg-indigo-100 text-indigo-900 hover:bg-indigo-200",
  emerald: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
  rose: "bg-rose-100 text-rose-900 hover:bg-rose-200",
  muted: "bg-muted text-muted-foreground hover:bg-muted",
};

export function UnifiedStatusBadge({
  status,
  className,
}: {
  status: UnifiedStatus;
  className?: string;
}) {
  const tone = unifiedStatusTone[status];
  return (
    <Badge
      className={cn(
        "border-transparent font-medium",
        toneClass[tone],
        className
      )}
    >
      {unifiedStatusLabel[status]}
    </Badge>
  );
}
