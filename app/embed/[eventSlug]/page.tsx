import { notFound } from "next/navigation";

import { RequestForm } from "@/components/embed/request-form";
import { getPublishedEventBySlug } from "@/server/events/queries";

export const dynamic = "force-dynamic";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const event = await getPublishedEventBySlug(eventSlug);
  if (!event) notFound();

  return (
    <RequestForm
      event={{
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.starts_at,
        capacity: event.capacity,
        priceCents: event.price_cents,
      }}
    />
  );
}
