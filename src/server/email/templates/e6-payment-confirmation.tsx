import "server-only";

import { Section, Text } from "@react-email/components";
import * as React from "react";

import {
  EventRecap,
  Heading,
  InfoBlock,
  Paragraph,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E6Props = {
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountPaidCents: number;
  /** Legal name from `fiscal_profiles.legal_name`. */
  fiscalLegalName: string;
  /** City from `fiscal_profiles.address_city`. */
  fiscalCity: string;
};

/**
 * E6 — Payment confirmation (REQUIRED).
 *
 * Triggered by the Stripe webhook handler in
 * `app/api/stripe/webhook/route.ts` after the booking transitions to
 * `paid`. Idempotent at the sender level via key
 * `payment_confirmed:{bookingId}` — paid is terminal so we use the
 * booking id alone (no revision needed).
 *
 * Content rules (docs/EMAILS.md §4 E6):
 *  - Recap evento (titolo, data/ora, partecipanti).
 *  - Importo pagato (gross, IVA inclusa).
 *  - Recap fiscale minimo: nome legale + città. No CF/PIVA, no indirizzo
 *    completo, no SDI/PEC.
 *  - Nota fattura standard.
 *  - Contatto venue dal footer del layout.
 */
export function E6PaymentConfirmation({
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
  amountPaidCents,
  fiscalLegalName,
  fiscalCity,
}: E6Props) {
  const preview = `Pagamento ricevuto — ${eventTitle}`;
  return (
    <EmailLayout preview={preview}>
      <Heading>Pagamento ricevuto, grazie {requesterFirstName}!</Heading>

      <Paragraph>
        Abbiamo registrato correttamente il pagamento per la tua prenotazione.
        La tua partecipazione è <strong>confermata</strong>.
      </Paragraph>

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
          amountCents: amountPaidCents,
        }}
      />

      <Section style={fiscalRecapStyle}>
        <Text style={fiscalLabelStyle}>Fattura intestata a</Text>
        <Text style={fiscalValueStyle}>{fiscalLegalName}</Text>
        <Text style={fiscalLabelStyle}>Città</Text>
        <Text style={fiscalValueStyle}>{fiscalCity}</Text>
      </Section>

      <InfoBlock>
        L&apos;amministrazione invierà la fattura secondo i dati fiscali
        forniti. Riceverai un&apos;email separata con il documento appena
        disponibile.
      </InfoBlock>

      <Paragraph>
        Ci vediamo presto al loft.
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

const fiscalRecapStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  margin: "16px 0",
  padding: "16px",
};

const fiscalLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  margin: "8px 0 2px 0",
  textTransform: "uppercase",
};

const fiscalValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: 600,
  lineHeight: "1.4",
  margin: "0 0 4px 0",
};

export default E6PaymentConfirmation;
