import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaymentStatusPoller } from "@/components/payment/payment-status-poller";

import { getServiceClient } from "@/server/supabase";
import { retrieveCheckoutSession } from "@/server/stripe";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type SuccessSearch = { session_id?: string | string[] };

export default async function PaymentSuccessPage(props: {
  searchParams: Promise<SuccessSearch>;
}) {
  const { session_id: rawSessionId } = await props.searchParams;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  if (!sessionId || !/^cs_/.test(sessionId)) {
    return <UnknownState reason="missing_session" />;
  }

  // Validate that the session id we received matches a real Stripe session
  // we have on record. This protects against random `session_id=` probes.
  const client = getServiceClient();
  const bookingRes = await client
    .from("bookings")
    .select(
      `
      id, status, amount_cents, amount_paid_cents, people, paid_at,
      events:event_id ( title, starts_at )
    `
    )
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (bookingRes.error) {
    return <UnknownState reason="lookup_error" />;
  }
  if (!bookingRes.data) {
    return <UnknownState reason="not_found" />;
  }
  const booking = bookingRes.data;

  // Best-effort: confirm the session is real on Stripe. Failures here are
  // logged but do not stop the page (the booking row is the authoritative
  // signal).
  try {
    await retrieveCheckoutSession(sessionId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[payment/success] retrieveCheckoutSession failed", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (booking.status === "paid") {
    return <PaidView booking={booking} />;
  }

  // Webhook race: Stripe redirected the user back faster than the webhook
  // landed (or the webhook is still in-flight). Poll the booking row every
  // 3s for ~30s.
  return (
    <Card className="border-amber-300 bg-white">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <CardTitle className="text-xl">Pagamento in elaborazione</CardTitle>
        <p className="text-sm text-muted-foreground">
          Stiamo confermando il pagamento con Stripe. Di solito è questione di
          pochi secondi: questa pagina si aggiornerà automaticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Se la pagina non si aggiorna entro un paio di minuti, controlla la
          tua casella email: la conferma definitiva arriverà via email anche
          se chiudi questa scheda.
        </p>
        <PaymentStatusPoller
          bookingId={booking.id}
          intervalMs={3000}
          timeoutMs={30000}
        />
      </CardContent>
    </Card>
  );
}

function PaidView({
  booking,
}: {
  booking: {
    id: string;
    amount_paid_cents: number | null;
    people: number;
    paid_at: string | null;
    events: { title: string; starts_at: string } | null;
  };
}) {
  const event = booking.events;
  return (
    <Card className="border-emerald-300 bg-white">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">Pagamento confermato</CardTitle>
        <p className="text-sm text-muted-foreground">
          Grazie! La tua prenotazione è confermata. Ti abbiamo inviato
          un&apos;email con il riepilogo.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {event ? (
          <div className="rounded-md border bg-muted/40 p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Evento
            </p>
            <p className="font-semibold">{event.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.starts_at)}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Partecipanti
            </p>
            <p className="text-sm">{booking.people}</p>
            {typeof booking.amount_paid_cents === "number" ? (
              <>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Importo pagato
                </p>
                <p className="text-sm font-semibold">
                  {(booking.amount_paid_cents / 100).toLocaleString("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/">Torna al sito</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UnknownState({ reason }: { reason: string }) {
  return (
    <Card className="border-stone-300 bg-white">
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="text-xl">Pagamento non trovato</CardTitle>
        <p className="text-sm text-muted-foreground">
          Non riusciamo a verificare questo pagamento. Se hai appena
          completato il checkout, riceverai comunque la conferma via email.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <p className="font-mono text-[10px]">stato: {reason}</p>
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline">
            <Link href="/">Torna al sito</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
