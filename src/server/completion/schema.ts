import { z } from "zod";

import { validateItalianTaxCode } from "@/lib/codice-fiscale";
import { ITALIAN_PROVINCE_CODES } from "@/lib/italian-provinces";
import { isValidPartitaIva } from "@/lib/partita-iva";

/**
 * Schema for the /complete/[token] form submission.
 *
 * The form has three logical sections beyond the fiscal block:
 *   1. Participants (single vs. multi-attendee + names + structured allergies)
 *   2. Minors (Y/N + names + guardian + structured allergies)
 *   3. Consents (terms, clauses, privacy, representative*, inform-others*,
 *      optional image-use, parental*, optional minor image-use)
 *
 * Conditional rules:
 *   - participantsKind === "with_others" → otherParticipantsNames stays
 *     optional, consentRepresentative + consentInformOthers required.
 *   - allergiesPresent === "yes" → allergiesDetails required.
 *   - minorsIncluded === "yes" → minorsNames, guardianName,
 *     consentMinorParental, minorAllergiesPresent required.
 *   - minorAllergiesPresent === "yes" → minorAllergiesDetails required.
 *
 * The validations here mirror those done inside the state machine
 * (`validateFiscal`) plus the new structured fields.
 */

export const FiscalKindSchema = z.enum(["private", "company"]);
export type FiscalKind = z.infer<typeof FiscalKindSchema>;

export const ParticipantsKindSchema = z.enum(["only_me", "with_others"]);
export type ParticipantsKind = z.infer<typeof ParticipantsKindSchema>;

export const YesNoSchema = z.enum(["yes", "no"]);
export type YesNo = z.infer<typeof YesNoSchema>;

/**
 * Empty strings, `null` and missing FormData entries all normalize to
 * `undefined` so `.optional()` actually behaves as expected.
 */
function trimmedOptional(maxLen = 500) {
  return z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined;
      if (typeof v !== "string") return v;
      const t = v.trim();
      return t === "" ? undefined : t;
    },
    z.string().max(maxLen).optional()
  );
}

function consentCheckbox(message: string) {
  return z.literal("on", { message });
}

function optionalCheckbox() {
  // The hidden input emits "on" when checked, "" otherwise; we map both
  // to a boolean so the rest of the pipeline doesn't have to care.
  return z.preprocess(
    (v) => v === "on" || v === true,
    z.boolean()
  );
}

export const CompletionFormSchema = z
  .object({
    token: z.string().min(8, "Token mancante"),

    fiscalKind: FiscalKindSchema,
    /**
     * For PRIVATE buyers the form ships `firstName` + `lastName` (mapped
     * to FatturaPA `Anagrafica.Nome` / `Anagrafica.Cognome`). For COMPANY
     * buyers `legalName` carries the ragione sociale (FatturaPA
     * `Anagrafica.Denominazione`). One block is conditionally required
     * by the `superRefine` below.
     */
    legalName: trimmedOptional(200),
    firstName: trimmedOptional(120),
    lastName: trimmedOptional(120),
    taxCode: trimmedOptional(),
    vatNumber: trimmedOptional(),
    addressStreet: z.string().trim().min(2, "Indirizzo richiesto").max(200),
    /**
     * CAP italiano: ESATTAMENTE 5 cifre. Niente spazi, lettere o trattini —
     * la fatturazione elettronica li rifiuta.
     */
    addressZip: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "CAP italiano: 5 cifre (es. 10121)"),
    addressCity: z.string().trim().min(1, "Città richiesta").max(120),
    /**
     * Sigla provincia OBBLIGATORIA, 2 lettere maiuscole, deve appartenere
     * alla lista ufficiale ISTAT. Nessun valore libero accettato per non
     * compromettere la generazione XML di fatturazione elettronica.
     */
    addressProvince: z
      .string()
      .trim()
      .toUpperCase()
      .length(2, "Provincia obbligatoria")
      .refine((c) => ITALIAN_PROVINCE_CODES.has(c), {
        message: "Sigla provincia non valida (es. TO, MI, RM)",
      }),
    /**
     * Nazione forzata a "IT". Per fatture intestate all'estero si passa
     * per intervento manuale dello staff.
     */
    addressCountry: z.literal("IT", { message: "Nazione: solo IT in questo modulo" }),
    /**
     * Codice destinatario SDI: 7 caratteri alfanumerici maiuscoli.
     * OBBLIGATORIO per le aziende. Per i privati non è applicabile (il
     * form non lo invia).
     */
    sdiCode: z.preprocess(
      (v) => {
        if (v === null || v === undefined) return undefined;
        if (typeof v !== "string") return v;
        const t = v.trim().toUpperCase();
        return t === "" ? undefined : t;
      },
      z
        .string()
        .regex(/^[A-Z0-9]{7}$/, "Codice SDI: 7 caratteri alfanumerici")
        .optional()
    ),
    pecEmail: z.preprocess(
      (v) => {
        if (v === null || v === undefined) return undefined;
        if (typeof v !== "string") return v;
        const t = v.trim().toLowerCase();
        return t === "" ? undefined : t;
      },
      z
        .string()
        .max(200)
        .email("PEC non valida (deve essere un indirizzo email)")
        .optional()
    ),

    participantsKind: ParticipantsKindSchema,
    otherParticipantsNames: trimmedOptional(2000),
    // Allergies are derived from the booking's dietary_notes (locked at
    // request time). The form ships them as hidden inputs for audit.
    allergiesPresent: YesNoSchema,
    allergiesDetails: trimmedOptional(2000),

    minorsIncluded: YesNoSchema,
    minorsNames: trimmedOptional(1000),
    guardianName: trimmedOptional(200),
    minorAllergiesPresent: z.preprocess(
      (v) => (v === null || v === "" ? undefined : v),
      YesNoSchema.optional()
    ),
    // Confirmation that the minor's allergies are within the ones
    // already declared at request time. Replaces the previous free
    // textarea — staff must update the request to add new allergies.
    minorAllergiesConfirmed: optionalCheckbox(),

    consentTerms: consentCheckbox("Consenso Condizioni Generali richiesto"),
    consentClauses: consentCheckbox("Consenso clausole specifiche richiesto"),
    consentPrivacy: consentCheckbox("Consenso privacy richiesto"),
    /**
     * Mandatory regardless of whether the user declared allergies or
     * not: it certifies the readonly block above is accurate for ALL
     * participants. Used as a hard liability anchor.
     */
    consentAllergiesDeclaration: consentCheckbox(
      "Conferma sulle allergie di tutti i partecipanti richiesta"
    ),
    consentRepresentative: optionalCheckbox(),
    consentInformOthers: optionalCheckbox(),
    consentImageUse: optionalCheckbox(),
    consentMinorParental: optionalCheckbox(),
    consentMinorImageUse: optionalCheckbox(),
  })
  .superRefine((data, ctx) => {
    if (data.fiscalKind === "private") {
      if (!data.firstName) {
        ctx.addIssue({
          code: "custom",
          path: ["firstName"],
          message: "Nome richiesto per privato",
        });
      }
      if (!data.lastName) {
        ctx.addIssue({
          code: "custom",
          path: ["lastName"],
          message: "Cognome richiesto per privato",
        });
      }
      // Codice fiscale: oltre al formato, verifichiamo il carattere di
      // controllo (DM 23/12/1976) o, in alternativa, una P.IVA usata come
      // CF (ditta individuale). Così un CF formalmente impossibile viene
      // bloccato PRIMA del pagamento e non manda in errore la fattura.
      const cfCheck = data.taxCode
        ? validateItalianTaxCode(data.taxCode)
        : ({ kind: "empty" } as const);
      if (cfCheck.kind !== "valid") {
        ctx.addIssue({
          code: "custom",
          path: ["taxCode"],
          message:
            cfCheck.kind === "empty"
              ? "Codice fiscale richiesto per privato"
              : cfCheck.reason === "length"
                ? "Codice fiscale: 16 caratteri (o 11 cifre per ditta individuale)"
                : cfCheck.reason === "format"
                  ? "Codice fiscale: formato non valido (controlla lettere/cifre e la lettera del mese)"
                  : "Codice fiscale: carattere di controllo errato, ricontrolla",
        });
      }
    } else {
      // AZIENDA / PROFESSIONISTA
      if (!data.legalName) {
        ctx.addIssue({
          code: "custom",
          path: ["legalName"],
          message: "Ragione sociale richiesta",
        });
      }
      // Partita IVA: 11 cifre CON carattere di controllo valido (algoritmo
      // ufficiale). Intercetta i refusi prima del pagamento, evitando
      // fatture verso P.IVA inesistenti che lo SDI rifiuterebbe.
      if (!data.vatNumber || !isValidPartitaIva(data.vatNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["vatNumber"],
          message: "Partita IVA non valida (11 cifre, controlla il numero)",
        });
      }
      // Codice SDI obbligatorio. La PEC è facoltativa: se presente, è già
      // validata dal preprocess sopra (formato email).
      if (!data.sdiCode) {
        ctx.addIssue({
          code: "custom",
          path: ["sdiCode"],
          message: "Codice SDI obbligatorio per aziende e professionisti",
        });
      }
    }

    if (data.participantsKind === "with_others") {
      if (!data.consentRepresentative) {
        ctx.addIssue({
          code: "custom",
          path: ["consentRepresentative"],
          message:
            "Consenso al ruolo di referente richiesto per prenotazioni multiple",
        });
      }
      if (!data.consentInformOthers) {
        ctx.addIssue({
          code: "custom",
          path: ["consentInformOthers"],
          message:
            "Impegno a informare gli altri partecipanti richiesto",
        });
      }
    }

    if (data.minorsIncluded === "yes") {
      if (!data.minorsNames) {
        ctx.addIssue({
          code: "custom",
          path: ["minorsNames"],
          message: "Nome e cognome del minore richiesti",
        });
      }
      if (!data.guardianName) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianName"],
          message: "Nome e cognome del genitore/tutore richiesti",
        });
      }
      if (!data.consentMinorParental) {
        ctx.addIssue({
          code: "custom",
          path: ["consentMinorParental"],
          message:
            "Dichiarazione responsabilità genitoriale richiesta",
        });
      }
      if (!data.minorAllergiesPresent) {
        ctx.addIssue({
          code: "custom",
          path: ["minorAllergiesPresent"],
          message: "Seleziona Sì o No per le allergie del minore",
        });
      } else if (
        data.minorAllergiesPresent === "yes" &&
        !data.minorAllergiesConfirmed
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["minorAllergiesConfirmed"],
          message:
            "Conferma che le allergie del minore sono tra quelle già segnalate (oppure contatta lo staff per aggiornarle)",
        });
      }
    }
  });

export type CompletionFormValues = z.output<typeof CompletionFormSchema>;
