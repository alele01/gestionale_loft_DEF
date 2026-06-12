"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  eventId: string;
  /** Bookings paid + awaiting payment — the rows that will be exported. */
  exportableCount: number;
};

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] ?? null;
}

/**
 * Downloads the Excel roster (paid + awaiting-payment bookings) for an
 * event. Standalone convenience feature — unrelated to the fiscal XML
 * export. Fetches the blob so we can show a pending state and surface
 * errors as a toast instead of navigating to a raw error response.
 */
export function EventBookingsExportButton({ eventId, exportableCount }: Props) {
  const [pending, setPending] = React.useState(false);

  const download = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/bookings-export`, {
        method: "GET",
      });
      if (!res.ok) {
        let message = "Impossibile generare l'export.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // non-JSON error body; keep the default message
        }
        toast.error(message);
        return;
      }

      const blob = await res.blob();
      const filename =
        filenameFromDisposition(res.headers.get("Content-Disposition")) ??
        "prenotazioni.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Errore di rete durante l'export. Riprova.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      onClick={download}
      disabled={pending || exportableCount === 0}
    >
      <Download className="h-3.5 w-3.5" />
      {pending
        ? "Generazione in corso…"
        : exportableCount === 0
          ? "Nessuna prenotazione da esportare"
          : "Esporta prenotazioni (Excel)"}
    </Button>
  );
}
