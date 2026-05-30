import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Pencil, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CapacityBar } from "@/components/shared/capacity-bar";
import { PriceLabel } from "@/components/shared/price-label";
import { EventStatusBadge } from "@/components/shared/status-badge";
import { EmbedCodeBlock } from "@/components/admin/embed-code-block";
import { EventDetailActions } from "@/components/admin/event-detail-actions";
import { RequestsBoard } from "@/components/admin/requests-board";
import { DataField } from "@/components/shared/data-field";
import { formatDateTime } from "@/lib/format";
import { toRequestListItem } from "@/lib/request-list";
import { requireAdmin } from "@/server/auth/require-admin";
import { getAppBaseUrl } from "@/server/env";
import {
  getEventById,
  getEventCounters,
} from "@/server/events/queries";
import { listRequestsForEvent } from "@/server/requests/queries";
import type { EventStatus } from "@/server/events/schema";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireAdmin();
  const { eventId } = await params;
  const event = await getEventById(eventId);
  if (!event) notFound();

  const counters = await getEventCounters(event.id);
  const eventRequests = await listRequestsForEvent(event.id);
  const requestItems = eventRequests.map(toRequestListItem);
  const availableSeats = Math.max(0, event.capacity - counters.paidPeople);
  const status = event.status as EventStatus;
  const isDraft = status === "draft";
  const isArchived = status === "archived";

  const embedUrl = `${getAppBaseUrl()}/embed/${event.slug}`;
  const iframeSrc = `${embedUrl}?embed=1`;
  const embedOrigin = new URL(embedUrl).origin;
  const iframeId = `cooker-loft-${event.slug}`;
  const iframeCode = `<iframe
  id="${iframeId}"
  src="${iframeSrc}"
  title="${event.title} — Prenota"
  width="100%"
  height="720"
  scrolling="no"
  style="border:0;width:100%;max-width:680px;display:block;margin:0 auto;overflow:hidden"
  loading="lazy">
</iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.origin !== "${embedOrigin}") return;
    var d = e.data;
    if (!d || d.type !== "cooker-loft-embed:height") return;
    var f = document.getElementById("${iframeId}");
    if (f && f.contentWindow === e.source) {
      f.style.height = d.height + "px";
    }
  });
</script>`;

  return (
    <>
      <PageHeader
        title={event.title}
        description={event.description ?? undefined}
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Eventi", href: "/admin/events" },
          { label: event.title },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {!isArchived ? (
              <Button asChild variant="outline">
                <Link href={`/admin/events/${event.id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  {isDraft ? "Modifica" : "Modifica capienza"}
                </Link>
              </Button>
            ) : null}
            <EventDetailActions eventId={event.id} status={status} />
          </div>
        }
      />

      {isDraft ? (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-amber-900">
              Questo evento è in bozza.
            </p>
            <p className="text-xs text-amber-900/80">
              Finché resta in bozza puoi modificare tutti i dettagli. Una volta
              pubblicato non sarà più modificabile.
            </p>
          </CardContent>
        </Card>
      ) : isArchived ? (
        <Card className="border-slate-300 bg-slate-50/60">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">Evento archiviato.</p>
            <p className="text-xs text-muted-foreground">
              Non riceve più richieste. Le prenotazioni esistenti restano consultabili.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-300 bg-slate-50/60">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">Evento pubblicato.</p>
            <p className="text-xs text-muted-foreground">
              Puoi ancora modificare la capienza (con &quot;Modifica
              capienza&quot;). Per cambiare prezzo, data o descrizione, archivia
              questo evento e creane uno nuovo.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Dettagli evento</CardTitle>
              <EventStatusBadge status={status} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DataField
              label="Data e ora"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDateTime(event.starts_at)}
                </span>
              }
            />
            <DataField
              label="Durata"
              value={event.duration_min ? `${event.duration_min} minuti` : "—"}
            />
            <DataField
              label="Capienza"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {event.capacity} posti
                </span>
              }
            />
            <DataField
              label="Prezzo per persona"
              value={<PriceLabel cents={event.price_cents} size="sm" />}
            />
            <DataField
              label="Luogo"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Cooker Loft, Torino
                </span>
              }
            />
            <DataField label="Slug" value={<span className="font-mono">{event.slug}</span>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riepilogo posti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CapacityBar
              recap={{
                capacity: event.capacity,
                paidSeats: counters.paidPeople,
                toPaySeats:
                  counters.bookingsAwaitingCompletion +
                  counters.bookingsAwaitingPayment,
                availableSeats,
              }}
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Posti pagati" value={counters.paidPeople} />
              <Stat
                label="In attesa di pagamento"
                value={
                  counters.bookingsAwaitingCompletion +
                  counters.bookingsAwaitingPayment
                }
              />
              <Stat label="Da valutare" value={counters.requestsPending} />
              <Stat label="Lista d'attesa" value={counters.requestsWaitlisted} />
              <Stat label="Rifiutati" value={counters.requestsRejected} />
              <Stat label="Disponibili" value={availableSeats} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              I posti disponibili si calcolano sottraendo solo le prenotazioni
              pagate.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Link e codice da incollare sul sito
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isDraft
              ? "Il link sarà attivo automaticamente quando pubblichi l'evento."
              : "Indirizzo del modulo pubblico e snippet già pronto per WordPress."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <EmbedCodeBlock label="Link al modulo" value={embedUrl} />
          <EmbedCodeBlock label="Codice da incollare" value={iframeCode} />
          {!isDraft && !isArchived ? (
            <div className="lg:col-span-2">
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/embed/${event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apri anteprima
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">
            Prenotazioni dell&apos;evento
          </h2>
          <p className="text-sm text-muted-foreground">
            Tutte le richieste arrivate per questo evento. Filtra per stato e
            clicca una riga per aprire il dettaglio.
          </p>
        </div>
        <RequestsBoard
          items={requestItems}
          showEvent={false}
          emptyLabel="Nessuna prenotazione per questo evento."
        />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
