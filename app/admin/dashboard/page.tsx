import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
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
import { UnifiedStatusBadge } from "@/components/shared/unified-status-badge";
import { formatDateTime } from "@/lib/format";
import { deriveUnifiedStatus } from "@/lib/status";
import { requireAdmin } from "@/server/auth/require-admin";
import { listEventsWithCounters } from "@/server/events/queries";
import type { EventStatus } from "@/server/events/schema";
import { listLatestRequestsWithContext } from "@/server/requests/queries";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const identity = await requireAdmin();
  const [events, latest] = await Promise.all([
    listEventsWithCounters({ includeArchived: false }),
    listLatestRequestsWithContext(8),
  ]);

  const totals = events.reduce(
    (acc, e) => {
      acc.received += e.counters.requestsPending;
      acc.waitlisted += e.counters.requestsWaitlisted;
      acc.toPay +=
        e.counters.bookingsAwaitingCompletion +
        e.counters.bookingsAwaitingPayment;
      acc.paid += e.counters.bookingsPaid;
      acc.paidCancelled += e.counters.bookingsPaidCancelled;
      return acc;
    },
    { received: 0, waitlisted: 0, toPay: 0, paid: 0, paidCancelled: 0 }
  );

  const publishedCount = events.filter((e) => e.status === "published").length;
  const greetName = identity.user.email.split("@")[0];

  const cancelled = latest.filter(
    (row) => row.unifiedStatus === "paid_cancelled"
  );

  return (
    <>
      <PageHeader
        title={`Buongiorno, ${greetName}.`}
        description="Una panoramica veloce: eventi in corso e prenotazioni da gestire oggi. Tutti i prezzi sono IVA inclusa."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Eventi pubblicati"
          value={publishedCount}
          hint={`${events.length} eventi totali`}
          icon={CalendarDays}
          accent="info"
        />
        <StatCard
          label="Da valutare"
          value={totals.received}
          hint={
            totals.waitlisted > 0
              ? `${totals.waitlisted} in lista d'attesa`
              : "Richieste arrivate"
          }
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label="In attesa di pagamento"
          value={totals.toPay}
          hint="Accettate, link aperto"
          icon={ListChecks}
          accent="default"
        />
        <StatCard
          label="Pagate"
          value={totals.paid}
          hint={
            totals.paidCancelled > 0
              ? `${totals.paidCancelled} cancellate dopo`
              : undefined
          }
          icon={CheckCircle2}
          accent="success"
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Eventi
        </h2>
        {events.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-center text-sm text-muted-foreground">
              Nessun evento creato. Inizia da{" "}
              <Link href="/admin/events/new" className="underline">
                Nuovo evento
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const c = event.counters;
              const availableSeats = Math.max(0, event.capacity - c.paidPeople);
              return (
                <Card key={event.id} className="flex h-full flex-col">
                  <CardContent className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {formatDateTime(event.starts_at)}
                        </p>
                        <h3 className="text-base font-semibold leading-snug">
                          {event.title}
                        </h3>
                      </div>
                      <EventStatusBadge status={event.status as EventStatus} />
                    </div>
                    <CapacityBar
                      recap={{
                        capacity: event.capacity,
                        paidSeats: c.paidPeople,
                        toPaySeats: c.bookingsAwaitingPayment,
                        availableSeats,
                      }}
                    />
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <MiniStat label="Da valutare" value={c.requestsPending} />
                      <MiniStat label="Lista d'attesa" value={c.requestsWaitlisted} />
                      <MiniStat label="Rifiutate" value={c.requestsRejected} />
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
                      <div className="space-y-1">
                        <PriceLabel cents={event.price_cents} size="sm" />
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
            })}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ultime prenotazioni</CardTitle>
          <p className="text-xs text-muted-foreground">
            {totals.received > 0
              ? `Ci sono ${totals.received} richieste da valutare.`
              : "Nessuna richiesta in attesa di valutazione."}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {latest.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Nessuna richiesta ancora. Quando arriverà la prima la vedrai qui.
            </p>
          ) : (
            latest.map((row) => {
              const unified = deriveUnifiedStatus(
                { status: row.request.status },
                row.booking
              );
              return (
                <Link
                  key={row.request.id}
                  href={`/admin/prenotazioni/${row.request.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {row.request.requester_first_name}{" "}
                      {row.request.requester_last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.event.title} ·{" "}
                      {row.booking?.people ?? row.request.people} pers ·{" "}
                      {formatDateTime(row.request.submitted_at)}
                    </p>
                  </div>
                  <UnifiedStatusBadge status={unified} />
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>

      {cancelled.length > 0 ? (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-900">
              <AlertTriangle className="h-4 w-4" />
              Prenotazioni cancellate dopo il pagamento
            </CardTitle>
            <p className="text-xs text-rose-900/70">
              Restano pagate ai fini contabili e segnalate al commercialista
              nell&apos;export fiscale, ma l&apos;email post-evento è sospesa.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {cancelled.map((row) => (
              <Link
                key={row.request.id}
                href={`/admin/prenotazioni/${row.request.id}`}
                className="block rounded-md border bg-card px-3 py-2 transition-colors hover:bg-muted/30"
              >
                <p className="text-sm font-medium">
                  {row.request.requester_first_name}{" "}
                  {row.request.requester_last_name} · {row.event.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.booking?.cancelled_after_payment_reason ?? ""}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
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
