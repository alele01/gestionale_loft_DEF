import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { EventForm } from "@/components/admin/event-form";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/auth/require-admin";
import { getEventById } from "@/server/events/queries";
import type { EventStatus } from "@/server/events/schema";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireAdmin();
  const { eventId } = await params;
  const event = await getEventById(eventId);
  if (!event) notFound();

  const status = event.status as EventStatus;

  return (
    <>
      <PageHeader
        title={`Modifica · ${event.title}`}
        description={
          status === "draft"
            ? "Bozza modificabile. Puoi salvare e tornare a lavorarla, oppure pubblicarla dal dettaglio."
            : "Questo evento è già pubblicato o archiviato e non si può più modificare."
        }
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Eventi", href: "/admin/events" },
          { label: event.title, href: `/admin/events/${event.id}` },
          { label: "Modifica" },
        ]}
        actions={
          <Button asChild variant="ghost">
            <Link href={`/admin/events/${event.id}`}>Torna al dettaglio</Link>
          </Button>
        }
      />
      <EventForm
        mode="edit"
        initial={{
          id: event.id,
          title: event.title,
          description: event.description,
          slug: event.slug,
          startsAt: event.starts_at,
          durationMin: event.duration_min,
          capacity: event.capacity,
          priceCents: event.price_cents,
          vatRateBps: event.vat_rate_bps,
          status,
        }}
      />
    </>
  );
}
