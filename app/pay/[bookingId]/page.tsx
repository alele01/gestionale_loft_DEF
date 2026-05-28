import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookingStateError,
  recreateCheckoutSession,
} from "@/modules/booking-state";
import { checkRateLimit, getClientIp } from "@/server/rate-limit/check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /pay/[bookingId] — payment-retry landing page.
 *
 * Entry point used by the E7 retry email when a previous Stripe Checkout
 * attempt expired or its payment intent failed. The booking has already
 * been completed (fiscal profile + consents stored), so there is no form
 * to re-submit: we simply call `recreateCheckoutSession` and redirect
 * straight to a fresh Stripe Checkout URL.
 *
 * Security:
 *   - The `bookingId` is a UUID v4 (~122 bits of entropy) and acts as
 *     the access credential. We do not require a separate token because
 *     `recreateCheckoutSession` enforces the booking is in
 *     `awaiting_payment` and not cancelled — there is no other action
 *     attackable through this surface.
 *   - The thrown `NEXT_REDIRECT` from `redirect()` MUST escape this
 *     function; we keep it outside any try/catch so Next handles it.
 *
 * UX:
 *   - Happy path: 1 round-trip then 302 → Stripe. The user never sees
 *     this page.
 *   - Booking already paid → "già pagata" card with link to /.
 *   - Booking voided / cancelled → "non più disponibile" card.
 *   - UUID malformed → 404-like card.
 */
export default async function PaymentRetryPage(props: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await props.params;

  if (!isValidUuid(bookingId)) {
    return <NotFoundView />;
  }

  // Anti-abuse soft throttle on Stripe session recreation. The cap is
  // PER (IP + booking) — sharing the same booking on many IPs is fine
  // (the same user from phone + laptop), and sharing the same IP on
  // many bookings is also fine. Only the same person hammering the
  // same booking link gets slowed down.
  //
  //   - 60 hits / minute per (IP, booking) → 1/sec, far above any
  //     legitimate user flow.
  const ip = await getClientIp();
  const limit = await checkRateLimit({
    action: "pay_landing",
    identifier: `ip:${ip}:b:${bookingId}`,
    windowSeconds: 60,
    maxHits: 60,
  });
  if (!limit.allowed) {
    return <TooManyRequestsView />;
  }

  let checkoutUrl: string | null = null;
  let errorView: React.ReactNode = null;

  try {
    const result = await recreateCheckoutSession({
      bookingId,
      actor: { type: "representative" },
    });
    checkoutUrl = result.checkoutUrl;
  } catch (err) {
    if (err instanceof BookingStateError) {
      errorView = renderErrorForState(err);
    } else {
      // eslint-disable-next-line no-console
      console.error("[pay/[bookingId]] recreate failed", err);
      errorView = <GenericErrorView />;
    }
  }

  // redirect() must be OUTSIDE try/catch — see actions.ts in /payment/cancel.
  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  return errorView;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function renderErrorForState(err: BookingStateError) {
  const msg = err.message || "";
  if (msg.includes("cancellata")) {
    return <CancelledView />;
  }
  // Generic "invalid transition" → booking is no longer awaiting_payment.
  // The most common case is `status === 'paid'`.
  return <NotAvailableView />;
}

function NotFoundView() {
  return (
    <Card className="border-stone-300 bg-white">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl">Link non valido</CardTitle>
        <p className="text-sm text-muted-foreground">
          Il link che hai cliccato non corrisponde ad alcuna prenotazione.
          Verifica di aver aperto l&apos;email più recente.
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

function NotAvailableView() {
  return (
    <Card className="border-emerald-300 bg-white">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl">Pagamento non più in sospeso</CardTitle>
        <p className="text-sm text-muted-foreground">
          Questa prenotazione non risulta più in attesa di pagamento. Se hai
          già completato il pagamento controlla la tua email per la conferma;
          altrimenti contatta lo staff.
        </p>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/">
            Torna al sito
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CancelledView() {
  return (
    <Card className="border-rose-300 bg-white">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-800">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">Prenotazione annullata</CardTitle>
        <p className="text-sm text-muted-foreground">
          Questa prenotazione è stata annullata. Se ritieni si tratti di un
          errore, contatta lo staff.
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

function TooManyRequestsView() {
  return (
    <Card className="border-stone-300 bg-white">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl">Troppi tentativi</CardTitle>
        <p className="text-sm text-muted-foreground">
          Hai aperto questo link troppe volte di seguito. Aspetta qualche
          istante e riprova.
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

function GenericErrorView() {
  return (
    <Card className="border-stone-300 bg-white">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-xl">Errore inatteso</CardTitle>
        <p className="text-sm text-muted-foreground">
          Non siamo riusciti ad aprire la pagina di pagamento. Riprova fra
          qualche minuto, oppure contatta lo staff se il problema persiste.
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
