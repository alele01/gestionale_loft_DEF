import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EventsList, type EventListItem } from "@/components/admin/events-list";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  availableSeatsForDisplay,
  awaitingPaymentPeople,
  listEventsWithCounters,
} from "@/server/events/queries";
import type { EventStatus } from "@/server/events/schema";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  await requireAdmin();
  const events = await listEventsWithCounters({ includeArchived: false });

  const items: EventListItem[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.starts_at,
    capacity: event.capacity,
    priceCents: event.price_cents,
    status: event.status as EventStatus,
    paidPeople: event.counters.paidPeople,
    awaitingPaymentPeople: awaitingPaymentPeople(event.counters),
    availableSeats: availableSeatsForDisplay(event.capacity, event.counters),
  }));

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
        <EventsList events={items} />
      )}
    </>
  );
}
