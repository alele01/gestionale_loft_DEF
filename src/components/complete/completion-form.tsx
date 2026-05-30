"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Baby,
  Building2,
  CalendarDays,
  ChefHat,
  Info,
  Mail,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { BrandHeader } from "@/components/brand/brand-header";
import { PriceLabel } from "@/components/shared/price-label";
import { LegalAccordion } from "./legal-accordion";
import { PrivacyToggleCheckbox } from "./privacy-toggle";

import { formatDateTime } from "@/lib/format";
import { ITALIAN_PROVINCES } from "@/lib/italian-provinces";
import {
  validateItalianTaxCode,
  type TaxCodeValidation,
} from "@/lib/codice-fiscale";
import {
  completeBookingAction,
  type CompletionActionState,
} from "../../server/completion/actions";

export type CompletionBooking = {
  id: string;
  people: number;
  amountCents: number;
  specialOccasion: string | null;
  dietaryNotes: string | null;
};

export type CompletionEvent = {
  id: string;
  title: string;
  startsAt: string;
  priceCents: number;
};

type CompletionFormProps = {
  token: string;
  event: CompletionEvent;
  booking: CompletionBooking;
  contactEmail: string;
};

type FiscalKind = "private" | "company";
type ParticipantsKind = "only_me" | "with_others";
type YesNo = "yes" | "no";

const initialState: CompletionActionState = { status: "idle" };

export function CompletionForm(props: CompletionFormProps) {
  const [state, formAction] = useActionState(
    completeBookingAction,
    initialState
  );

  React.useEffect(() => {
    if (state.status === "ok" && state.checkoutUrl) {
      // Top-level navigation to Stripe Checkout (hosted URL). We use
      // `window.location.href` instead of router.push because the target
      // is an external domain (checkout.stripe.com).
      window.location.href = state.checkoutUrl;
    }
  }, [state]);

  return <FormBody {...props} action={formAction} state={state} />;
}

function FormBody({
  token,
  event,
  booking,
  contactEmail,
  action,
  state,
}: CompletionFormProps & {
  action: (formData: FormData) => void;
  state: CompletionActionState;
}) {
  const people = booking.people;
  const occasion = booking.specialOccasion;

  // Participants kind is dictated by the locked `people` count, but we
  // still ship it through the form for an explicit, audit-friendly value.
  const participantsKind: ParticipantsKind =
    people === 1 ? "only_me" : "with_others";
  const isMulti = participantsKind === "with_others";

  const [fiscalKind, setFiscalKind] = React.useState<FiscalKind>("private");

  // Controlled fiscal fields: validation errors re-render the form;
  // controlled inputs guarantee we never lose what the user typed.
  //
  // The naming model splits per fiscalKind:
  //   - private → firstName + lastName (mapped to FatturaPA Anagrafica
  //     Nome / Cognome, see docs/XML_EXPORT.md §5).
  //   - company → legalName (ragione sociale, mapped to FatturaPA
  //     Anagrafica.Denominazione).
  const [legalName, setLegalName] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [taxCode, setTaxCode] = React.useState("");
  const [vatNumber, setVatNumber] = React.useState("");
  const [sdiCode, setSdiCode] = React.useState("");
  const [pecEmail, setPecEmail] = React.useState("");
  const [addressStreet, setAddressStreet] = React.useState("");
  const [addressZip, setAddressZip] = React.useState("");
  const [addressCity, setAddressCity] = React.useState("");
  const [addressProvince, setAddressProvince] = React.useState("");
  // La nazione è bloccata su IT in questo modulo: per fatture estere
  // l'utente deve passare per intervento manuale dello staff.
  const addressCountry = "IT";
  /**
   * Stato della validazione del CAP. Verifichiamo solo che il CAP esista
   * (per evitare typo); città e provincia sono compilate manualmente
   * dall'utente.
   * - "idle": nessuna validazione attiva
   * - "loading": chiamata in corso
   * - "valid": CAP riconosciuto
   * - "notfound": CAP non riconosciuto
   * - "error": problema di rete
   */
  type CapLookupState =
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "valid" }
    | { kind: "notfound" }
    | { kind: "error" };
  const [capLookup, setCapLookup] = React.useState<CapLookupState>({
    kind: "idle",
  });

  // Participants block — allergies are READONLY (derived from booking).
  // Locked at request time; to change them the user must contact the team.
  const [otherParticipantsNames, setOtherParticipantsNames] =
    React.useState("");
  const allergiesPresent: YesNo = booking.dietaryNotes ? "yes" : "no";
  const allergiesDetails = booking.dietaryNotes ?? "";

  // Minors block
  const [minorsIncluded, setMinorsIncluded] = React.useState<YesNo | "">("");
  const [minorsNames, setMinorsNames] = React.useState("");
  const [guardianName, setGuardianName] = React.useState("");
  const [minorAllergiesPresent, setMinorAllergiesPresent] = React.useState<
    YesNo | ""
  >("");
  // Confirmation that the minor's allergies are within the ones already
  // declared at request time. Replaces the previous free-text minor
  // allergies field per spec point 3.
  const [minorAllergiesConfirmed, setMinorAllergiesConfirmed] =
    React.useState(false);

  // Consents
  const [terms, setTerms] = React.useState(false);
  const [clauses, setClauses] = React.useState(false);
  const [privacy, setPrivacy] = React.useState(false);
  const [consentRepresentative, setConsentRepresentative] =
    React.useState(false);
  const [consentInformOthers, setConsentInformOthers] = React.useState(false);
  const [consentImageUse, setConsentImageUse] = React.useState(false);
  const [consentMinorParental, setConsentMinorParental] =
    React.useState(false);
  const [consentMinorImageUse, setConsentMinorImageUse] = React.useState(false);
  // Confirmation that the readonly allergies block above accurately
  // covers ALL participants (or that no participant has any allergy).
  // Required for both "yes" and "no" so the user explicitly endorses
  // the data even when the request had no allergies declared.
  const [consentAllergiesDeclaration, setConsentAllergiesDeclaration] =
    React.useState(false);

  const fieldErrors =
    state.status === "error" ? state.fieldErrors ?? {} : {};
  const globalError = state.status === "error" ? state.message : null;

  // Validazione del CAP via zippopotam.us (gratis, no API key). Verifica
  // solo che il CAP esista nel database italiano; non popola altri campi.
  // Città e provincia restano a compilazione manuale.
  React.useEffect(() => {
    const cap = addressZip.trim();
    if (!/^\d{5}$/.test(cap)) {
      setCapLookup({ kind: "idle" });
      return;
    }
    setCapLookup({ kind: "loading" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.zippopotam.us/it/${cap}`, {
          signal: controller.signal,
        });
        if (res.status === 404) {
          setCapLookup({ kind: "notfound" });
          return;
        }
        if (!res.ok) {
          setCapLookup({ kind: "error" });
          return;
        }
        const data = (await res.json()) as {
          places?: Array<{ "place name"?: string }>;
        };
        const hasPlaces =
          Array.isArray(data.places) &&
          data.places.some(
            (p) => (p["place name"] ?? "").trim().length > 0
          );
        setCapLookup({ kind: hasPlaces ? "valid" : "notfound" });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setCapLookup({ kind: "error" });
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [addressZip]);

  // If the minor declares allergies but the request had NO allergies
  // listed, we cannot let the user proceed — they must contact staff to
  // update the original request.
  const minorAllergiesBlockedByMissingRequest =
    minorAllergiesPresent === "yes" && !booking.dietaryNotes;

  const minorsRequiredOk =
    minorsIncluded === "no" ||
    (minorsIncluded === "yes" &&
      minorsNames.trim().length > 0 &&
      guardianName.trim().length > 0 &&
      consentMinorParental &&
      (minorAllergiesPresent === "no" ||
        (minorAllergiesPresent === "yes" &&
          !minorAllergiesBlockedByMissingRequest &&
          minorAllergiesConfirmed)));

  const consentsOk =
    terms &&
    clauses &&
    privacy &&
    consentAllergiesDeclaration &&
    (!isMulti || (consentRepresentative && consentInformOthers));

  const canSubmit =
    consentsOk && minorsIncluded !== "" && minorsRequiredOk;

  return (
    <form className="space-y-5" action={action}>
      <input type="hidden" name="token" value={token} />
      <input
        type="hidden"
        name="participantsKind"
        value={participantsKind}
      />

      <BrandHeader subtitle="Completa la prenotazione" />

      <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        I campi e le caselle contrassegnati con{" "}
        <RequiredMark /> sono obbligatori.
      </p>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ChefHat className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <Badge variant="outline" className="text-[10px]">
                <ShieldCheck className="h-3 w-3" />
                Link sicuro · uso personale
              </Badge>
              <CardTitle className="text-xl leading-tight">
                Completa la tua prenotazione
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                {event.title} · {formatDateTime(event.startsAt)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Hai aperto questo link dalla nostra email di conferma. Compila i
            campi qui sotto per completare la prenotazione e procedere al
            pagamento.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Riepilogo della tua prenotazione
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Questi dati derivano dalla richiesta iniziale. Se uno non è
            corretto, scrivi allo staff prima di procedere.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadonlyField
              icon={<Users className="h-3.5 w-3.5" />}
              label="Numero di persone"
              value={`${people} ${people === 1 ? "persona" : "persone"}`}
            />
            <ReadonlyField
              label="Occasione speciale"
              value={occasion ?? "—"}
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900">
                Se uno di questi dati non è corretto, non procedere.
              </p>
              <p className="text-xs text-amber-900/80">
                Per modificare numero di persone o occasione speciale,
                scrivici a{" "}
                <a
                  className="inline-flex items-center gap-1 underline"
                  href={`mailto:${contactEmail}`}
                >
                  <Mail className="h-3 w-3" />
                  {contactEmail}
                </a>
                . Aggiorneremo noi i dati e ti rimanderemo un nuovo link.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati fiscali</CardTitle>
          <p className="text-xs text-muted-foreground">
            Necessari per l&apos;emissione della fattura. Verranno congelati al
            momento del pagamento.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={fiscalKind}
            onValueChange={(v) => setFiscalKind(v as FiscalKind)}
            name="fiscalKind"
            className="grid grid-cols-2 gap-2"
          >
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <RadioGroupItem value="private" id="fk-private" />
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Privato</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <RadioGroupItem value="company" id="fk-company" />
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>Azienda / Professionista</span>
            </label>
          </RadioGroup>

          <div className="grid gap-3 sm:grid-cols-2">
            {fiscalKind === "private" ? (
              <>
                <Field
                  id="firstName"
                  label="Nome (come da documento)"
                  required
                  error={fieldErrors.firstName}
                >
                  <Input
                    id="firstName"
                    name="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </Field>
                <Field
                  id="lastName"
                  label="Cognome (come da documento)"
                  required
                  error={fieldErrors.lastName}
                >
                  <Input
                    id="lastName"
                    name="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </Field>
                <Field
                  id="taxCode"
                  label="Codice fiscale"
                  required
                  error={fieldErrors.taxCode}
                  sm
                >
                  <Input
                    id="taxCode"
                    name="taxCode"
                    maxLength={16}
                    className="font-mono"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value.toUpperCase())}
                  />
                  <TaxCodeHint value={taxCode} />
                </Field>
              </>
            ) : (
              <>
                <Field
                  id="legalName"
                  label="Ragione sociale"
                  required
                  error={fieldErrors.legalName}
                  sm
                >
                  <Input
                    id="legalName"
                    name="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    required
                  />
                </Field>
                <Field
                  id="vatNumber"
                  label="Partita IVA"
                  required
                  error={fieldErrors.vatNumber}
                >
                  <Input
                    id="vatNumber"
                    name="vatNumber"
                    className="font-mono"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                  />
                </Field>
                <Field
                  id="sdiCode"
                  label="Codice destinatario SDI"
                  required
                  error={fieldErrors.sdiCode}
                >
                  <Input
                    id="sdiCode"
                    name="sdiCode"
                    maxLength={7}
                    className="font-mono uppercase"
                    placeholder="7 caratteri (es. M5UXCR1)"
                    value={sdiCode}
                    onChange={(e) =>
                      setSdiCode(e.target.value.toUpperCase())
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Se non hai un SDI generico, usa{" "}
                    <span className="font-mono">0000000</span> (sette zeri).
                  </p>
                </Field>
                <Field id="pecEmail" label="PEC (facoltativa)" error={fieldErrors.pecEmail} sm>
                  <Input
                    id="pecEmail"
                    name="pecEmail"
                    type="email"
                    placeholder="indirizzo@pec.it"
                    value={pecEmail}
                    onChange={(e) => setPecEmail(e.target.value)}
                  />
                </Field>
              </>
            )}

            <Field
              id="addressStreet"
              label="Indirizzo (via e numero civico)"
              required
              error={fieldErrors.addressStreet}
              sm
            >
              <Input
                id="addressStreet"
                name="addressStreet"
                placeholder="Via Roma 14"
                required
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
              />
            </Field>

            <Field
              id="addressZip"
              label="CAP"
              required
              error={fieldErrors.addressZip}
            >
              <Input
                id="addressZip"
                name="addressZip"
                inputMode="numeric"
                maxLength={5}
                placeholder="10121"
                required
                value={addressZip}
                onChange={(e) =>
                  setAddressZip(e.target.value.replace(/\D/g, "").slice(0, 5))
                }
              />
              <CapLookupHint state={capLookup} />
            </Field>

            <Field
              id="addressCity"
              label="Città"
              required
              error={fieldErrors.addressCity}
            >
              <Input
                id="addressCity"
                name="addressCity"
                required
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
              />
            </Field>

            <Field
              id="addressProvince"
              label="Provincia"
              required
              error={fieldErrors.addressProvince}
            >
              <select
                id="addressProvince"
                name="addressProvince"
                required
                value={addressProvince}
                onChange={(e) => setAddressProvince(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>
                  Seleziona provincia…
                </option>
                {ITALIAN_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </Field>

            <Field id="addressCountry" label="Nazione" required>
              <Input
                id="addressCountry"
                value="Italia (IT)"
                readOnly
                disabled
                aria-readonly
                className="bg-muted/40"
              />
              <input
                type="hidden"
                name="addressCountry"
                value={addressCountry}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Se desideri ricevere la fattura con intestazione estera,{" "}
                <strong>contatta il team</strong> prima di completare la
                prenotazione.
              </p>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partecipanti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hidden inputs for the readonly allergies block. */}
          <input
            type="hidden"
            name="allergiesPresent"
            value={allergiesPresent}
          />
          <input
            type="hidden"
            name="allergiesDetails"
            value={allergiesDetails}
          />

          <div className="rounded-lg border bg-primary/5 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                {people}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">
                  {people === 1
                    ? "1 partecipante (solo te)"
                    : `${people} partecipanti (tu + altri)`}
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Il numero deriva dalla richiesta confermata dallo staff e
                  non è modificabile qui. Per modificarlo scrivi al team.
                </p>
              </div>
            </div>
          </div>

          {/* The participantsKind hidden input is shipped at the top of the form. */}

          {isMulti ? (
            <>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                Stai effettuando una prenotazione anche per conto di altri
                partecipanti. Ai fini della presente prenotazione, sarai
                considerato <strong>referente della prenotazione</strong> nei
                confronti di Anidra S.r.l. Ti chiediamo quindi di confermare di
                essere autorizzato a procedere anche per conto degli altri
                partecipanti e di impegnarti a trasmettere loro le informazioni
                rilevanti sull&apos;Evento.
              </div>

              <Field
                id="otherParticipantsNames"
                label="Nomi degli altri partecipanti (facoltativo)"
                error={fieldErrors.otherParticipantsNames}
                sm
              >
                <Textarea
                  id="otherParticipantsNames"
                  name="otherParticipantsNames"
                  rows={2}
                  placeholder="Es. Mario Rossi, Anna Bianchi…"
                  value={otherParticipantsNames}
                  onChange={(e) =>
                    setOtherParticipantsNames(e.target.value)
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Se preferisci non indicarli, puoi lasciare il campo vuoto.
                </p>
              </Field>
            </>
          ) : null}

          <Separator />

          <div className="space-y-2">
            <Label>
              Allergie, intolleranze o esigenze alimentari di{" "}
              <strong>tutti i partecipanti</strong>, segnalate in fase di
              richiesta
            </Label>
            {booking.dietaryNotes ? (
              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-semibold text-amber-900">
                  Sì, segnalate per tutti i partecipanti inclusi nella
                  prenotazione
                </p>
                <p className="whitespace-pre-line text-xs leading-relaxed text-amber-900/90">
                  {booking.dietaryNotes}
                </p>
              </div>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">
                  Nessuna allergia segnalata per nessuno dei partecipanti
                </p>
                <p className="text-xs text-muted-foreground">
                  In fase di richiesta hai dichiarato che nessuno dei{" "}
                  {people} {people === 1 ? "partecipante" : "partecipanti"}{" "}
                  ha allergie, intolleranze o esigenze alimentari
                  particolari da segnalare.
                </p>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Queste informazioni si riferiscono a{" "}
              <strong>tutti i partecipanti</strong> inclusi nella
              prenotazione e corrispondono a quanto indicato in fase di
              richiesta. Non sono modificabili qui:{" "}
              <strong>
                per modificarle, scrivi al team prima di procedere
              </strong>
              .
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              La mancata, incompleta o tardiva comunicazione di allergie,
              intolleranze o esigenze alimentari particolari potrebbe non
              consentire ad Anidra S.r.l. e/o al catering incaricato di
              valutare o predisporre eventuali adattamenti della proposta
              gastronomica accessoria.
            </p>

            <ConsentCheckbox
              id="consentAllergiesDeclaration"
              name="consentAllergiesDeclaration"
              checked={consentAllergiesDeclaration}
              onChange={setConsentAllergiesDeclaration}
              required
              error={fieldErrors.consentAllergiesDeclaration}
              label={
                booking.dietaryNotes ? (
                  <>
                    Dichiaro che le allergie, intolleranze o esigenze
                    alimentari particolari indicate sopra si riferiscono a{" "}
                    <strong>tutti i partecipanti</strong> inclusi nella
                    prenotazione, sono complete e veritiere
                  </>
                ) : (
                  <>
                    Dichiaro che <strong>nessuno</strong> dei partecipanti
                    inclusi nella prenotazione ha allergie, intolleranze o
                    esigenze alimentari particolari da segnalare
                  </>
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Baby className="h-4 w-4" />
            Minori
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-0.5">
              <span>La prenotazione include partecipanti minorenni?</span>
              <RequiredMark />
            </Label>
            <RadioGroup
              value={minorsIncluded}
              onValueChange={(v) => setMinorsIncluded(v as YesNo)}
              name="minorsIncluded"
              className="grid grid-cols-2 gap-2"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                <RadioGroupItem value="no" id="mi-no" />
                <span>No</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                <RadioGroupItem value="yes" id="mi-yes" />
                <span>Sì</span>
              </label>
            </RadioGroup>
            {fieldErrors.minorsIncluded ? (
              <p className="text-xs text-destructive">
                {fieldErrors.minorsIncluded}
              </p>
            ) : null}
          </div>

          {minorsIncluded === "yes" ? (
            <div className="space-y-4 rounded-md border bg-muted/30 p-3">
              <Field
                id="minorsNames"
                label="Nome e cognome del minore / dei minori"
                required
                error={fieldErrors.minorsNames}
                sm
              >
                <Textarea
                  id="minorsNames"
                  name="minorsNames"
                  rows={2}
                  value={minorsNames}
                  onChange={(e) => setMinorsNames(e.target.value)}
                />
              </Field>

              <Field
                id="guardianName"
                label="Nome e cognome del genitore/tutore/accompagnatore responsabile"
                required
                error={fieldErrors.guardianName}
                sm
              >
                <Input
                  id="guardianName"
                  name="guardianName"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                />
              </Field>

              <ConsentCheckbox
                id="consentMinorParental"
                name="consentMinorParental"
                checked={consentMinorParental}
                onChange={setConsentMinorParental}
                required
                error={fieldErrors.consentMinorParental}
                label={
                  <>
                    Dichiaro di esercitare la responsabilità genitoriale sul
                    minore o di essere stato autorizzato da chi la esercita a
                    iscrivere il minore all&apos;Evento.
                  </>
                }
              />

              <div className="space-y-2">
                <Label className="flex items-center gap-0.5">
                  <span>
                    Il minore ha allergie, intolleranze o esigenze alimentari
                    particolari?
                  </span>
                  <RequiredMark />
                </Label>
                <RadioGroup
                  value={minorAllergiesPresent}
                  onValueChange={(v) =>
                    setMinorAllergiesPresent(v as YesNo)
                  }
                  name="minorAllergiesPresent"
                  className="grid gap-2"
                >
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-card p-3 text-sm">
                    <RadioGroupItem
                      value="no"
                      id="mal-no"
                      className="mt-0.5"
                    />
                    <span>
                      <strong>No</strong>, per quanto a mia conoscenza non vi
                      sono allergie, intolleranze o esigenze alimentari
                      particolari da segnalare.
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-card p-3 text-sm">
                    <RadioGroupItem
                      value="yes"
                      id="mal-yes"
                      className="mt-0.5"
                    />
                    <span>
                      <strong>Sì</strong>, il minore ha allergie,
                      intolleranze o esigenze alimentari particolari.
                    </span>
                  </label>
                </RadioGroup>
                {fieldErrors.minorAllergiesPresent ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.minorAllergiesPresent}
                  </p>
                ) : null}

                {minorAllergiesPresent === "yes" ? (
                  booking.dietaryNotes ? (
                    <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                      <p className="text-xs font-semibold text-amber-900">
                        Le allergie del minore devono essere comprese tra
                        quelle segnalate in fase di richiesta:
                      </p>
                      <p className="whitespace-pre-line rounded bg-white/60 p-2 text-xs leading-relaxed text-amber-950">
                        {booking.dietaryNotes}
                      </p>
                      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-300 bg-white p-3">
                        <Checkbox
                          checked={minorAllergiesConfirmed}
                          onCheckedChange={(v) =>
                            setMinorAllergiesConfirmed(v === true)
                          }
                          className="mt-0.5"
                        />
                        <span className="text-xs leading-snug text-amber-950">
                          Confermo che le allergie, intolleranze o esigenze
                          alimentari del minore sono comprese tra quelle
                          già segnalate sopra.
                          <RequiredMark />
                        </span>
                      </label>
                      <input
                        type="hidden"
                        name="minorAllergiesConfirmed"
                        value={minorAllergiesConfirmed ? "on" : ""}
                      />
                      <p className="text-[11px] leading-relaxed text-amber-900/80">
                        Se le allergie del minore <strong>non</strong> sono
                        comprese tra quelle segnalate, non procedere e
                        contatta lo staff per aggiornare la richiesta.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                      <p className="text-xs font-semibold text-destructive">
                        Non hai segnalato allergie in fase di richiesta.
                      </p>
                      <p className="text-[11px] leading-relaxed text-destructive/90">
                        Per indicare le allergie del minore devi
                        <strong>
                          {" "}
                          contattare lo staff prima di completare la
                          prenotazione
                        </strong>
                        . Lo staff aggiornerà la richiesta e ti rimanderemo
                        un nuovo link.
                      </p>
                    </div>
                  )
                ) : null}
              </div>

              <ConsentCheckbox
                id="consentMinorImageUse"
                name="consentMinorImageUse"
                checked={consentMinorImageUse}
                onChange={setConsentMinorImageUse}
                label={
                  <>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Facoltativo —{" "}
                    </span>
                    Acconsento, in qualità di
                    genitore/tutore/soggetto legittimato, all&apos;utilizzo
                    dell&apos;immagine del minore in modo riconoscibile per
                    finalità promozionali, social, editoriali e di
                    comunicazione relative al progetto Cooker Girl e al
                    Cooker Loft.
                  </>
                }
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consensi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LegalAccordion />
          <Separator />
          <h3 className="text-sm font-semibold">Dichiarazioni obbligatorie</h3>

          <ConsentCheckbox
            id="consentTerms"
            name="consentTerms"
            checked={terms}
            onChange={setTerms}
            required
            error={fieldErrors.consentTerms}
            label={
              <>
                Dichiaro di aver letto, compreso e accettato le{" "}
                <LegalLink>
                  Condizioni Generali di Partecipazione agli Eventi Cooker Loft
                </LegalLink>
                {isMulti ? (
                  <>
                    , anche nell&apos;interesse e per conto degli altri
                    partecipanti inclusi nella prenotazione, dichiarando di
                    essere autorizzato a effettuare la prenotazione e ad
                    accettare le relative condizioni anche per loro conto.
                  </>
                ) : (
                  "."
                )}
              </>
            }
          />

          <ConsentCheckbox
            id="consentClauses"
            name="consentClauses"
            checked={clauses}
            onChange={setClauses}
            required
            error={fieldErrors.consentClauses}
            label={
              <>
                Dichiaro di <strong>approvare specificamente</strong>
                {isMulti
                  ? ", anche nell'interesse e per conto degli altri partecipanti inclusi nella prenotazione, "
                  : " "}
                le clausole relative a natura dell&apos;Evento e componente
                gastronomica accessoria, allergie e intolleranze, esclusione
                del diritto di recesso, cancellazioni, rinvii e
                riprogrammazioni, modifiche dell&apos;Evento, comportamento dei
                partecipanti, utilizzo degli spazi, limitazioni di
                responsabilità e foro competente.
              </>
            }
          />

          <PrivacyToggleCheckbox
            checked={privacy}
            onChange={(v) => setPrivacy(v)}
            required
            extraText={
              isMulti
                ? " e mi impegno a renderla disponibile agli altri partecipanti inclusi nella prenotazione"
                : ""
            }
          />
          {/* Hidden mirror so formData.get("consentPrivacy") works. */}
          <input
            type="hidden"
            name="consentPrivacy"
            value={privacy ? "on" : ""}
          />
          {fieldErrors.consentPrivacy ? (
            <p className="text-xs text-destructive">
              {fieldErrors.consentPrivacy}
            </p>
          ) : null}

          {isMulti ? (
            <>
              <ConsentCheckbox
                id="consentRepresentative"
                name="consentRepresentative"
                checked={consentRepresentative}
                onChange={setConsentRepresentative}
                required
                error={fieldErrors.consentRepresentative}
                label={
                  <>
                    Dichiaro di effettuare la prenotazione anche per conto
                    degli altri partecipanti inclusi nella prenotazione e di
                    essere autorizzato dagli stessi a trasmettere ad Anidra
                    S.r.l. le informazioni necessarie alla gestione
                    dell&apos;Evento.
                  </>
                }
              />

              <ConsentCheckbox
                id="consentInformOthers"
                name="consentInformOthers"
                checked={consentInformOthers}
                onChange={setConsentInformOthers}
                required
                error={fieldErrors.consentInformOthers}
                label={
                  <>
                    Mi impegno a portare a conoscenza degli altri partecipanti,
                    prima dell&apos;Evento, le Condizioni Generali di
                    Partecipazione, l&apos;informativa privacy e le
                    informazioni relative alla natura dell&apos;Evento, alla
                    componente gastronomica accessoria, alle
                    allergie/intolleranze, alle regole di comportamento,
                    all&apos;eventuale presenza di bevande alcoliche e
                    all&apos;eventuale presenza di riprese foto/video.
                  </>
                }
              />
            </>
          ) : null}

          <Separator />

          <h3 className="text-sm font-semibold">Dichiarazione facoltativa</h3>

          <ConsentCheckbox
            id="consentImageUse"
            name="consentImageUse"
            checked={consentImageUse}
            onChange={setConsentImageUse}
            label={
              <>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Facoltativo —{" "}
                </span>
                Acconsento all&apos;utilizzo della mia immagine in modo
                riconoscibile per finalità promozionali, social, editoriali e
                di comunicazione relative al progetto Cooker Girl e al
                Cooker Loft.
              </>
            }
          />
          {isMulti ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Il consenso all&apos;utilizzo dell&apos;immagine riguarda
              esclusivamente il soggetto che effettua la prenotazione. Per gli
              altri partecipanti inclusi nella prenotazione, l&apos;eventuale
              consenso all&apos;utilizzo dell&apos;immagine in modo
              riconoscibile sarà raccolto separatamente, prima o durante
              l&apos;Evento.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riepilogo importo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 rounded-md border bg-card px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              Prezzo per persona
            </span>
            <PriceLabel cents={event.priceCents} size="sm" />
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-md border bg-card px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              Numero partecipanti
            </span>
            <span className="font-medium">{people}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-md bg-primary/5 px-4 py-3">
            <span className="text-sm font-semibold">
              Totale ({people} × prezzo)
            </span>
            <PriceLabel cents={booking.amountCents} size="lg" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            L&apos;importo è quello calcolato al momento dell&apos;accettazione
            della richiesta. La fattura sarà emessa dopo il pagamento.
          </p>
        </CardContent>
      </Card>

      {globalError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {globalError}
        </p>
      ) : null}

      <div className="space-y-3">
        <SubmitButton disabled={!canSubmit} />
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Inviando il modulo confermi la veridicità dei dati forniti e la presa
          visione delle Condizioni e dell&apos;informativa privacy. Verrai
          reindirizzato alla pagina di pagamento.
        </p>
      </div>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className="w-full"
      size="lg"
    >
      {pending ? "Invio in corso…" : "Procedi al pagamento"}
    </Button>
  );
}

/**
 * Inline hint for the Codice Fiscale field (private buyer only).
 *
 * Validation is purely offline (DM 23/12/1976 check digit) — no API
 * calls. The hint is NEVER blocking; the authoritative validation lives
 * in the server zod schema. The hint just helps the user catch typos
 * before submit.
 */
function TaxCodeHint({ value }: { value: string }) {
  const result: TaxCodeValidation = validateItalianTaxCode(value);
  if (result.kind === "empty") return null;
  if (result.kind === "valid") {
    return (
      <p className="text-[11px] text-emerald-700">
        {result.subkind === "personal"
          ? "Codice fiscale formalmente valido."
          : "P.IVA (11 cifre) accettata come codice fiscale."}
      </p>
    );
  }
  // invalid
  if (result.reason === "length") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Il codice fiscale è di 16 caratteri (persone fisiche) oppure 11
        cifre (ditta individuale).
      </p>
    );
  }
  if (result.reason === "format") {
    return (
      <p className="text-[11px] text-amber-700">
        Formato non valido: controlla l&apos;alternanza
        lettere/cifre e che la lettera del mese sia corretta.
      </p>
    );
  }
  // checksum
  return (
    <p className="text-[11px] text-amber-700">
      Carattere di controllo non corretto: controlla di averlo scritto
      correttamente.
    </p>
  );
}

function CapLookupHint({
  state,
}: {
  state:
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "valid" }
    | { kind: "notfound" }
    | { kind: "error" };
}) {
  if (state.kind === "idle") return null;
  if (state.kind === "loading") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Verifica CAP in corso…
      </p>
    );
  }
  if (state.kind === "valid") {
    return (
      <p className="text-[11px] text-emerald-700">CAP riconosciuto.</p>
    );
  }
  if (state.kind === "notfound") {
    return (
      <p className="text-[11px] text-amber-700">
        CAP non riconosciuto: controlla che sia corretto.
      </p>
    );
  }
  return (
    <p className="text-[11px] text-amber-700">
      Impossibile verificare il CAP in questo momento.
    </p>
  );
}

function RequiredMark() {
  return (
    <span
      aria-label="campo obbligatorio"
      className="ml-0.5 font-semibold text-rose-600"
    >
      *
    </span>
  );
}

function Field({
  id,
  label,
  required,
  error,
  sm,
  children,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  sm?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${sm ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id} className="flex items-center gap-0.5">
        <span>{label}</span>
        {required ? <RequiredMark /> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function ReadonlyField({
  icon,
  label,
  value,
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-md border bg-muted/30 p-3 ${className ?? ""}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {value}
      </p>
    </div>
  );
}

function LegalLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="#legal-document"
      className="font-semibold underline underline-offset-2"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        document
          .getElementById("legal-document")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}

function ConsentCheckbox({
  id,
  name,
  checked,
  onChange,
  label,
  required,
  error,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 ${
          required && !checked
            ? "border-rose-300/70 bg-rose-50/30"
            : ""
        }`}
      >
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onChange(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm leading-snug">
          {label}
          {required ? <RequiredMark /> : null}
        </span>
      </label>
      {/* Hidden mirror so Radix Checkbox state participates in FormData. */}
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
