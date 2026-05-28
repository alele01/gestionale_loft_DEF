"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  archiveEventAction,
  publishEventAction,
} from "@/server/events/actions";

type EventDetailActionsProps = {
  eventId: string;
  status: "draft" | "published" | "closed" | "archived";
};

export function EventDetailActions({
  eventId,
  status,
}: EventDetailActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onPublish = () => {
    startTransition(async () => {
      const result = await publishEventAction(eventId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success("Evento pubblicato", {
        description: "Il modulo pubblico è ora attivo.",
      });
      router.refresh();
    });
  };

  const onArchive = () => {
    if (
      !window.confirm(
        "Archiviare questo evento? Verrà nascosto dalla lista eventi attivi. Le prenotazioni esistenti restano consultabili."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await archiveEventAction(eventId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success("Evento archiviato");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" ? (
        <>
          <Button onClick={onPublish} disabled={pending}>
            <Send className="h-4 w-4" />
            {pending ? "Pubblicazione…" : "Pubblica"}
          </Button>
          <Button variant="outline" onClick={onArchive} disabled={pending}>
            <Archive className="h-4 w-4" />
            Archivia
          </Button>
        </>
      ) : null}
    </div>
  );
}
