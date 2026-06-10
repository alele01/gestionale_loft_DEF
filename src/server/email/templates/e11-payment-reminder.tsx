import "server-only";

import * as React from "react";

import {
  EventRecap,
  Heading,
  InfoBlock,
  Paragraph,
  PrimaryButton,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E11Props = {
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountCents: number;
  /**
   * Which step the recipient still has to do:
   *  - "complete": booking is awaiting_completion → CTA opens the
   *    `/complete/[token]` form (fiscal data + consents, then payment).
   *  - "pay": booking is awaiting_payment → CTA opens `/pay/[bookingId]`
   *    which recreates a fresh Stripe Checkout.
   */
  mode: "complete" | "pay";
  /** Absolute URL the CTA points to (completion form or payment page). */
  ctaUrl: string;
};

/**
 * E11 — Payment reminder (admin-triggered, bulk per event).
 *
 * Sent manually from the event detail page to every booking still in
 * awaiting_completion / awaiting_payment when the event date approaches.
 * Friendly nudge copy — unlike E7, nothing went wrong: the user simply
 * has not finished yet.
 *
 * Idempotency anchor at sender level: `payment_reminder:{bookingId}:{day}`
 * (Rome calendar day) — at most ONE reminder per booking per day, no
 * matter how many times the admin clicks the button.
 */
export function E11PaymentReminder({
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
  amountCents,
  mode,
  ctaUrl,
}: E11Props) {
  return (
    <EmailLayout preview={`L'evento ${eventTitle} si avvicina — completa la tua prenotazione`}>
      <Heading>Ciao {requesterFirstName}, l&apos;evento si avvicina!</Heading>

      <Paragraph>
        Ti ricordiamo che la tua prenotazione per <strong>{eventTitle}</strong>{" "}
        non è ancora confermata: per bloccare i tuoi posti completa il
        pagamento il prima possibile.
      </Paragraph>

      {mode === "complete" ? (
        <Paragraph>
          Ti basta compilare il modulo con i dati per la fatturazione e
          procedere al pagamento: ci vogliono pochi minuti.
        </Paragraph>
      ) : (
        <Paragraph>
          I tuoi dati sono già stati salvati: manca solo il pagamento. Usa il
          pulsante qui sotto per aprire una pagina di pagamento sicura.
        </Paragraph>
      )}

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
          amountCents,
        }}
      />

      <PrimaryButton href={ctaUrl}>
        {mode === "complete" ? "Completa la prenotazione" : "Vai al pagamento"}
      </PrimaryButton>

      <InfoBlock>
        Se hai già provveduto o hai bisogno di aiuto, rispondi pure a questa
        email: siamo qui per te.
      </InfoBlock>

      <Paragraph>
        A presto,
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E11PaymentReminder;
