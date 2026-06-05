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

export type E5Props = {
  mode: AcceptanceMode;
  requesterFirstName: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  amountCents: number;
  completionUrl: string;
};

/**
 * E5 — Accepted from waitlist + completion link (REQUIRED).
 *
 * Used for bookings with origin='waitlist'. Same security/token properties
 * as E2; copy reflects the waitlist lineage.
 */
export function E5AcceptedFromWaitlist({
  mode,
  requesterFirstName,
  eventTitle,
  eventStartsAt,
  people,
  amountCents,
  completionUrl,
}: E5Props) {
  const isAmendment = mode === "amendment";
  const preview = isAmendment
    ? `Prenotazione aggiornata — completa nuovamente per ${eventTitle}`
    : `Buone notizie: posto disponibile per ${eventTitle}`;
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
          <Heading>Buone notizie, {requesterFirstName}!</Heading>
          <Paragraph>
            Si è liberato un posto e siamo riusciti a confermare la tua
            richiesta. Per completare la prenotazione, compila i dati e
            procedi al pagamento.
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
        A presto,
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E5AcceptedFromWaitlist;
