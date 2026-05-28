import "server-only";

import * as React from "react";

import type { AcceptanceMode } from "../types";

import {
  EventRecap,
  Heading,
  InfoBlock,
  Paragraph,
  PrimaryButton,
  WarningBlock,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E2Props = {
  mode: AcceptanceMode;
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountCents: number;
  completionUrl: string;
};

/**
 * E2 — Request accepted + completion link (REQUIRED).
 *
 * Used for bookings with origin='direct'. The `mode='amendment'` variant is
 * sent on pre-payment edits that rotate the token; copy reflects that the
 * previous link is no longer valid.
 */
export function E2RequestAccepted({
  mode,
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
  amountCents,
  completionUrl,
}: E2Props) {
  const isAmendment = mode === "amendment";
  const preview = isAmendment
    ? `Prenotazione aggiornata — completa nuovamente per ${eventTitle}`
    : `Richiesta accettata — completa la prenotazione per ${eventTitle}`;
  return (
    <EmailLayout preview={preview}>
      {isAmendment ? (
        <>
          <Heading>Ciao {requesterFirstName}, abbiamo aggiornato la tua prenotazione</Heading>
          <WarningBlock>
            Abbiamo aggiornato i dati della tua prenotazione su tua richiesta.
            Per completare il pagamento utilizza il <strong>nuovo</strong> link
            qui sotto. Il link precedente <strong>non è più valido</strong>.
          </WarningBlock>
        </>
      ) : (
        <>
          <Heading>Ottime notizie, {requesterFirstName}!</Heading>
          <Paragraph>
            La tua richiesta di prenotazione è stata <strong>accettata</strong>.
            Per confermare definitivamente un posto, completa i dati richiesti
            e procedi al pagamento entro il termine indicato.
          </Paragraph>
        </>
      )}

      <EventRecap
        data={{
          eventTitle,
          eventStartsAt,
          people,
          amountCents,
        }}
      />

      <PrimaryButton href={completionUrl}>
        Completa la prenotazione e paga
      </PrimaryButton>

      <InfoBlock>
        Apri il link da un browser sul telefono o sul computer. Servirà qualche
        minuto: avrai bisogno di dati anagrafici e fiscali per la fattura.
      </InfoBlock>

      <Paragraph>
        Grazie ancora,
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E2RequestAccepted;
