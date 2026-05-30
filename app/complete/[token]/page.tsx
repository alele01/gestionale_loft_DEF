import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { BrandHeader } from "@/components/brand/brand-header";
import { CompletionForm } from "@/components/complete/completion-form";
import { getVenueContactEmail } from "@/server/env";
import { lookupCompletion } from "@/server/completion/token";

export const dynamic = "force-dynamic";

export default async function CompletionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lookup = await lookupCompletion(token);

  if (!lookup) {
    return <InvalidTokenView />;
  }

  if (lookup.state === "void" || lookup.state === "expired") {
    return (
      <InvalidTokenView reason="Il link non è più valido (annullato o scaduto)." />
    );
  }

  if (lookup.state === "already_paid") {
    return (
      <div className="space-y-5">
        <BrandHeader subtitle="Completa la prenotazione" />
        <Card className="border-primary/30 bg-secondary/50">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Prenotazione già pagata</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Questa prenotazione risulta già <strong>pagata</strong>. Hai
              ricevuto via email la conferma con il riepilogo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (lookup.state === "already_completed") {
    return (
      <div className="space-y-5">
        <BrandHeader subtitle="Completa la prenotazione" />
        <Card>
          <CardContent className="space-y-3 p-6">
            <h1 className="text-lg font-semibold">Link già utilizzato</h1>
            <p className="text-sm text-muted-foreground">
              Questa prenotazione è già stata completata ed è in attesa di
              pagamento. Controlla la nostra ultima email per il link al
              pagamento, o scrivi allo staff.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <CompletionForm
      token={token}
      event={{
        id: lookup.event.id,
        title: lookup.event.title,
        startsAt: lookup.event.starts_at,
        priceCents: lookup.event.price_cents,
      }}
      booking={{
        id: lookup.booking.id,
        people: lookup.booking.people,
        amountCents: lookup.booking.amount_cents,
        specialOccasion: lookup.booking.special_occasion,
        dietaryNotes: lookup.booking.dietary_notes,
      }}
      contactEmail={getVenueContactEmail()}
    />
  );
}

function InvalidTokenView({ reason }: { reason?: string }) {
  return (
    <div className="space-y-5">
      <BrandHeader subtitle="Completa la prenotazione" />
      <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">
              Non riusciamo a trovare la tua prenotazione
            </h1>
            <p className="text-sm text-muted-foreground">
              {reason ??
                "Il link potrebbe essere scaduto, già usato, o aggiornato dall'amministrazione."}
            </p>
            <p className="text-xs text-muted-foreground">
              Se hai ricevuto un&apos;email più recente con un nuovo link, usa
              quella. Altrimenti scrivi a{" "}
              <a className="underline" href={`mailto:${getVenueContactEmail()}`}>
                {getVenueContactEmail()}
              </a>
              .
            </p>
          </div>
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
