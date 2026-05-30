"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarDays, CheckCircle2, ChefHat, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandHeader } from "@/components/brand/brand-header";
import { PriceLabel } from "@/components/shared/price-label";
import { formatDateTime } from "@/lib/format";
import {
  submitRequestAction,
  type SubmitRequestState,
} from "../../../app/embed/[eventSlug]/actions";

export type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  capacity: number;
  priceCents: number;
};

/** Public legal documents linked from the request consents. */
const LEGAL_DOCS = {
  termsBooking:
    "https://loft.cookergirl.com/wp-content/uploads/2026/03/2026.03.20-COOKER-LOFT-TERMINI-E-CONDIZIONI-PER-LA-PRENOTAZIONE-DI-EVENTI.docx",
  conditionsOfUse:
    "https://loft.cookergirl.com/wp-content/uploads/2026/03/2026.03.20-CONDIZIONI-DI-UTILIZZO.docx",
  privacy:
    "https://loft.cookergirl.com/wp-content/uploads/2026/03/2026.03.20-ANIDRA-LOFT-informativa-iscrizione-evento-1.docx",
} as const;

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2"
    >
      {children}
    </a>
  );
}

const initialState: SubmitRequestState = { status: "idle" };

export function RequestForm({
  event,
  compact = false,
}: {
  event: PublicEvent;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(submitRequestAction, initialState);

  if (state.status === "ok") {
    return <SuccessState event={event} people={state.people} compact={compact} />;
  }

  if (compact) {
    return (
      <div className="space-y-4">
        <FormBody event={event} action={formAction} state={state} compact />
        <Footer />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BrandHeader subtitle="Richiesta di prenotazione" />
      <EventHeader event={event} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Richiedi un posto</CardTitle>
          <p className="text-sm text-muted-foreground">
            Compila i dati e attendi conferma. Riceverai un&apos;email appena
            la richiesta sarà gestita.
          </p>
        </CardHeader>
        <CardContent>
          <FormBody event={event} action={formAction} state={state} />
        </CardContent>
      </Card>
      <Footer />
    </div>
  );
}

function FormBody({
  event,
  action,
  state,
  compact = false,
}: {
  event: PublicEvent;
  action: (formData: FormData) => void;
  state: SubmitRequestState;
  compact?: boolean;
}) {
  const [people, setPeople] = React.useState(2);
  const [terms, setTerms] = React.useState(false);
  const [privacy, setPrivacy] = React.useState(false);
  const [health, setHealth] = React.useState(false);
  const consentsOk = terms && privacy && health;
  const fieldErrors = state.status === "error" ? state.fieldErrors ?? {} : {};
  const globalError = state.status === "error" ? state.message : null;

  return (
    <form action={action} className="cl-form space-y-4">
      <input type="hidden" name="eventId" value={event.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="firstName" label="Nome" required error={fieldErrors.firstName}>
          <Input
            id="firstName"
            name="firstName"
            required
            minLength={2}
            maxLength={100}
            autoComplete="given-name"
            placeholder="Mario"
          />
        </Field>
        <Field id="lastName" label="Cognome" required error={fieldErrors.lastName}>
          <Input
            id="lastName"
            name="lastName"
            required
            minLength={2}
            maxLength={100}
            autoComplete="family-name"
            placeholder="Rossi"
          />
        </Field>
        <Field id="email" label="Email" required error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            placeholder="nome@example.com"
          />
        </Field>
        <Field id="phone" label="Telefono" required error={fieldErrors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            pattern="[+()\d\s\-./]{8,}"
            title="Inserisci un numero di telefono (8-15 cifre, ammessi + ( ) - . spazi)"
            placeholder="+39 333 1122334"
          />
        </Field>
        <Field id="people" label="Persone" required error={fieldErrors.people}>
          <Input
            id="people"
            name="people"
            type="number"
            min={1}
            max={event.capacity}
            required
            value={people}
            onChange={(e) =>
              setPeople(
                Math.max(1, Math.min(event.capacity, Number(e.target.value) || 1))
              )
            }
          />
        </Field>
      </div>

      <Field
        id="dietaryNotes"
        label={
          <>
            Allergie, intolleranze o esigenze alimentari di{" "}
            <strong>tutti i partecipanti</strong>
          </>
        }
        hint="Indica qui le allergie / intolleranze / esigenze alimentari di TUTTI i partecipanti inclusi nella prenotazione (incluso te). Lasciare il campo vuoto significa dichiarare che NESSUNO dei partecipanti ha allergie da segnalare."
      >
        <Textarea
          id="dietaryNotes"
          name="dietaryNotes"
          placeholder="Es. io celiaco, mia sorella allergica alle noci, gli altri nessuna allergia."
          rows={3}
        />
      </Field>

      <Field
        id="specialOccasion"
        label="Occasione speciale"
        hint="Es. compleanno, anniversario. Facoltativo."
      >
        <Input
          id="specialOccasion"
          name="specialOccasion"
          placeholder="Anniversario di matrimonio"
        />
      </Field>

      <div className={compact
        ? "space-y-2 border-t pt-4"
        : "space-y-3 rounded-lg border bg-muted/30 p-4"
      }>
        <h3 className={compact
          ? "cl-consent-title text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
          : "text-sm font-semibold"
        }>
          Consensi obbligatori
        </h3>
        <ConsentCheckbox
          id="consentTerms"
          name="consentTerms"
          checked={terms}
          onChange={setTerms}
          compact={compact}
          label={
            <>
              Dichiaro di aver letto e accettato i{" "}
              <DocLink href={LEGAL_DOCS.termsBooking}>
                termini e le condizioni per la prenotazione di eventi
              </DocLink>{" "}
              e le{" "}
              <DocLink href={LEGAL_DOCS.conditionsOfUse}>
                condizioni di utilizzo
              </DocLink>
              .
            </>
          }
        />
        <ConsentCheckbox
          id="consentPrivacy"
          name="consentPrivacy"
          checked={privacy}
          onChange={setPrivacy}
          compact={compact}
          label={
            <>
              Dichiaro di aver letto l&apos;
              <DocLink href={LEGAL_DOCS.privacy}>informativa privacy</DocLink>{" "}
              relativa alla richiesta di prenotazione.
            </>
          }
        />
        <ConsentCheckbox
          id="consentHealth"
          name="consentHealth"
          checked={health}
          onChange={setHealth}
          compact={compact}
          label={
            <>
              Esprimo il mio{" "}
              <strong>consenso esplicito al trattamento dei dati relativi alla salute</strong>{" "}
              eventualmente forniti (allergie, intolleranze, esigenze alimentari), per le finalità indicate
              nell&apos;informativa (art. 9.2.a GDPR).
            </>
          }
        />
        <p className="text-[11px] text-muted-foreground">
          Tutte e tre le dichiarazioni sono obbligatorie per inviare la richiesta.
        </p>
      </div>

      {globalError ? (
        <div
          role="alert"
          className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <p>{globalError}</p>
          {Object.keys(fieldErrors).length > 0 ? (
            <ul className="ml-5 list-disc text-xs">
              {Object.entries(fieldErrors).map(([k, msg]) => (
                <li key={k}>
                  <span className="font-medium">{fieldLabel(k)}:</span> {msg}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <SubmitButton disabled={!consentsOk} />
      <p className="text-center text-[11px] text-muted-foreground">
        Non riceverai un addebito ora: il pagamento avverrà solo dopo
        l&apos;eventuale accettazione.
      </p>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="w-full">
      {pending ? "Invio in corso…" : "Invia richiesta"}
    </Button>
  );
}

function EventHeader({ event }: { event: PublicEvent }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <Badge variant="outline" className="text-[10px]">
              <Sparkles className="h-3 w-3" />
              Evento Cooker Loft
            </Badge>
            <CardTitle className="text-lg leading-tight">{event.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
              {formatDateTime(event.startsAt)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {event.description}
          </p>
        ) : null}
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">Prezzo per persona</span>
          <PriceLabel cents={event.priceCents} size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}

function SuccessState({
  event,
  people,
  compact = false,
}: {
  event: PublicEvent;
  people: number;
  compact?: boolean;
}) {
  return (
    <div className="space-y-5">
      {!compact && <BrandHeader subtitle="Richiesta di prenotazione" />}
      <Card className="border-primary/30 bg-secondary/50">
      <CardContent className="space-y-4 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Richiesta ricevuta</h2>
          <p className="text-sm text-muted-foreground">
            Grazie! Abbiamo registrato la tua richiesta per{" "}
            <strong>{event.title}</strong> per {people}{" "}
            {people === 1 ? "persona" : "persone"}.
          </p>
        </div>
        <div className="space-y-2 rounded-md border bg-card p-3 text-left text-sm">
          <p className="text-sm font-medium">Cosa succede ora?</p>
          <ol className="ml-5 list-decimal text-xs text-muted-foreground">
            <li>
              Il nostro team valuta la richiesta in base alla disponibilità.
            </li>
            <li>
              Riceverai un&apos;email con la conferma (o, in alternativa, un
              messaggio sulla lista d&apos;attesa o sul rifiuto).
            </li>
            <li>
              Se confermata, l&apos;email includerà un link sicuro per
              completare la prenotazione e procedere al pagamento.
            </li>
          </ol>
        </div>
      </CardContent>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required ? <span className="text-rose-600">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ConsentCheckbox({
  id,
  name,
  checked,
  onChange,
  label,
  compact = false,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={compact
        ? "flex cursor-pointer items-start gap-3 py-1.5"
        : "flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3"
      }
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      {/*
        Hidden input is the actual form-data carrier; Radix Checkbox is the
        visible control. When unchecked, value is empty string so the server
        always receives the field and can validate against z.literal("on").
      */}
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <span className="text-sm leading-snug">{label}</span>
    </label>
  );
}

function Footer() {
  return (
    <p className="text-center text-[11px] text-muted-foreground">
      Modulo gestito da Cooker Loft (Anidra S.r.l.). Iframe-friendly,
      ottimizzato per mobile.
    </p>
  );
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "Nome",
  lastName: "Cognome",
  email: "Email",
  phone: "Telefono",
  people: "Persone",
  dietaryNotes: "Allergie / intolleranze",
  specialOccasion: "Occasione speciale",
  notes: "Note",
  consentTerms: "Condizioni",
  consentPrivacy: "Privacy",
  consentHealth: "Trattamento dati salute",
  eventId: "Evento",
  _root: "Modulo",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}
