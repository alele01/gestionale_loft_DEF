import "server-only";

import * as React from "react";

import {
  EventRecap,
  Heading,
  InfoBlock,
  Paragraph,
  PrimaryButton,
  WarningBlock,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E7Props = {
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountCents: number;
  /** Reason hint surfaced to the user; never a raw Stripe error code. */
  reason: "session_expired" | "payment_failed";
  /** Absolute URL to `/pay/[bookingId]` landing page. */
  payRetryUrl: string;
};

/**
 * E7 — Payment retry (REQUIRED when a payment attempt does not succeed).
 *
 * Triggered by the Stripe webhook handler on `checkout.session.expired`
 * or `payment_intent.payment_failed`. The link points to a thin landing
 * page that calls `recreateCheckoutSession` and redirects to a fresh
 * Stripe Checkout — the user does NOT need to re-fill the completion
 * form (already submitted and stored in `bookings.consents`).
 *
 * Idempotency anchor at sender level: `payment_retry:{bookingId}:{sessionId}`.
 * Multiple declines inside the SAME Stripe session do not produce extra
 * mails (Stripe Checkout already lets the user retry inline). A NEW
 * session id (after recreate or after a real expiration) is treated as
 * a new "retry needed" trigger.
 */
export function E7PaymentRetry({
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
  amountCents,
  reason,
  payRetryUrl,
}: E7Props) {
  const preview =
    reason === "session_expired"
      ? `Pagamento non concluso — riprendi per ${eventTitle}`
      : `Pagamento non riuscito — riprova per ${eventTitle}`;
  return (
    <EmailLayout preview={preview}>
      <Heading>Ciao {requesterFirstName}, riprendiamo da dove eri rimasto</Heading>

      {reason === "session_expired" ? (
        <WarningBlock>
          La pagina di pagamento è scaduta prima del completamento. Nessun
          addebito è stato effettuato e la tua prenotazione è ancora attiva.
        </WarningBlock>
      ) : (
        <WarningBlock>
          L&apos;ultimo tentativo di pagamento non è andato a buon fine.
          Nessun importo è stato addebitato e la tua prenotazione è ancora
          attiva.
        </WarningBlock>
      )}

      <Paragraph>
        Non serve ricompilare il modulo: i dati fiscali e i consensi sono già
        stati salvati. Usa il pulsante qui sotto per aprire una nuova pagina
        di pagamento sicura.
      </Paragraph>

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
          amountCents,
        }}
      />

      <PrimaryButton href={payRetryUrl}>
        Riprendi il pagamento
      </PrimaryButton>

      <InfoBlock>
        Il pulsante apre una nuova sessione Stripe Checkout. Se anche questa
        scade, puoi sempre riaprire questa email e cliccare di nuovo: il
        sistema genera ogni volta un link fresco finché la prenotazione resta
        in attesa di pagamento.
      </InfoBlock>

      <Paragraph>
        A presto,
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E7PaymentRetry;
