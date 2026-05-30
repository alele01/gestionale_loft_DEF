"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CapacityBar } from "@/components/shared/capacity-bar";
import { PriceLabel } from "@/components/shared/price-label";
import { EventStatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/format";
import type { EventStatus } from "@/server/events/schema";

export type EventListItem = {
  id: string;
  title: string;
  startsAt: string;
  capacity: number;
  priceCents: number;
  status: EventStatus;
  paidPeople: number;
  awaitingPayment: number;
};

export function EventsList({ events }: { events: EventListItem[] }) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.title.toLowerCase().includes(q));
  }, [events, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca evento per nome…"
          className="pl-9"
          aria-label="Cerca eventi per nome"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nessun evento trovato per &quot;{query}&quot;.
          </CardContent>
        </Card>
      ) : (
        filtered.map((event) => {
          const availableSeats = Math.max(0, event.capacity - event.paidPeople);
          return (
            <Card key={event.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{event.title}</h3>
                    <EventStatusBadge status={event.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.startsAt)}
                  </p>
                  <div className="max-w-md">
                    <CapacityBar
                      recap={{
                        capacity: event.capacity,
                        paidSeats: event.paidPeople,
                        toPaySeats: event.awaitingPayment,
                        availableSeats,
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <PriceLabel cents={event.priceCents} />
                  <p className="text-xs text-muted-foreground">
                    <Users className="mr-1 inline h-3 w-3" />
                    {event.capacity} posti
                  </p>
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
        })
      )}
    </div>
  );
}
