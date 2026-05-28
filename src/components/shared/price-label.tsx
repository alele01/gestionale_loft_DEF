import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/format";

type PriceLabelProps = {
  cents: number;
  className?: string;
  qualifierClassName?: string;
  size?: "sm" | "md" | "lg";
};

/**
 * Single source for any euro amount in the UI.
 * Always appends "IVA inclusa" per the Cooker Loft V1 brief.
 */
export function PriceLabel({
  cents,
  className,
  qualifierClassName,
  size = "md",
}: PriceLabelProps) {
  const sizeClass =
    size === "lg"
      ? "text-2xl font-semibold"
      : size === "sm"
        ? "text-sm font-medium"
        : "text-base font-semibold";
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span className={sizeClass}>{formatEuro(cents)}</span>
      <span
        className={cn(
          "text-xs uppercase tracking-wide text-muted-foreground",
          qualifierClassName
        )}
      >
        IVA inclusa
      </span>
    </span>
  );
}
