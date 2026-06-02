"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarDays, CheckCircle2, Minus, Plus, Sparkles } from "lucide-react";

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
      className="cl-doc-link font-medium underline underline-offset-2"
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
      <div className="px-1 py-2">
        <FormBody event={event} action={formAction} state={state} compact />
      </div>
    );
  }

  return (
    <PageShell>
      <BrandHeader subtitle="Richiesta di prenotazione" />
      <EventHeader event={event} />
      <Card className="cl-card">
        <CardHeader className="space-y-1.5">
          <CardTitle className="cl-card-title">Richiedi un posto</CardTitle>
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
    </PageShell>
  );
}

/**
 * Full-page warm shell for the *direct link* surface (non-embedded).
 * The embed layout itself is transparent/flush (for iframes), so the
 * direct request page paints its own gradient background, centering and
 * max-width here.
 */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cl-page min-h-screen bg-gradient-to-b from-[#fffaf7] to-[#fde5d4] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl space-y-5">{children}</div>
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
    <form
      action={action}
      className={compact ? "cl-form cl-form--compact space-y-5" : "cl-form space-y-4"}
    >
      <input type="hidden" name="eventId" value={event.id} />

      <div className={compact ? "grid gap-4 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2"}>
        <Field id="firstName" label="Nome" required error={fieldErrors.firstName} compact={compact}>
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
        <Field id="lastName" label="Cognome" required error={fieldErrors.lastName} compact={compact}>
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
        <Field id="email" label="Email" required error={fieldErrors.email} compact={compact}>
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
        <Field id="phone" label="Telefono" required error={fieldErrors.phone} compact={compact}>
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
        <Field
          id="people"
          label="Persone"
          required
          error={fieldErrors.people}
          hint={`Massimo ${event.capacity} per questo evento.`}
          compact={compact}
        >
          <input type="hidden" name="people" value={people} />
          <PeopleStepper
            value={people}
            min={1}
            max={event.capacity}
            onChange={setPeople}
          />
        </Field>
      </div>

      <Field
        id="dietaryNotes"
        compact={compact}
        label={
          <>
            Allergie, intolleranze o esigenze alimentari di{" "}
            <strong className="font-bold">tutti i partecipanti</strong>
          </>
        }
        hint={
          compact
            ? undefined
            : "Indica qui le allergie / intolleranze / esigenze alimentari di TUTTI i partecipanti inclusi nella prenotazione (incluso te). Lasciare il campo vuoto significa dichiarare che NESSUNO dei partecipanti ha allergie da segnalare."
        }
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
        compact={compact}
        hint={compact ? undefined : "Es. compleanno, anniversario. Facoltativo."}
      >
        <Input
          id="specialOccasion"
          name="specialOccasion"
          placeholder="Anniversario di matrimonio"
        />
      </Field>

      <div className={compact
        ? "space-y-3 border-t border-[rgba(120,66,63,0.12)] pt-5"
        : "space-y-3 rounded-lg border bg-muted/30 p-4"
      }>
        <h3 className={compact
          ? "cl-section-title"
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

      <SubmitButton disabled={!consentsOk} compact={compact} />
      {!compact ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Non riceverai un addebito ora: il pagamento avverrà solo dopo
          l&apos;eventuale accettazione.
        </p>
      ) : null}
    </form>
  );
}

/**
 * Mobile-friendly number stepper for the "Persone" field. The visible
 * input keeps a local string draft so the user can clear it while typing
 * (the old controlled number input snapped back instantly on mobile);
 * the value is clamped to [min, max] only on blur. The +/- buttons give
 * a thumb-friendly way to adjust without the OS numeric keyboard.
 */
function PeopleStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));

  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  const commit = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    const next = Number.isNaN(n) ? value : clamp(n);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <div className="cl-stepper">
      <button
        type="button"
        className="cl-stepper-btn"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Diminuisci numero di persone"
      >
        <Minus className="h-5 w-5" aria-hidden="true" />
      </button>
      <input
        id="people"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="cl-stepper-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => commit(e.target.value)}
        aria-label="Numero di persone"
      />
      <button
        type="button"
        className="cl-stepper-btn"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Aumenta numero di persone"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function SubmitButton({
  disabled,
  compact = false,
}: {
  disabled: boolean;
  compact?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className={compact ? "w-full min-h-[52px]" : "w-full"}
    >
      {pending ? "Invio in corso…" : "Invia richiesta"}
    </Button>
  );
}

function EventHeader({ event }: { event: PublicEvent }) {
  return (
    <Card className="cl-card overflow-hidden">
      <div className="cl-event-hero px-6 py-6 text-white">
        <Badge className="cl-event-badge mb-2 border-0 bg-white/20 text-[10px] text-white">
          <Sparkles className="h-3 w-3" />
          Evento Cooker Loft
        </Badge>
        <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/90">
          <CalendarDays className="h-4 w-4" />
          {formatDateTime(event.startsAt)}
        </p>
      </div>
      <CardContent className="space-y-3 pt-5">
        {event.description ? (
          <p className="text-sm leading-relaxed text-foreground/80">
            {event.description}
          </p>
        ) : null}
        <div className="flex items-center justify-between rounded-md border border-[rgba(120,66,63,0.12)] bg-[#fff7f1] px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#78423f]">
            Prezzo per persona
          </span>
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
  const Wrapper = compact ? CompactWrapper : PageShell;
  return (
    <Wrapper>
      {!compact && <BrandHeader subtitle="Richiesta di prenotazione" />}
      <Card className="cl-card border-primary/30 bg-secondary/50">
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
              messaggio sulla lista d&apos;attesa).
            </li>
            <li>
              Se confermata, l&apos;email includerà un link sicuro per
              completare la prenotazione e procedere al pagamento.
            </li>
          </ol>
        </div>
      </CardContent>
      </Card>
    </Wrapper>
  );
}

/** Passthrough wrapper used for the embed (compact) success state. */
function CompactWrapper({ children }: { children: React.ReactNode }) {
  return <div className="px-1 py-2">{children}</div>;
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
  compact = false,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "space-y-1.5"}>
      <Label htmlFor={id} className="cl-field-label">
        {label}
        {required ? <span className="text-[#AA2620]"> *</span> : null}
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
      <span className="cl-consent-label">{label}</span>
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
