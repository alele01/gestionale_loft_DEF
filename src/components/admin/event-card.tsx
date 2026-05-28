import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CapacityBar } from "@/components/shared/capacity-bar";
import { PriceLabel } from "@/components/shared/price-label";
import { EventStatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/format";
import type { EventRecord } from "@/lib/mock/types";
import type { CapacityRecap } from "@/lib/mock/store";

type EventCardProps = {
  event: EventRecord;
  recap: CapacityRecap;
};

export function EventCard({ event, recap }: EventCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {formatDateTime(event.startsAt)}
            </p>
            <h3 className="text-base font-semibold leading-snug">
              {event.title}
            </h3>
          </div>
          <EventStatusBadge status={event.status} />
        </div>

        <CapacityBar recap={recap} />

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <MiniStat label="Da valutare" value={recap.receivedSeats} />
          <MiniStat label="Lista d'attesa" value={recap.waitlistedSeats} />
          <MiniStat label="Rifiutate" value={recap.rejectedSeats} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
          <div className="space-y-1">
            <PriceLabel cents={event.priceCents} size="sm" />
            <p className="text-[11px] text-muted-foreground">
              <Users className="mr-1 inline h-3 w-3" />
              {event.capacity} posti totali
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/events/${event.id}`}>
              Apri evento
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
