"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Props = {
  bookingId: string;
  /** Polling interval in ms (default 3000). */
  intervalMs?: number;
  /** Stop polling after this many ms total (default 30000). */
  timeoutMs?: number;
};

/**
 * Race-condition helper for /payment/success: after Stripe redirects the
 * user back, the webhook may still be in flight. We poll a tiny status
 * endpoint and refresh the page once the booking flips to `paid`.
 *
 * If the timeout elapses without a `paid` status, we stop polling and
 * leave the page on the "in elaborazione" view — the email + admin
 * surface still get the eventual webhook.
 */
export function PaymentStatusPoller({
  bookingId,
  intervalMs = 3000,
  timeoutMs = 30000,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<
    "polling" | "timed_out" | "errored"
  >("polling");

  React.useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/booking-status?bookingId=${bookingId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setPhase("errored");
          return;
        }
        const data = (await res.json()) as { status?: string };
        if (data.status === "paid") {
          router.refresh();
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          if (!cancelled) setPhase("timed_out");
          return;
        }
        setTimeout(tick, intervalMs);
      } catch {
        if (!cancelled) setPhase("errored");
      }
    }

    setTimeout(tick, intervalMs);

    return () => {
      cancelled = true;
    };
  }, [bookingId, intervalMs, timeoutMs, router]);

  if (phase === "timed_out") {
    return (
      <p className="text-[11px] text-muted-foreground">
        La conferma sta richiedendo più del solito. Riceverai una email non
        appena il pagamento sarà confermato.
      </p>
    );
  }
  if (phase === "errored") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Aggiornamento dello stato temporaneamente non disponibile. Riprova
        tra qualche istante o controlla la tua email.
      </p>
    );
  }
  return null;
}
