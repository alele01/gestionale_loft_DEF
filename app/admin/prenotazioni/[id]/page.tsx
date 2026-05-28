import Link from "next/link";
import { notFound } from "next/navigation";
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
import { PrenotazioneDetailActions } from "@/components/admin/prenotazione-detail-actions";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/auth/require-admin";
import { getRequestContext } from "@/server/requests/queries";

export const dynamic = "force-dynamic";

export default async function PrenotazioneDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const ctx = await getRequestContext(id);
  if (!ctx) notFound();

  const { request, booking, event, fiscal, unifiedStatus } = ctx;
  const isCancelledAfterPayment =
    booking?.status === "paid" && booking.cancelled_after_payment_at !== null;

  const peopleNow = booking?.people ?? request.people;
  const amountNow = booking?.amount_cents ?? request.people * event.price_cents;

  return (
    <>
      <PageHeader
        title={`${request.requester_first_name} ${request.requester_last_name}`}
        description={`Per "${event.title}" · ${formatDateTime(event.starts_at)}`}
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Eventi", href: "/admin/events" },
          { label: event.title, href: `/admin/events/${event.id}` },
          {
            label: `${request.requester_first_name} ${request.requester_last_name}`,
          },
        ]}
        actions={<UnifiedStatusBadge status={unifiedStatus} />}
      />

      {isCancelledAfterPayment ? (
        <Card className="border-rose-300 bg-rose-50/40">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-700" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-rose-900">
                Prenotazione cancellata dopo il pagamento
              </p>
              <p className="text-xs text-rose-900/80">
                Ai fini contabili la prenotazione resta pagata. L&apos;email
                post-evento di richiesta recensione è sospesa. Nessun rimborso
                viene eseguito automaticamente.
              </p>
              {booking?.cancelled_after_payment_reason ? (
                <p className="text-xs text-rose-900/80">
                  <span className="opacity-70">Motivo:</span>{" "}
                  {booking.cancelled_after_payment_reason}
                </p>
              ) : null}
              {booking?.cancelled_after_payment_at ? (
                <p className="text-xs text-rose-900/80">
                  Registrata il{" "}
                  {formatDateTime(booking.cancelled_after_payment_at)}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <PrenotazioneDetailActions
        requestId={request.id}
        bookingId={booking?.id ?? null}
        unifiedStatus={unifiedStatus}
        bookingStatus={booking?.status ?? null}
        currentPeople={peopleNow}
        currentDietaryNotes={booking?.dietary_notes ?? request.dietary_notes}
        currentSpecialOccasion={
          booking?.special_occasion ?? request.special_occasion
        }
        isCancelledAfterPayment={isCancelledAfterPayment}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Dati prenotazione</CardTitle>
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
                  {formatDateTime(event.starts_at)}
                </span>
              }
            />
            <DataField
              label="Persone"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {peopleNow}
                </span>
              }
            />
            <DataField
              label={
                booking?.status === "paid" ? "Importo pagato" : "Importo previsto"
              }
              value={<PriceLabel cents={amountNow} size="sm" />}
            />
            <DataField
              label="Allergie / intolleranze"
              value={booking?.dietary_notes ?? request.dietary_notes}
              className="sm:col-span-2"
            />
            <DataField
              label="Occasione speciale"
              value={booking?.special_occasion ?? request.special_occasion}
              className="sm:col-span-2"
            />
            {request.notes ? (
              <DataField
                label="Nota libera del richiedente"
                value={request.notes}
                className="sm:col-span-2"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Richiedente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DataField
              label="Nome"
              value={`${request.requester_first_name} ${request.requester_last_name}`}
            />
            <DataField
              label="Email"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <a
                    className="hover:underline"
                    href={`mailto:${request.requester_email}`}
                  >
                    {request.requester_email}
                  </a>
                </span>
              }
            />
            <DataField
              label="Telefono"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a
                    className="hover:underline"
                    href={`tel:${request.requester_phone}`}
                  >
                    {request.requester_phone}
                  </a>
                </span>
              }
            />
            <DataField
              label="Ricevuta il"
              value={formatDateTime(request.submitted_at)}
            />
            {request.decision_reason ? (
              <DataField
                label="Nota decisione"
                value={request.decision_reason}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {booking ? (
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
                value={paymentStatusLabel(booking)}
              />
              <DataField
                label="Importo"
                value={
                  booking.amount_paid_cents != null ? (
                    <PriceLabel cents={booking.amount_paid_cents} size="sm" />
                  ) : (
                    <PriceLabel cents={booking.amount_cents} size="sm" />
                  )
                }
              />
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
                  booking.review_email_sent_at
                    ? `Inviata il ${formatDateTime(booking.review_email_sent_at)}`
                    : isCancelledAfterPayment
                      ? "Sospesa per cancellazione"
                      : booking.status === "paid"
                        ? "Programmata per il giorno dopo l'evento"
                        : "Non applicabile"
                }
              />
              <DataField
                label="In export fiscale"
                value={
                  booking.status === "paid"
                    ? isCancelledAfterPayment
                      ? "Sì, segnalata al commercialista"
                      : "Sì"
                    : "No"
                }
              />
              {booking.revision > 1 ? (
                <DataField
                  label="Revisione"
                  value={`Modificata ${booking.revision - 1} ${
                    booking.revision - 1 === 1 ? "volta" : "volte"
                  } prima del pagamento`}
                />
              ) : null}
              {booking.origin === "waitlist" ? (
                <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="mr-1 inline h-3 w-3" />
                  Origine: accettata dalla lista d&apos;attesa.
                </p>
              ) : null}
              <StripeSessionBlock sessionId={booking.stripe_session_id} />
              {booking.stripe_payment_intent_id ? (
                <DataField
                  label="Stripe Payment Intent"
                  value={booking.stripe_payment_intent_id}
                  mono
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {fiscal ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dati fiscali</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DataField label="Tipo" value={fiscal.kind === "company" ? "Azienda" : "Privato"} />
            <DataField label="Nominativo / Ragione sociale" value={fiscal.legal_name} />
            {fiscal.tax_code ? (
              <DataField label="Codice fiscale" value={fiscal.tax_code} mono />
            ) : null}
            {fiscal.vat_number ? (
              <DataField label="Partita IVA" value={fiscal.vat_number} mono />
            ) : null}
            <DataField
              label="Indirizzo"
              value={`${fiscal.address_street}, ${fiscal.address_zip} ${fiscal.address_city}${fiscal.address_province ? ` (${fiscal.address_province})` : ""}, ${fiscal.address_country}`}
              className="sm:col-span-2"
            />
            {fiscal.sdi_code ? (
              <DataField label="SDI" value={fiscal.sdi_code} mono />
            ) : null}
            {fiscal.pec_email ? (
              <DataField label="PEC" value={fiscal.pec_email} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {booking?.consents ? (
        <ConsentsCard consents={booking.consents as ConsentsJson} />
      ) : null}
    </>
  );
}

type ConsentsJson = {
  completed_at?: string;
  image_use_choice?: "accept" | "decline";
  participants?: {
    kind?: "only_me" | "with_others";
    other_participants_names?: string | null;
    allergies_present?: "yes" | "no";
    allergies_details?: string | null;
    consent_representative_at?: string | null;
    consent_inform_others_at?: string | null;
  };
  minors?: {
    included?: "yes" | "no";
    names?: string | null;
    guardian_name?: string | null;
    allergies_present?: "yes" | "no" | null;
    allergies_confirmed_in_request?: boolean | null;
    consent_parental_at?: string | null;
    consent_image_use_at?: string | null;
  };
};

function ConsentsCard({ consents }: { consents: ConsentsJson }) {
  const p = consents.participants;
  const m = consents.minors;
  const multi = p?.kind === "with_others";
  const minorsIncluded = m?.included === "yes";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Partecipanti e consensi (raccolti al completamento)
        </CardTitle>
        {consents.completed_at ? (
          <p className="text-xs text-muted-foreground">
            Modulo completato il {formatDateTime(consents.completed_at)}.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <DataField
          label="Tipo prenotazione"
          value={multi ? "Referente + altri partecipanti" : "Solo il richiedente"}
        />
        <DataField
          label="Consenso immagine (referente)"
          value={consents.image_use_choice === "accept" ? "Sì" : "No"}
        />
        {multi && p?.other_participants_names ? (
          <DataField
            label="Altri partecipanti"
            value={p.other_participants_names}
            className="sm:col-span-2"
          />
        ) : null}
        {p?.allergies_present === "yes" && p?.allergies_details ? (
          <DataField
            label="Allergie / intolleranze dichiarate"
            value={p.allergies_details}
            className="sm:col-span-2"
          />
        ) : (
          <DataField
            label="Allergie / intolleranze"
            value="Nessuna dichiarata"
            className="sm:col-span-2"
          />
        )}
        <DataField
          label="Minori inclusi"
          value={minorsIncluded ? "Sì" : "No"}
        />
        {minorsIncluded ? (
          <>
            <DataField
              label="Nome/i del minore/i"
              value={m?.names ?? "—"}
              className="sm:col-span-2"
            />
            <DataField
              label="Genitore/tutore responsabile"
              value={m?.guardian_name ?? "—"}
              className="sm:col-span-2"
            />
            <DataField
              label="Allergie del minore"
              value={
                m?.allergies_present === "yes"
                  ? m?.allergies_confirmed_in_request
                    ? "Sì — comprese fra quelle indicate in fase di richiesta"
                    : "Sì (conferma non registrata)"
                  : "Nessuna dichiarata"
              }
              className="sm:col-span-2"
            />
            <DataField
              label="Consenso immagine minore"
              value={m?.consent_image_use_at ? "Sì" : "No"}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StripeSessionBlock({
  sessionId,
}: {
  sessionId: string | null;
}) {
  if (!sessionId) return null;
  if (sessionId.startsWith("placeholder_")) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <Info className="mr-1 inline h-3 w-3" />
        Sessione placeholder (legacy, prima dell&apos;integrazione Stripe).
        Nessun link da seguire sul dashboard.
      </p>
    );
  }
  // cs_test_... → test dashboard; cs_live_... → live dashboard.
  const isTest = sessionId.startsWith("cs_test_");
  const dashboardUrl = isTest
    ? `https://dashboard.stripe.com/test/checkout/sessions/${sessionId}`
    : `https://dashboard.stripe.com/checkout/sessions/${sessionId}`;
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-xs">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <CreditCard className="h-3 w-3" />
        Stripe Checkout Session
        {isTest ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900">
            test
          </span>
        ) : null}
      </div>
      <code className="block break-all font-mono text-[11px]">{sessionId}</code>
      <a
        href={dashboardUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
      >
        Apri su Stripe Dashboard
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}

function paymentStatusLabel(booking: { status: string; paid_at: string | null }) {
  if (booking.status === "paid") {
    return booking.paid_at
      ? `Pagato il ${formatDateTime(booking.paid_at)}`
      : "Pagato";
  }
  if (booking.status === "awaiting_payment") return "In attesa di pagamento";
  if (booking.status === "awaiting_completion") return "In attesa di completamento";
  if (booking.status === "void") return "Prenotazione chiusa";
  if (booking.status === "expired") return "Scaduta";
  return "—";
}
