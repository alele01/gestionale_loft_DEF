import "server-only";

import { appendAuditLogWithClient } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS, AUDIT_ENTITIES } from "@/server/audit-actions";
import { validateItalianTaxCode } from "@/lib/codice-fiscale";
import { isValidProvinceCode } from "@/lib/italian-provinces";
import { isValidPartitaIva } from "@/lib/partita-iva";
import { createCheckoutSession } from "@/server/stripe";
import {
  validateInvoiceInput,
  XmlValidationError,
  type InvoiceInput,
} from "@/modules/xml-export";

import { createActionContext } from "../context";
import {
  InvalidTransitionError,
  NotFoundError,
  TokenInvalidError,
  ValidationError,
} from "../errors";
import { hashCompletionToken, hashToPostgresHex } from "../token";
import type { Actor, BookingRow } from "../types";

export type FiscalProfileInput = {
  kind: "private" | "company";
  /**
   * Synthesised display name (`"{first} {last}"` for private buyers,
   * ragione sociale for companies). Kept on the `fiscal_profiles.legal_name`
   * column for backward-compat with email/UI paths that already render it.
   */
  legalName: string;
  /** Required for `kind = "private"`. Maps to FatturaPA `Anagrafica.Nome`. */
  firstName: string | null;
  /** Required for `kind = "private"`. Maps to FatturaPA `Anagrafica.Cognome`. */
  lastName: string | null;
  taxCode: string | null;
  vatNumber: string | null;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  addressProvince: string | null;
  addressCountry: string;
  sdiCode: string | null;
  pecEmail: string | null;
  invoiceNote: string | null;
};

export type CompletionConsentsInput = {
  legalAcceptedAt: string; // ISO
  privacyAcceptedAt: string;
  /**
   * Set when the user declared any allergy/health info (own OR minor).
   * Null otherwise — we only record health-data consent when health data
   * is actually provided.
   */
  healthConsentAcceptedAt: string | null;
  imageUseChoice: "accept" | "decline";
  ip: string;
  userAgent: string;
  /** Snapshot of versions accepted, persisted as JSONB into bookings.consents. */
  versions: {
    terms: string;
    privacy: string;
    health: string;
    image_use: string;
    clauses_1341_1342: string;
  };
};

export type ParticipantsBlockInput = {
  kind: "only_me" | "with_others";
  otherParticipantsNames: string | null;
  allergiesPresent: "yes" | "no";
  allergiesDetails: string | null;
  /**
   * Mandatory declaration that the readonly allergies block accurately
   * covers ALL participants (or that none has any). Acts as a liability
   * anchor — see docs/STATES.md.
   */
  consentAllergiesDeclaration: boolean;
  consentRepresentative: boolean;
  consentInformOthers: boolean;
};

export type MinorsBlockInput = {
  included: "yes" | "no";
  minorsNames: string | null;
  guardianName: string | null;
  allergiesPresent: "yes" | "no" | null;
  /**
   * True when the user explicitly confirmed the minor's allergies are
   * within the ones already declared at request time (which live on
   * `booking.dietary_notes`). Replaces the previous free-text field.
   */
  allergiesConfirmedInRequest: boolean;
  consentParental: boolean;
  consentImageUse: boolean;
};

export type CompleteBookingInput = {
  /** Plaintext token from /complete/[token]. */
  tokenPlaintext: string;
  actor: Actor;
  fiscal: FiscalProfileInput;
  consents: CompletionConsentsInput;
  participants: ParticipantsBlockInput;
  minors: MinorsBlockInput;
};

export type CompleteBookingResult = {
  booking: BookingRow;
  /**
   * Hosted Stripe Checkout URL. The completion form server action returns
   * this to the client, which immediately performs a top-level navigation
   * to it (no intermediate page).
   */
  checkoutUrl: string;
  /** Stripe Checkout Session id (cs_test_... / cs_live_...). */
  stripeSessionId: string;
};

/**
 * Representative-facing transition: awaiting_completion → awaiting_payment.
 *
 * Writes the fiscal_profiles row, stores the consent snapshot on the
 * booking, creates a real Stripe Checkout Session (server-side amount
 * calculation), and returns the hosted URL so the caller can redirect.
 *
 * Hard rules enforced here (binding, see docs/SECURITY.md §6):
 *   - `amount_cents` is recomputed server-side as
 *     `event.price_cents * booking.people`; we refuse to proceed if the
 *     two diverge from the stored value (defensive against drift between
 *     pre-payment edits and the completion submit).
 *   - The Stripe session is created BEFORE the bookings UPDATE so a Stripe
 *     failure does not leave the booking in `awaiting_payment` without a
 *     usable session.
 *   - `bookings.stripe_session_id` is overwritten with the real Stripe id;
 *     the previous placeholder (if any) is purely informational.
 */
export async function completeBooking(
  input: CompleteBookingInput
): Promise<CompleteBookingResult> {
  if (!input.tokenPlaintext) throw new TokenInvalidError();

  validateFiscal(input.fiscal);
  validateParticipantsAndMinors(input);

  const ctx = await createActionContext();

  const hash = hashCompletionToken(input.tokenPlaintext);
  const bookingRes = await ctx.client
    .from("bookings")
    .select("*, events(id, title, price_cents, starts_at, vat_rate_bps)")
    .filter("completion_token_hash", "eq", hashToPostgresHex(hash))
    .maybeSingle();
  if (bookingRes.error) throw bookingRes.error;
  if (!bookingRes.data) throw new TokenInvalidError();

  const booking = bookingRes.data;
  if (booking.status !== "awaiting_completion") {
    throw new InvalidTransitionError(booking.status, "awaiting_payment");
  }
  if (booking.completion_token_used_at) {
    throw new TokenInvalidError();
  }

  const completionDeadline = booking.completion_deadline_at
    ? new Date(booking.completion_deadline_at)
    : null;
  if (completionDeadline && ctx.now > completionDeadline) {
    throw new TokenInvalidError();
  }

  // Server-side amount sanity check: amount_cents on the booking must equal
  // event.price_cents * booking.people. If they diverge (e.g. an admin edit
  // raced with the rep submit), refuse to proceed — better to surface a
  // clear error than to ship a Stripe amount that does not match the DB.
  const eventForBooking = booking.events;
  if (!eventForBooking) throw new NotFoundError("Evento");
  const expectedAmount = eventForBooking.price_cents * booking.people;
  if (expectedAmount !== booking.amount_cents) {
    throw new ValidationError(
      `Importo non coerente con l'evento (atteso ${expectedAmount}c, trovato ${booking.amount_cents}c). Ricarica la pagina e riprova.`
    );
  }

  // Dry-run "a prova di fattura": prima di mandare al pagamento, verifichiamo
  // che con questi dati l'XML FatturaPA sarebbe effettivamente generabile,
  // applicando le stesse regole del job di export. Se qualcosa non torna
  // (qualunque campo, anche futuro), blocchiamo QUI — così non esiste lo
  // scenario "prenotazione pagata ma fattura non generabile".
  assertInvoiceGeneratable({
    bookingId: booking.id,
    fiscal: input.fiscal,
    people: booking.people,
    amountCents: booking.amount_cents,
    unitGrossPriceCents: eventForBooking.price_cents,
    vatRateBps: eventForBooking.vat_rate_bps,
    eventTitle: eventForBooking.title,
    nowIso: ctx.now.toISOString(),
  });

  // Upsert fiscal_profiles (booking_id is the unique key).
  const fiscalUpsert = await ctx.client
    .from("fiscal_profiles")
    .upsert(
      {
        booking_id: booking.id,
        kind: input.fiscal.kind,
        legal_name: input.fiscal.legalName.trim(),
        first_name:
          input.fiscal.kind === "private"
            ? input.fiscal.firstName?.trim() || null
            : null,
        last_name:
          input.fiscal.kind === "private"
            ? input.fiscal.lastName?.trim() || null
            : null,
        tax_code: input.fiscal.taxCode?.trim() || null,
        vat_number: input.fiscal.vatNumber?.trim() || null,
        address_street: input.fiscal.addressStreet.trim(),
        address_city: input.fiscal.addressCity.trim(),
        address_zip: input.fiscal.addressZip.trim(),
        address_province: input.fiscal.addressProvince?.trim() || null,
        address_country: (input.fiscal.addressCountry || "IT").trim(),
        sdi_code: input.fiscal.sdiCode?.trim() || null,
        pec_email: input.fiscal.pecEmail?.trim() || null,
        invoice_note: input.fiscal.invoiceNote?.trim() || null,
      },
      { onConflict: "booking_id" }
    )
    .select("id")
    .single();
  if (fiscalUpsert.error) throw fiscalUpsert.error;

  // Load requester contact for Stripe `customer_email` + receipt.
  const requestRes = await ctx.client
    .from("booking_requests")
    .select("requester_email, requester_first_name, requester_last_name")
    .eq("id", booking.request_id)
    .maybeSingle();
  if (requestRes.error) throw requestRes.error;
  const requester = requestRes.data;
  if (!requester?.requester_email) {
    throw new NotFoundError("Email del referente");
  }

  const paymentDeadlineAt = new Date(
    ctx.now.getTime() + ctx.settings.payment_window_hours * 60 * 60 * 1000
  ).toISOString();

  // Create Stripe Checkout Session BEFORE the booking UPDATE so any
  // Stripe-side failure does not move the booking into awaiting_payment
  // without a usable session id. The Idempotency-Key embedded inside
  // createCheckoutSession protects against double-submit by the user.
  const checkoutSession = await createCheckoutSession(
    {
      booking: {
        id: booking.id,
        revision: booking.revision + 1,
        people: booking.people,
        amountCents: booking.amount_cents,
        paymentDeadlineAt,
      },
      event: {
        id: eventForBooking.id,
        title: eventForBooking.title,
        pricePerPersonCents: eventForBooking.price_cents,
      },
      requester: {
        email: requester.requester_email,
        fullName: `${requester.requester_first_name ?? ""} ${
          requester.requester_last_name ?? ""
        }`.trim(),
      },
    },
    ctx.now
  );

  // dietary_notes is the authoritative free-text list of allergies
  // declared at request time. We do NOT touch it during completion —
  // allergies are locked once the staff accepted the request.

  const consentsJson = {
    terms_accepted_at: input.consents.legalAcceptedAt,
    privacy_accepted_at: input.consents.privacyAcceptedAt,
    health_accepted_at: input.consents.healthConsentAcceptedAt,
    image_use_choice: input.consents.imageUseChoice,
    versions: input.consents.versions,
    ip: input.consents.ip,
    user_agent: input.consents.userAgent,
    completed_at: ctx.now.toISOString(),

    participants: {
      kind: input.participants.kind,
      other_participants_names:
        input.participants.otherParticipantsNames ?? null,
      allergies_present: input.participants.allergiesPresent,
      allergies_details: input.participants.allergiesDetails ?? null,
      consent_allergies_declaration_at:
        input.participants.consentAllergiesDeclaration
          ? ctx.now.toISOString()
          : null,
      consent_representative_at:
        input.participants.consentRepresentative
          ? ctx.now.toISOString()
          : null,
      consent_inform_others_at:
        input.participants.consentInformOthers
          ? ctx.now.toISOString()
          : null,
    },
    minors: {
      included: input.minors.included,
      names: input.minors.minorsNames ?? null,
      guardian_name: input.minors.guardianName ?? null,
      allergies_present: input.minors.allergiesPresent,
      // Within-request confirmation replaces a free-text details field:
      // the actual allergy list lives on booking.dietary_notes.
      allergies_confirmed_in_request:
        input.minors.allergiesConfirmedInRequest,
      consent_parental_at:
        input.minors.consentParental ? ctx.now.toISOString() : null,
      consent_image_use_at:
        input.minors.consentImageUse ? ctx.now.toISOString() : null,
    },
  };

  const update = await ctx.client
    .from("bookings")
    .update({
      status: "awaiting_payment",
      revision: booking.revision + 1,
      completion_token_used_at: ctx.now.toISOString(),
      stripe_session_id: checkoutSession.sessionId,
      payment_deadline_at: paymentDeadlineAt,
      consents: consentsJson as never,
      legal_accepted_at: input.consents.legalAcceptedAt,
      privacy_accepted_at: input.consents.privacyAcceptedAt,
      health_consent_accepted_at: input.consents.healthConsentAcceptedAt,
      image_use_choice: input.consents.imageUseChoice,
      consent_ip: input.consents.ip,
      consent_user_agent: input.consents.userAgent,
    })
    .eq("id", booking.id)
    .select("*")
    .single();
  if (update.error || !update.data) throw update.error ?? new Error("Update failed");

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: booking.id,
    action: AUDIT_ACTIONS.stripeCheckoutCreated,
    actorType: AUDIT_ACTORS.system,
    metadata: {
      stripe_session_id: checkoutSession.sessionId,
      expires_at_unix: checkoutSession.expiresAt,
      amount_cents: booking.amount_cents,
      revision: booking.revision + 1,
      trigger: "complete_booking",
    },
  });

  await appendAuditLogWithClient(ctx.client, {
    entityType: AUDIT_ENTITIES.booking,
    entityId: booking.id,
    action: AUDIT_ACTIONS.bookingCompleted,
    actorType: AUDIT_ACTORS.representative,
    fromState: "awaiting_completion",
    toState: "awaiting_payment",
    metadata: {
      fiscal_kind: input.fiscal.kind,
      stripe_session_id: checkoutSession.sessionId,
      payment_deadline_at: paymentDeadlineAt,
      participants_kind: input.participants.kind,
      allergies_declared:
        input.participants.allergiesPresent === "yes" ||
        (input.minors.included === "yes" &&
          input.minors.allergiesPresent === "yes"),
      minors_included: input.minors.included === "yes",
      image_use: input.consents.imageUseChoice,
    },
  });

  return {
    booking: update.data,
    checkoutUrl: checkoutSession.sessionUrl,
    stripeSessionId: checkoutSession.sessionId,
  };
}

function validateParticipantsAndMinors(input: CompleteBookingInput) {
  const p = input.participants;
  if (!p.consentAllergiesDeclaration) {
    throw new ValidationError(
      "Conferma sulle allergie di tutti i partecipanti richiesta"
    );
  }
  if (p.kind === "with_others") {
    if (!p.consentRepresentative) {
      throw new ValidationError("Consenso ruolo referente richiesto");
    }
    if (!p.consentInformOthers) {
      throw new ValidationError(
        "Impegno a informare gli altri partecipanti richiesto"
      );
    }
  }

  const m = input.minors;
  if (m.included === "yes") {
    if (!m.minorsNames?.trim()) {
      throw new ValidationError("Nome e cognome del minore richiesti");
    }
    if (!m.guardianName?.trim()) {
      throw new ValidationError(
        "Nome e cognome del genitore/tutore richiesti"
      );
    }
    if (!m.consentParental) {
      throw new ValidationError(
        "Dichiarazione responsabilità genitoriale richiesta"
      );
    }
    if (!m.allergiesPresent) {
      throw new ValidationError(
        "Specifica se il minore ha allergie/intolleranze"
      );
    }
    if (m.allergiesPresent === "yes" && !m.allergiesConfirmedInRequest) {
      throw new ValidationError(
        "Conferma che le allergie del minore sono tra quelle già segnalate, oppure contatta lo staff"
      );
    }
  }
}

/**
 * Build a placeholder `InvoiceInput` from the completion data and run the
 * XML module's `validateInvoiceInput`. We do NOT generate or persist any
 * XML here — this is a pure validation pass that mirrors EXACTLY what the
 * monthly export job will require, so that any booking we let through to
 * payment is guaranteed to be invoiceable later.
 *
 * Placeholder values (invoice number / transmission progressive / paid-at)
 * are well-formed dummies: at completion time the real ones don't exist
 * yet, and they don't depend on user input — only the buyer/amount data
 * does, which is what we actually want to validate.
 */
function assertInvoiceGeneratable(args: {
  bookingId: string;
  fiscal: FiscalProfileInput;
  people: number;
  amountCents: number;
  unitGrossPriceCents: number;
  vatRateBps: number;
  eventTitle: string;
  nowIso: string;
}) {
  const fp = args.fiscal;
  const address = {
    street: fp.addressStreet.trim(),
    streetNumber: null,
    zip: fp.addressZip.trim(),
    city: fp.addressCity.trim(),
    province: (fp.addressProvince ?? "").trim().toUpperCase(),
    country: "IT" as const,
  };

  const buyer: InvoiceInput["buyer"] =
    fp.kind === "private"
      ? {
          kind: "private",
          taxCode: (fp.taxCode ?? "").trim(),
          firstName: (fp.firstName ?? "").trim(),
          lastName: (fp.lastName ?? "").trim(),
          address,
          sdiCode: fp.sdiCode?.trim() || null,
          pecEmail: fp.pecEmail?.trim() || null,
        }
      : {
          kind: "company",
          vatNumber: (fp.vatNumber ?? "").replace(/\s+/g, ""),
          taxCode: fp.taxCode?.trim() || null,
          denomination: fp.legalName.trim(),
          address,
          sdiCode: fp.sdiCode?.trim() || "0000000",
          pecEmail: fp.pecEmail?.trim() || null,
        };

  const dryRun: InvoiceInput = {
    bookingId: args.bookingId,
    // Placeholders: shape-valid, assigned for real only by the export job.
    invoiceNumber: "2026/0001",
    transmissionProgressive: "0000000001",
    paidAtIso: args.nowIso,
    currency: "EUR",
    grossAmountCents: args.amountCents,
    vatRateBps: args.vatRateBps,
    line: {
      description: `${args.eventTitle} — anteprima fattura`,
      quantity: args.people,
      unitGrossPriceCents: args.unitGrossPriceCents,
    },
    buyer,
    paymentMode: "MP08",
  };

  try {
    validateInvoiceInput(dryRun);
  } catch (err) {
    if (err instanceof XmlValidationError) {
      throw new ValidationError(
        `I dati di fatturazione non sono validi: ${err.message}. Correggili prima di procedere al pagamento.`
      );
    }
    throw err;
  }
}

function validateFiscal(fp: FiscalProfileInput) {
  if (!fp.legalName.trim()) throw new ValidationError("Nominativo richiesto");
  if (!fp.addressStreet.trim()) throw new ValidationError("Indirizzo richiesto");
  if (!fp.addressCity.trim()) throw new ValidationError("Città richiesta");
  if (!fp.addressZip.trim()) throw new ValidationError("CAP richiesto");
  const zip = fp.addressZip.replace(/\s+/g, "");
  if (!/^\d{5}$/.test(zip)) {
    throw new ValidationError("CAP italiano: 5 cifre");
  }
  // Nazione forzata IT in questo modulo. Modifiche estere passano via staff.
  if ((fp.addressCountry || "").toUpperCase() !== "IT") {
    throw new ValidationError(
      "Nazione: solo IT in questo modulo. Per fatture estere contatta lo staff."
    );
  }
  // Provincia obbligatoria, deve essere una sigla ISTAT valida.
  if (!isValidProvinceCode(fp.addressProvince)) {
    throw new ValidationError(
      "Sigla provincia non valida (es. TO, MI, RM)"
    );
  }
  if (fp.kind === "private") {
    if (!fp.firstName?.trim()) {
      throw new ValidationError("Nome richiesto per privato");
    }
    if (!fp.lastName?.trim()) {
      throw new ValidationError("Cognome richiesto per privato");
    }
    if (!fp.taxCode?.trim()) {
      throw new ValidationError("Codice fiscale richiesto per privato");
    }
    // Carattere di controllo (DM 23/12/1976) o P.IVA usata come CF.
    if (validateItalianTaxCode(fp.taxCode).kind !== "valid") {
      throw new ValidationError("Codice fiscale non valido");
    }
  } else if (fp.kind === "company") {
    if (!fp.vatNumber?.trim()) {
      throw new ValidationError("Partita IVA richiesta per azienda");
    }
    if (!isValidPartitaIva(fp.vatNumber)) {
      throw new ValidationError("Partita IVA non valida (11 cifre)");
    }
    // SDI OBBLIGATORIO (7 caratteri alfanumerici). PEC facoltativa, ma se
    // presente deve essere un indirizzo email valido.
    if (
      !fp.sdiCode ||
      !/^[A-Z0-9]{7}$/i.test(fp.sdiCode.trim())
    ) {
      throw new ValidationError(
        "Codice SDI obbligatorio: 7 caratteri alfanumerici"
      );
    }
    if (
      fp.pecEmail &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fp.pecEmail.trim())
    ) {
      throw new ValidationError("PEC non valida");
    }
  } else {
    throw new ValidationError("Tipo soggetto non valido");
  }
}
