import "server-only";

import * as React from "react";

import { EmailLayout } from "./_layout";
import {
  EventRecap,
  Heading,
  Paragraph,
} from "./_components";

export type E1Props = {
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
};

/**
 * E1 — Request received (optional, see docs/EMAILS.md §4).
 * Friendly acknowledgement. NOT a confirmation, no payment link.
 */
export function E1RequestReceived({
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
}: E1Props) {
  return (
    <EmailLayout preview={`Abbiamo ricevuto la tua richiesta per ${eventTitle}`}>
      <Heading>Ciao {requesterFirstName}, abbiamo ricevuto la tua richiesta</Heading>
      <Paragraph>
        Grazie per aver inviato la tua richiesta di prenotazione, che è stata
        registrata correttamente. Il nostro team ti contatterà il prima possibile
        per informarti sullo stato della tua richiesta.
      </Paragraph>
      <Paragraph>
        <strong>Attenzione, questa non è ancora una conferma:</strong> ti
        scriveremo non appena la richiesta sarà validata, con le indicazioni per
        completare la prenotazione, oppure con un aggiornamento sullo stato.
      </Paragraph>

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
        }}
      />

      <Paragraph>Grazie ancora!</Paragraph>
      <Paragraph>
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E1RequestReceived;
