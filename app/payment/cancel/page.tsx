import Link from "next/link";
import { XCircle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServiceClient } from "@/server/supabase";
import { formatDateTime } from "@/lib/format";

import { resumePaymentAction } from "./actions";

export const dynamic = "force-dynamic";

type CancelSearch = { session_id?: string | string[] };

export default async function PaymentCancelPage(props: {
  searchParams: Promise<CancelSearch>;
}) {
  const { session_id: rawSessionId } = await props.searchParams;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  if (!sessionId || !/^cs_/.test(sessionId)) {
    return <NotFoundView />;
  }

  const client = getServiceClient();
  const bookingRes = await client
    .from("bookings")
    .select(
      `
      id, status, amount_cents, people, cancelled_after_payment_at,
      events:event_id ( title, starts_at )
    `
    )
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (bookingRes.error || !bookingRes.data) {
    return <NotFoundView />;
  }
  const booking = bookingRes.data;

  // Edge cases where the cancel page is no longer the right surface:
  if (booking.status === "paid") {
    return (
      <Card className="border-emerald-300 bg-white">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl">Pagamento già confermato</CardTitle>
          <p className="text-sm text-muted-foreground">
            Risulta che questa prenotazione sia già stata pagata. Controlla la
            tua email per il riepilogo.
          </p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/">Torna al sito</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (booking.status !== "awaiting_payment") {
    return (
      <Card className="border-stone-300 bg-white">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl">Pagamento non disponibile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Questa prenotazione non è più in attesa di pagamento. Se hai
            ricevuto un link aggiornato via email, usa quello.
          </p>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/">Torna al sito</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const event = booking.events;

  return (
    <Card className="border-amber-300 bg-white">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <XCircle className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">Pagamento non completato</CardTitle>
        <p className="text-sm text-muted-foreground">
          Non abbiamo registrato alcun addebito. La tua prenotazione è ancora
          attiva: puoi riprovare quando vuoi.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {event ? (
          <div className="rounded-md border bg-muted/40 p-4 text-left">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Evento
            </p>
            <p className="font-semibold">{event.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.starts_at)}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Totale
            </p>
            <p className="text-sm font-semibold">
              {(booking.amount_cents / 100).toLocaleString("it-IT", {
                style: "currency",
                currency: "EUR",
              })}{" "}
              ({booking.people}{" "}
              {booking.people === 1 ? "persona" : "persone"})
            </p>
          </div>
        ) : null}

        <form action={resumePaymentAction}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <Button type="submit" className="w-full">
            Riprova il pagamento
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </form>

        <p className="text-[11px] text-muted-foreground">
          Verrai reindirizzato a una nuova pagina di pagamento Stripe. Se nel
          frattempo è scaduta la sessione precedente, ne creiamo una nuova
          automaticamente.
        </p>
      </CardContent>
    </Card>
  );
}

function NotFoundView() {
  return (
    <Card className="border-stone-300 bg-white">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl">Pagamento non trovato</CardTitle>
        <p className="text-sm text-muted-foreground">
          Non riusciamo a recuperare i dettagli del pagamento. Controlla la
          tua email per il link più aggiornato.
        </p>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/">Torna al sito</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
