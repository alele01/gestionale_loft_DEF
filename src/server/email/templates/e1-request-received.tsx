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
        Grazie per averci scritto. Abbiamo registrato la tua richiesta di
        prenotazione e il nostro team la valuterà nei prossimi giorni.
      </Paragraph>
      <Paragraph>
        <strong>Questa non è ancora una conferma:</strong> ti scriveremo non
        appena la richiesta sarà esaminata, con le indicazioni per completare
        la prenotazione oppure con un aggiornamento sullo stato.
      </Paragraph>

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
        }}
      />

      <Paragraph>A presto,</Paragraph>
      <Paragraph>
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E1RequestReceived;
