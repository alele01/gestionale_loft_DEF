import "server-only";

import * as React from "react";

import {
  EventRecap,
  Heading,
  Paragraph,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E3Props = {
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
};

/**
 * E3 — Request rejected (REQUIRED).
 *
 * Neutral, fixed body. The admin's internal note is NEVER surfaced to the
 * requester (see docs/EMAILS.md §4 E3).
 */
export function E3RequestRejected({
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
}: E3Props) {
  return (
    <EmailLayout preview={`Aggiornamento sulla tua richiesta — ${eventTitle}`}>
      <Heading>Ciao {requesterFirstName}, un aggiornamento sulla tua richiesta</Heading>
      <Paragraph>
        Ti scriviamo per informarti che, purtroppo, non possiamo confermare la
        tua richiesta per questo evento. Speriamo di poterti accogliere in una
        delle prossime occasioni.
      </Paragraph>

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
        }}
      />

      <Paragraph>
        Se vuoi, puoi dare un&apos;occhiata ai prossimi eventi in calendario sul
        nostro sito. Per qualsiasi domanda, rispondi pure a questa email.
      </Paragraph>

      <Paragraph>
        Grazie per averci scelto,
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E3RequestRejected;
