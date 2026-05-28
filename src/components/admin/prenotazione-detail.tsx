"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  Info,
  Mail,
  Phone,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { UnifiedStatusBadge } from "@/components/shared/unified-status-badge";
import { PriceLabel } from "@/components/shared/price-label";
import { DataField } from "@/components/shared/data-field";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  DeletePrenotazioneSection,
  PrenotazioneActions,
} from "./prenotazione-actions";
import { PrenotazioneTimeline } from "./prenotazione-timeline";
import {
  BookingConsentSummary,
  RequestConsentSummary,
} from "./consent-summary";
import { FiscalProfileCard } from "./fiscal-profile-card";

import { formatDateTime } from "@/lib/format";
import type { Prenotazione } from "@/lib/mock/store";

export function PrenotazioneDetail({ p }: { p: Prenotazione }) {
  const { request, booking, event, audit } = p;
  const isUnpaid = p.unifiedStatus === "to_pay";
  const hasBooking = booking != null;

  return (
    <>
      <PageHeader
        title={`${request.firstName} ${request.lastName}`}
        description={`Per "${event.title}" · ${formatDateTime(event.startsAt)}`}
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Eventi", href: "/admin/events" },
          { label: event.title, href: `/admin/events/${event.id}` },
          { label: `${request.firstName} ${request.lastName}` },
        ]}
        actions={<UnifiedStatusBadge status={p.unifiedStatus} />}
      />

      {p.isCancelledAfterPayment ? (
        <Card className="border-rose-300 bg-rose-50/40">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-700" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-rose-900">
                Prenotazione cancellata dopo il pagamento
              </p>
              <p className="text-xs text-rose-900/80">
                Ai fini contabili la prenotazione resta pagata.
                L&apos;email post-evento di richiesta recensione è sospesa.
                Nessun rimborso è stato eseguito automaticamente.
              </p>
              {booking?.cancelledAfterPaymentReason ? (
                <p className="text-xs text-rose-900/80">
                  <span className="opacity-70">Motivo:</span>{" "}
                  {booking.cancelledAfterPaymentReason}
                </p>
              ) : null}
              {booking?.cancelledAfterPaymentAt ? (
                <p className="text-xs text-rose-900/80">
                  Registrata il{" "}
                  {formatDateTime(booking.cancelledAfterPaymentAt)}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {p.unifiedStatus === "received" ||
      p.unifiedStatus === "waitlisted" ||
      p.unifiedStatus === "to_pay" ||
      p.unifiedStatus === "paid" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Azioni disponibili</CardTitle>
            <p className="text-xs text-muted-foreground">
              Le azioni si aggiornano in base allo stato corrente della
              prenotazione.
            </p>
          </CardHeader>
          <CardContent>
            <PrenotazioneActions p={p} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Dati prenotazione
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DataField
              label="Evento"
              value={
                <Link
                  href={`/admin/events/${event.id}`}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  {event.title}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            />
            <DataField
              label="Data evento"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDateTime(event.startsAt)}
                </span>
              }
            />
            <DataField
              label="Persone"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {booking?.people ?? request.people}
                </span>
              }
            />
            <DataField
              label={
                booking?.status === "paid" ? "Importo pagato" : "Importo previsto"
              }
              value={
                <PriceLabel
                  cents={booking?.amountCents ?? request.people * event.priceCents}
                  size="sm"
                />
              }
            />
            <DataField
              label="Allergie / intolleranze"
              value={booking?.dietaryNotes ?? request.dietaryNotes}
              className="sm:col-span-2"
            />
            <DataField
              label="Occasione speciale"
              value={booking?.specialOccasion ?? request.specialOccasion}
              className="sm:col-span-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Richiedente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DataField
              label="Nome"
              value={`${request.firstName} ${request.lastName}`}
            />
            <DataField
              label="Email"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <a
                    className="hover:underline"
                    href={`mailto:${request.email}`}
                  >
                    {request.email}
                  </a>
                </span>
              }
            />
            <DataField
              label="Telefono"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a className="hover:underline" href={`tel:${request.phone}`}>
                    {request.phone}
                  </a>
                </span>
              }
            />
            <DataField
              label="Ricevuta il"
              value={formatDateTime(request.submittedAt)}
            />
            {request.notes ? (
              <DataField label="Nota libera" value={request.notes} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {hasBooking ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                <CreditCard className="mr-1 inline h-4 w-4" />
                Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <DataField
                label="Stato pagamento"
                value={
                  booking?.status === "paid"
                    ? booking.paidAt
                      ? `Pagato il ${formatDateTime(booking.paidAt)}`
                      : "Pagato"
                    : booking?.status === "awaiting_payment"
                      ? "In attesa di pagamento"
                      : booking?.status === "awaiting_completion"
                        ? "In attesa di completamento"
                        : booking?.status === "void"
                          ? "Prenotazione chiusa"
                          : "—"
                }
              />
              <DataField
                label="Importo"
                value={
                  booking?.amountPaidCents != null ? (
                    <PriceLabel cents={booking.amountPaidCents} size="sm" />
                  ) : booking ? (
                    <PriceLabel cents={booking.amountCents} size="sm" />
                  ) : (
                    "—"
                  )
                }
              />
              {booking?.completionDeadlineAt && isUnpaid ? (
                <DataField
                  label="Scadenza del link"
                  value={formatDateTime(booking.completionDeadlineAt)}
                  className="sm:col-span-2"
                />
              ) : null}
              {isUnpaid && booking ? (
                <div className="sm:col-span-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/complete/${booking.completionToken}`}>
                      Vedi la pagina di completamento del richiedente
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stato operativo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DataField
                label="Email post-evento"
                value={
                  booking?.reviewEmailSentAt
                    ? `Inviata il ${formatDateTime(booking.reviewEmailSentAt)}`
                    : p.isCancelledAfterPayment
                      ? "Sospesa per cancellazione"
                      : booking?.status === "paid"
                        ? "Programmata per il giorno dopo l'evento"
                        : "Non applicabile"
                }
              />
              <DataField
                label="In export fiscale"
                value={
                  booking?.status === "paid"
                    ? p.isCancelledAfterPayment
                      ? "Sì, segnalata al commercialista"
                      : "Sì"
                    : "No"
                }
              />
              {booking?.revision && booking.revision > 1 ? (
                <DataField
                  label="Revisione"
                  value={`Modificata ${booking.revision - 1} ${
                    booking.revision - 1 === 1 ? "volta" : "volte"
                  } prima del pagamento`}
                />
              ) : null}
              {booking?.origin === "waitlist" ? (
                <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mr-1 inline h-3 w-3" />
                  Origine: accettata dalla lista d&apos;attesa.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {hasBooking && booking?.fiscalProfile ? (
        <FiscalProfileCard profile={booking.fiscalProfile} />
      ) : null}

      <RequestConsentSummary consents={request.consents} />

      {booking?.consents ? (
        <BookingConsentSummary consents={booking.consents} />
      ) : isUnpaid ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consensi al completamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Il richiedente non ha ancora completato la pagina di
              completamento. Le dichiarazioni legali verranno raccolte al
              momento dell&apos;invio.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <PrenotazioneTimeline entries={audit} />

      <DeletePrenotazioneSection p={p} />
    </>
  );
}
