import "server-only";

import * as React from "react";

import {
  EventRecap,
  Heading,
  InfoBlock,
  Paragraph,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E4Props = {
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
};

/**
 * E4 — Request waitlisted (REQUIRED).
 *
 * No payment link, no completion token. We tell the requester they are on
 * the waitlist and will receive a separate email (E5) if a seat opens up.
 */
export function E4RequestWaitlisted({
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
}: E4Props) {
  return (
    <EmailLayout preview={`Sei in lista d'attesa per ${eventTitle}`}>
      <Heading>Ciao {requesterFirstName}, sei in lista d&apos;attesa</Heading>
      <Paragraph>
        Abbiamo ricevuto la tua richiesta e l&apos;abbiamo inserita nella{" "}
        <strong>lista d&apos;attesa</strong> per questo evento. Al momento non
        ci sono posti disponibili, ma ti scriveremo se la situazione cambia.
      </Paragraph>

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
        }}
      />

      <InfoBlock>
        <strong>Questa non è una conferma.</strong> Nessun pagamento è dovuto
        in questo momento. Se si libera un posto, riceverai una email
        separata con un link per completare la prenotazione e pagare.
      </InfoBlock>

      <Paragraph>
        Grazie per la pazienza,
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E4RequestWaitlisted;
