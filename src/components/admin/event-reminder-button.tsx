"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendEventPaymentRemindersAction } from "@/server/bookings/actions";

type Props = {
  eventId: string;
  /** Bookings currently in awaiting_completion / awaiting_payment. */
  eligibleCount: number;
};

/**
 * Bulk "payment reminder" button for the event detail page. Opens a
 * confirm dialog, then sends E11 to every booking still awaiting
 * completion/payment. The server enforces max 1 reminder per booking per
 * day, so a double click is harmless.
 */
export function EventReminderButton({ eventId, eligibleCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (eligibleCount === 0) return null;

  const confirm = () => {
    startTransition(async () => {
      const result = await sendEventPaymentRemindersAction({ eventId });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      const parts: string[] = [];
      if (result.sent > 0) parts.push(`${result.sent} inviati`);
      if (result.alreadySentToday > 0)
        parts.push(`${result.alreadySentToday} già inviati oggi (saltati)`);
      if (result.skippedExpiredLink > 0)
        parts.push(`${result.skippedExpiredLink} con link scaduto (saltati)`);
      if (result.failed > 0) parts.push(`${result.failed} falliti`);
      const summary = parts.length > 0 ? parts.join(" · ") : "Nessun invio necessario";
      if (result.failed > 0) {
        toast.warning("Promemoria completati con errori", {
          description: summary,
        });
      } else if (result.sent === 0) {
        toast.info("Nessun nuovo promemoria inviato", { description: summary });
      } else {
        toast.success("Promemoria di pagamento inviati", {
          description: summary,
        });
      }
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <BellRing className="h-3.5 w-3.5" />
        Invia promemoria di pagamento
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invia promemoria di pagamento</DialogTitle>
            <DialogDescription>
              Verrà inviata un&apos;email di promemoria a{" "}
              <strong>
                {eligibleCount}{" "}
                {eligibleCount === 1 ? "prenotazione" : "prenotazioni"}
              </strong>{" "}
              in attesa di pagamento o completamento per questo evento. Ogni
              destinatario riceve il proprio link personale (modulo di
              completamento o pagamento). Nessun pagamento viene creato o
              addebitato dall&apos;invio. Massimo un promemoria al giorno per
              prenotazione: chi l&apos;ha già ricevuto oggi non lo riceverà di
              nuovo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annulla
            </Button>
            <Button onClick={confirm} disabled={pending}>
              <BellRing className="h-4 w-4" />
              {pending ? "Invio in corso…" : "Invia promemoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
