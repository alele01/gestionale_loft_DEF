import { Check, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { BookingConsents, RequestConsents } from "@/lib/mock/types";

type RequestConsentSummaryProps = {
  consents: RequestConsents;
};

export function RequestConsentSummary({
  consents,
}: RequestConsentSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consensi al momento della richiesta</CardTitle>
        <p className="text-xs text-muted-foreground">
          Le tre dichiarazioni che il richiedente ha spuntato sul modulo
          pubblico al momento dell&apos;invio.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConsentRow
          label="Termini e condizioni"
          value={consents.terms.accepted}
          acceptedAt={consents.terms.acceptedAt}
          version={consents.terms.version}
        />
        <ConsentRow
          label="Informativa privacy"
          value={consents.privacy.accepted}
          acceptedAt={consents.privacy.acceptedAt}
          version={consents.privacy.version}
        />
        <ConsentRow
          label="Trattamento dati sulla salute"
          value={consents.health.accepted}
          acceptedAt={consents.health.acceptedAt}
          version={consents.health.version}
        />

        <details className="group rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
            Mostra dettagli tecnici di tracciamento
          </summary>
          <div className="mt-2 grid gap-1 sm:grid-cols-3">
            <Meta label="Inviato il" value={formatDateTime(consents.submittedAt)} />
            <Meta label="IP" value={consents.ipAddress} mono />
            <Meta label="Dispositivo" value={consents.userAgent} mono />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

type BookingConsentSummaryProps = {
  consents: BookingConsents;
};

export function BookingConsentSummary({
  consents,
}: BookingConsentSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consensi al completamento</CardTitle>
        <p className="text-xs text-muted-foreground">
          Le dichiarazioni che il referente ha accettato prima del pagamento.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConsentRow
          label="Condizioni generali di partecipazione"
          value={consents.terms.value}
          acceptedAt={consents.terms.acceptedAt}
          version={consents.terms.version}
        />
        <ConsentRow
          label="Approvazione clausole 1341/1342 c.c."
          value={consents.clauses1341_1342.value}
          acceptedAt={consents.clauses1341_1342.acceptedAt}
          version={consents.clauses1341_1342.version}
        />
        <ConsentRow
          label="Informativa privacy"
          value={consents.privacy.value}
          acceptedAt={consents.privacy.acceptedAt}
          version={consents.privacy.version}
        />
        <ConsentRow
          label="Trattamento dati sulla salute"
          value={consents.health.value}
          acceptedAt={consents.health.acceptedAt}
          version={consents.health.version}
        />
        <ConsentRow
          label={`Utilizzo immagine — ${consents.imageUse.value === "accept" ? "acconsente" : "non acconsente"}`}
          value={true}
          acceptedAt={consents.imageUse.acceptedAt}
          version={consents.imageUse.version}
          info
        />

        <details className="group rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
            Mostra dettagli tecnici di tracciamento
          </summary>
          <div className="mt-2 grid gap-1 sm:grid-cols-3">
            <Meta label="Inviato il" value={formatDateTime(consents.submittedAt)} />
            <Meta label="IP" value={consents.ipAddress} mono />
            <Meta label="Dispositivo" value={consents.userAgent} mono />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function ConsentRow({
  label,
  value,
  acceptedAt,
  version,
  info,
}: {
  label: string;
  value: boolean;
  acceptedAt: string;
  version: string;
  info?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-card p-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full",
            value
              ? info
                ? "bg-sky-100 text-sky-700"
                : "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          )}
        >
          {value ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDateTime(acceptedAt)}
            <span className="ml-2 hidden font-mono text-[10px] opacity-60 sm:inline">
              {version}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("break-all", mono && "font-mono text-[11px]")}>
        {value}
      </p>
    </div>
  );
}
