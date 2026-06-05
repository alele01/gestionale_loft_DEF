import "server-only";

import * as React from "react";

import {
  Heading,
  Muted,
  Paragraph,
  PrimaryButton,
} from "./_components";
import { EmailLayout } from "./_layout";

export type E9Props = {
  requesterFirstName: string;
  eventTitle: string;
  reviewUrl: string;
};

/**
 * E9 — Google review request (REQUIRED, gated).
 *
 * Sent the day after the event by the daily Vercel Cron at
 * `app/api/cron/review/route.ts`. Gated by `app_settings.review_email_enabled`
 * and `app_settings.review_url`. One-shot per booking; idempotency key
 * `review_request:{bookingId}` prevents duplicates.
 */
export function E9ReviewRequest({
  requesterFirstName,
  eventTitle,
  reviewUrl,
}: E9Props) {
  return (
    <EmailLayout preview="Grazie per aver partecipato — lasciaci una recensione su Google">
      <Heading>Ciao, {requesterFirstName}!</Heading>
      <Paragraph>
        ti ringraziamo di cuore per aver partecipato all&apos;evento{" "}
        <strong>{eventTitle}</strong>. È stato emozionante condividere questa
        giornata con tutti voi! Speriamo che l&apos;atmosfera e i sapori di
        Cooker Loft vi siano rimasti nel cuore.
      </Paragraph>
      <Paragraph>
        Ci farebbe davvero piacere se potessi condividere la tua esperienza
        lasciando una recensione su Google. Il tuo feedback è prezioso e ci
        aiuta a crescere e migliorare.
      </Paragraph>

      <PrimaryButton href={reviewUrl}>
        Lascia una recensione su Google
      </PrimaryButton>

      <Muted>
        Se invece qualcosa non è andato come speravi, rispondi pure a questa
        email. Siamo qui per ascoltarti!
      </Muted>

      <Paragraph>
        A presto,
        <br />
        <strong>Il team Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

export default E9ReviewRequest;
