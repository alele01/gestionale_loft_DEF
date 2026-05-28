import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const actorLabels: Record<AuditEntry["actorType"], string> = {
  admin: "Team",
  representative: "Richiedente",
  system: "Sistema",
  webhook: "Pagamento",
  cron: "Scadenza automatica",
};

const actionLabels: Record<string, string> = {
  "request.submitted": "Richiesta ricevuta",
  "request.accepted": "Richiesta accettata",
  "request.accepted_from_waitlist": "Accettata dalla lista d'attesa",
  "request.rejected": "Richiesta rifiutata",
  "request.waitlisted": "Messa in lista d'attesa",
  "request.waitlist_cancelled": "Lista d'attesa annullata",
  "request.edited": "Dati richiesta aggiornati",
  "request.expired_post_event": "Scaduta dopo l'evento",
  "booking.created": "Prenotazione confermata",
  "booking.completed": "Dati e dichiarazioni inviati",
  "booking.paid": "Pagamento ricevuto",
  "booking.expired": "Scadenza superata",
  "booking.voided": "Prenotazione chiusa",
  "booking.edited_pre_payment": "Modifica prima del pagamento",
  "booking.completion_link_resent": "Link di completamento reinviato",
  "booking.cancelled_after_payment": "Cancellata dopo il pagamento",
  "booking.cancellation_cleared": "Cancellazione revocata",
};

const actorTone: Record<AuditEntry["actorType"], string> = {
  admin: "bg-sky-100 text-sky-900 border-transparent",
  representative: "bg-violet-100 text-violet-900 border-transparent",
  system: "bg-slate-100 text-slate-900 border-transparent",
  webhook: "bg-emerald-100 text-emerald-900 border-transparent",
  cron: "bg-amber-100 text-amber-900 border-transparent",
};

function dotTone(action: string, toState: string | null) {
  if (toState === "paid" || action === "booking.paid") return "bg-emerald-500";
  if (action.includes("cancelled_after_payment")) return "bg-rose-500";
  if (
    action === "request.rejected" ||
    action === "booking.voided" ||
    action === "booking.expired" ||
    action === "request.expired_post_event" ||
    action === "request.waitlist_cancelled"
  ) {
    return "bg-muted-foreground/60";
  }
  return "bg-primary";
}

function renderDiff(metadata: Record<string, unknown>): string | null {
  const diff = metadata.diff as
    | Record<string, { from: unknown; to: unknown }>
    | undefined;
  if (!diff) return null;
  const parts: string[] = [];
  for (const key of Object.keys(diff)) {
    const { from, to } = diff[key];
    const label =
      key === "people"
        ? "persone"
        : key === "dietaryNotes"
          ? "allergie"
          : key === "specialOccasion"
            ? "occasione"
            : key;
    parts.push(`${label}: ${formatDiffValue(from)} → ${formatDiffValue(to)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function formatDiffValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 40 ? `${v.slice(0, 40)}…` : v;
  return String(v);
}

export function PrenotazioneTimeline({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cronologia</CardTitle>
        <p className="text-xs text-muted-foreground">
          Tutto quello che è successo a questa prenotazione, dall&apos;arrivo
          della richiesta fino ad oggi.
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun evento registrato.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {entries.map((e) => {
              const label = actionLabels[e.action] ?? e.action;
              const diff = renderDiff(e.metadata);
              return (
                <li key={e.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[1.6rem] top-1 inline-flex h-3 w-3 rounded-full border-2 border-background",
                      dotTone(e.action, e.toState)
                    )}
                  />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{label}</p>
                      <Badge
                        variant="outline"
                        className={cn("font-normal", actorTone[e.actorType])}
                      >
                        {actorLabels[e.actorType]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.createdAt)} · {e.actorLabel}
                    </p>
                    {diff ? (
                      <p className="text-xs text-muted-foreground">{diff}</p>
                    ) : null}
                    {e.reason ? (
                      <p className="text-xs italic text-muted-foreground">
                        &ldquo;{e.reason}&rdquo;
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
