import Link from "next/link";
import { ArrowRight, Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CapacityBar } from "@/components/shared/capacity-bar";
import { PriceLabel } from "@/components/shared/price-label";
import { EventStatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth/require-admin";
import { listEventsWithCounters } from "@/server/events/queries";
import type { EventStatus } from "@/server/events/schema";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  await requireAdmin();
  const events = await listEventsWithCounters({ includeArchived: false });

  return (
    <>
      <PageHeader
        title="Eventi"
        description="Crea e gestisci gli eventi. Da qui prendi il link e il codice da incollare sul sito."
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Eventi" },
        ]}
        actions={
          <Button asChild>
            <Link href="/admin/events/new">
              <Plus className="h-4 w-4" />
              Nuovo evento
            </Link>
          </Button>
        }
      />

      <div className="space-y-3">
        {events.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Non hai ancora creato eventi.
              </p>
              <Button asChild>
                <Link href="/admin/events/new">
                  <Plus className="h-4 w-4" />
                  Crea il primo evento
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => {
            const c = event.counters;
            const availableSeats = Math.max(
              0,
              event.capacity - c.bookingsPaid
            );
            return (
              <Card key={event.id}>
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{event.title}</h3>
                      <EventStatusBadge status={event.status as EventStatus} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.starts_at)}
                    </p>
                    <div className="max-w-md">
                      <CapacityBar
                        recap={{
                          capacity: event.capacity,
                          paidSeats: c.paidPeople,
                          toPaySeats: c.bookingsAwaitingPayment,
                          availableSeats,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <PriceLabel cents={event.price_cents} />
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
    </>
  );
}
