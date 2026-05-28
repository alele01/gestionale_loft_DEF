import type { Metadata } from "next";
import Link from "next/link";
import { Clock, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { getVenueContactEmail } from "@/server/env";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Generic fallback page for the payment flow.
 *
 * In Phase 5 (Stripe live) the happy path bypasses this page entirely:
 * after the completion form submits, the user is redirected directly to
 * `checkout.stripe.com`. This route is kept as a soft landing for the
 * rare cases where:
 *   - The completion form returns ok but the redirect-script fails to
 *     run (JS disabled, redirect blocker, network blip).
 *   - The user navigates here manually from a stale link.
 */
export default function PaymentPendingPage() {
  const contact = getVenueContactEmail();
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 px-4 py-10">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  Prenotazione completata
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  In attesa di reindirizzamento al pagamento.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Abbiamo registrato i tuoi dati fiscali e i consensi. Dovresti
              essere stato reindirizzato automaticamente alla pagina di
              pagamento Stripe: se non è successo, controlla la tua email per
              il link aggiornato.
            </p>
            <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p>
                Riceverai la conferma definitiva via email appena il pagamento
                sarà ricevuto.
              </p>
            </div>
            <p className="text-xs">
              Se hai bisogno di assistenza, scrivi a{" "}
              <a className="underline" href={`mailto:${contact}`}>
                {contact}
              </a>
              .
            </p>
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/">Torna al sito</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
