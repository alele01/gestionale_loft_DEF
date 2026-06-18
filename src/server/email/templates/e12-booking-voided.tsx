import "server-only";

import * as React from "react";

import {
  EventRecap,
  Heading,
  Paragraph,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E12Props = {
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
};

/**
 * E12 — Booking voided before payment (admin delete).
 *
 * Sent when staff delete a prenotazione still in awaiting_completion or
 * awaiting_payment. The admin's internal reason is NEVER included.
 */
export function E12BookingVoided({
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
}: E12Props) {
  return (
    <EmailLayout preview={`Aggiornamento sulla tua prenotazione — ${eventTitle}`}>
      <Heading>Ciao {requesterFirstName}, un aggiornamento sulla tua prenotazione</Heading>
      <Paragraph>
        Purtroppo, non avendo finalizzato la prenotazione, abbiamo dovuto
        liberare i tuoi posti per altri partecipanti.
      </Paragraph>

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
        }}
      />

      <Paragraph>
        Speriamo di poterti accogliere presto in un altro evento!
      </Paragraph>

      <Paragraph>
        Grazie mille.
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E12BookingVoided;
