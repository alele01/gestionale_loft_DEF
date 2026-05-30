import { notFound } from "next/navigation";

import { RequestForm } from "@/components/embed/request-form";
import { getPublishedEventBySlug } from "@/server/events/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ embed?: string }>;

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventSlug: string }>;
  searchParams: SearchParams;
}) {
  const { eventSlug } = await params;
  const { embed } = await searchParams;
  const event = await getPublishedEventBySlug(eventSlug);
  if (!event) notFound();

  // ?embed=1 → inside an iframe: hide logo + event header to avoid
  // duplication with the host page.
  const compact = embed === "1";

  return (
    <RequestForm
      compact={compact}
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
