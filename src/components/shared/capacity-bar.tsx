import { cn } from "@/lib/utils";

type CapacityBarRecap = {
  capacity: number;
  paidSeats: number;
  toPaySeats: number;
  availableSeats: number;
};

type CapacityBarProps = {
  recap: CapacityBarRecap;
  className?: string;
};

export function CapacityBar({ recap, className }: CapacityBarProps) {
  const { capacity, paidSeats, toPaySeats } = recap;
  const paidPct = Math.min(100, (paidSeats / Math.max(1, capacity)) * 100);
  const unpaidPct = Math.min(
    100 - paidPct,
    (toPaySeats / Math.max(1, capacity)) * 100
  );

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {paidSeats}/{capacity} posti pagati
        </span>
        <span>{recap.availableSeats} disponibili</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${paidPct}%` }}
          aria-label="Posti pagati"
        />
        <div
          className="h-full bg-amber-400"
          style={{ width: `${unpaidPct}%` }}
          aria-label="In attesa di pagamento"
        />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <LegendDot className="bg-emerald-500" label={`Pagati ${paidSeats}`} />
        <LegendDot
          className="bg-amber-400"
          label={`In attesa di pagamento ${toPaySeats}`}
        />
        <LegendDot className="bg-muted" label={`Liberi ${recap.availableSeats}`} />
      </div>
    </div>
  );
}

function LegendDot({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-2 rounded-full", className)} />
      {label}
    </span>
  );
}
