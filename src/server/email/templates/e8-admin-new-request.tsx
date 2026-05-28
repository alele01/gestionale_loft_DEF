import "server-only";

import * as React from "react";

import {
  EventRecap,
  Heading,
  Paragraph,
  PrimaryButton,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E8Props = {
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  requesterFullName: string;
  requesterEmail: string;
  adminUrl: string;
};

/**
 * E8 — Admin internal notice (optional).
 *
 * Sent to every admin_users row when a new booking_request is submitted.
 * Controlled by `app_settings.admin_new_request_email_enabled`.
 */
export function E8AdminNewRequest({
  eventTitle,
  eventStartsAt,
  people,
  requesterFullName,
  requesterEmail,
  adminUrl,
}: E8Props) {
  return (
    <EmailLayout preview={`Nuova richiesta: ${eventTitle} — ${requesterFullName}`}>
      <Heading>Nuova richiesta da rivedere</Heading>
      <Paragraph>
        È arrivata una nuova richiesta di prenotazione su Cooker Loft. Apri il
        gestionale per accettarla, metterla in lista d&apos;attesa o rifiutarla.
      </Paragraph>

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
        }}
      />

      <Paragraph>
        <strong>Richiedente:</strong> {requesterFullName}
        <br />
        <strong>Email:</strong> {requesterEmail}
      </Paragraph>

      <PrimaryButton href={adminUrl}>Apri nel gestionale</PrimaryButton>
    </EmailLayout>
  );
}

export default E8AdminNewRequest;
