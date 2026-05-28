"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Link as LinkIcon,
  ListChecks,
  Mail,
  Pencil,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  acceptFromWaitlistAction,
  acceptRequestAction,
  deletePrenotazioneAction,
  editPendingRequestAction,
  rejectRequestAction,
  waitlistRequestAction,
} from "@/server/requests/actions";
import {
  editBookingAction,
  getCompletionLinkAction,
  markOperationallyCancelledAction,
  resendCompletionEmailAction,
} from "@/server/bookings/actions";
import type { UnifiedStatus } from "@/lib/status";

type Props = {
  requestId: string;
  bookingId: string | null;
  unifiedStatus: UnifiedStatus;
  bookingStatus: string | null;
  currentPeople: number;
  currentDietaryNotes: string | null;
  currentSpecialOccasion: string | null;
  isCancelledAfterPayment: boolean;
};

type ActiveDialog =
  | null
  | "accept"
  | "accept_waitlist"
  | "reject"
  | "waitlist"
  | "edit_request"
  | "edit_booking"
  | "delete"
  | "post_cancel";

export function PrenotazioneDetailActions(props: Props) {
  const router = useRouter();
  const [active, setActive] = React.useState<ActiveDialog>(null);
  const [pending, startTransition] = React.useTransition();
  const [completionLink, setCompletionLink] = React.useState<string | null>(
    null
  );
  const [linkLoading, setLinkLoading] = React.useState(false);

  const close = () => setActive(null);

  const run = (label: string, fn: () => Promise<{ status: "ok" } | { status: "error"; message: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(label);
      close();
      router.refresh();
    });
  };

  const canAccept = props.unifiedStatus === "received";
  const canAcceptWaitlist = props.unifiedStatus === "waitlisted";
  const canReject =
    props.unifiedStatus === "received" || props.unifiedStatus === "waitlisted";
  const canWaitlist = props.unifiedStatus === "received";
  const canEditRequest = props.unifiedStatus === "received";
  const canEditBooking =
    props.unifiedStatus === "to_pay" && props.bookingId !== null;
  // Su "lista d'attesa" il bottone Elimina è ridondante con "Rifiuta": entrambi
  // chiudono la richiesta. Mostrare entrambi confonde, quindi qui solo Rifiuta.
  const canDelete =
    props.unifiedStatus === "received" || props.unifiedStatus === "to_pay";
  const canPostCancel =
    props.unifiedStatus === "paid" &&
    !props.isCancelledAfterPayment &&
    props.bookingId !== null;
  // The /complete/[token] link only works while the booking is still in
  // awaiting_completion; once the user submits the form the token is
  // consumed and the page returns "link non valido", so we hide the
  // "Mostra link" affordance for awaiting_payment.
  const canShowCompletionLink =
    props.bookingStatus === "awaiting_completion" &&
    props.bookingId !== null;
  // For awaiting_payment we still expose a re-send button, but it
  // sends E7 ("riprova pagamento") with the /pay/[bookingId] link
  // instead of E2/E5 with the now-consumed completion token.
  const canResendCompletionEmail =
    (props.bookingStatus === "awaiting_completion" ||
      props.bookingStatus === "awaiting_payment") &&
    props.bookingId !== null;
  const resendEmailLabel =
    props.bookingStatus === "awaiting_payment"
      ? "Re-invia link di pagamento"
      : "Re-invia email di completamento";

  const handleResendCompletionEmail = () => {
    if (!props.bookingId) return;
    startTransition(async () => {
      const result = await resendCompletionEmailAction({
        bookingId: props.bookingId!,
        requestId: props.requestId,
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(
        result.deduplicated
          ? "Email gi\u00e0 inviata in precedenza (nessun duplicato)."
          : props.bookingStatus === "awaiting_payment"
            ? "Link di pagamento re-inviato."
            : "Email di completamento re-inviata."
      );
      router.refresh();
    });
  };

  const handleShowCompletionLink = () => {
    if (!props.bookingId) return;
    setLinkLoading(true);
    setCompletionLink(null);
    startTransition(async () => {
      const result = await getCompletionLinkAction({ bookingId: props.bookingId! });
      setLinkLoading(false);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setCompletionLink(result.url);
    });
  };

  const handleCopyCompletionLink = async () => {
    if (!completionLink) return;
    try {
      await navigator.clipboard.writeText(completionLink);
      toast.success("Link copiato negli appunti");
    } catch {
      toast.error("Impossibile copiare automaticamente. Seleziona il link e copia a mano.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Azioni disponibili</CardTitle>
        <p className="text-xs text-muted-foreground">
          Le azioni si aggiornano in base allo stato corrente della prenotazione.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {canAccept ? (
            <Button onClick={() => setActive("accept")} disabled={pending}>
              <CheckCircle2 className="h-4 w-4" />
              Accetta
            </Button>
          ) : null}
          {canAcceptWaitlist ? (
            <Button onClick={() => setActive("accept_waitlist")} disabled={pending}>
              <CheckCircle2 className="h-4 w-4" />
              Promuovi da lista d&apos;attesa
            </Button>
          ) : null}
          {canWaitlist ? (
            <Button
              variant="outline"
              onClick={() => setActive("waitlist")}
              disabled={pending}
            >
              <ListChecks className="h-4 w-4" />
              Metti in lista d&apos;attesa
            </Button>
          ) : null}
          {canReject ? (
            <Button
              variant="outline"
              onClick={() => setActive("reject")}
              disabled={pending}
            >
              <XCircle className="h-4 w-4" />
              Rifiuta
            </Button>
          ) : null}
          {canEditRequest ? (
            <Button
              variant="outline"
              onClick={() => setActive("edit_request")}
              disabled={pending}
            >
              <Pencil className="h-4 w-4" />
              Modifica richiesta
            </Button>
          ) : null}
          {canEditBooking ? (
            <Button
              variant="outline"
              onClick={() => setActive("edit_booking")}
              disabled={pending}
            >
              <Pencil className="h-4 w-4" />
              Modifica prenotazione
            </Button>
          ) : null}
          {canShowCompletionLink ? (
            <Button
              variant="outline"
              onClick={handleShowCompletionLink}
              disabled={pending || linkLoading}
            >
              <LinkIcon className="h-4 w-4" />
              {linkLoading ? "Recupero…" : "Mostra link di completamento"}
            </Button>
          ) : null}
          {canResendCompletionEmail ? (
            <Button
              variant="outline"
              onClick={handleResendCompletionEmail}
              disabled={pending}
            >
              <Mail className="h-4 w-4" />
              {resendEmailLabel}
            </Button>
          ) : null}
          {!canAccept &&
          !canAcceptWaitlist &&
          !canReject &&
          !canWaitlist &&
          !canEditRequest &&
          !canEditBooking &&
          !canShowCompletionLink &&
          !canResendCompletionEmail &&
          !canDelete &&
          !canPostCancel ? (
            <p className="text-sm text-muted-foreground">
              Nessuna azione disponibile in questo stato.
            </p>
          ) : null}
        </div>

        {completionLink ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Copia questo link e invialo manualmente al richiedente. Resta
              valido finché la prenotazione è in attesa di completamento.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={completionLink}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyCompletionLink}
              >
                <Copy className="h-4 w-4" />
                Copia
              </Button>
            </div>
          </div>
        ) : null}

        {(canDelete || canPostCancel) && active === null ? (
          <details className="group mt-2 rounded-md border border-stone-200 bg-stone-50/50 open:border-rose-200 open:bg-rose-50/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-stone-700 group-open:text-rose-900">
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="h-3 w-3" />
                Zona pericolosa
              </span>
              <span className="text-[10px] uppercase tracking-wide opacity-60 group-open:opacity-100">
                {canPostCancel ? "Cancella dopo pagamento" : "Elimina"}
              </span>
            </summary>
            <div className="space-y-2 border-t border-stone-200 px-3 py-3 group-open:border-rose-200">
              {canDelete ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] text-rose-900/80">
                    Elimina la prenotazione. Sparir&agrave; dalla dashboard ma
                    resta archiviata internamente.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-end text-rose-700 hover:bg-rose-100 hover:text-rose-900"
                    onClick={() => setActive("delete")}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Elimina prenotazione
                  </Button>
                </div>
              ) : null}
              {canPostCancel ? (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] text-rose-900/80">
                    Segna come cancellata dopo pagamento. Resta pagata ai fini
                    contabili, nessun rimborso automatico.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-end text-rose-700 hover:bg-rose-100 hover:text-rose-900"
                    onClick={() => setActive("post_cancel")}
                    disabled={pending}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancella dopo pagamento
                  </Button>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}

        {active === "accept" ? (
          <DecisionPanel
            title="Accettare la richiesta?"
            confirmLabel="Accetta"
            confirmIcon={<Send className="h-4 w-4" />}
            pending={pending}
            onCancel={close}
            onConfirm={(reason) =>
              run("Richiesta accettata", () =>
                acceptRequestAction({
                  requestId: props.requestId,
                  shareWithRequester: false,
                  reason: reason || null,
                })
              )
            }
            reasonLabel="Nota interna (facoltativa)"
            hideShareToggle
            note="L'email di conferma e completamento parte automaticamente al richiedente. La nota qui sopra resta solo per uso interno."
          />
        ) : null}

        {active === "accept_waitlist" ? (
          <DecisionPanel
            title="Promuovere dalla lista d'attesa?"
            confirmLabel="Promuovi"
            confirmIcon={<Send className="h-4 w-4" />}
            pending={pending}
            onCancel={close}
            onConfirm={(reason) =>
              run("Promossa dalla lista d'attesa", () =>
                acceptFromWaitlistAction({
                  requestId: props.requestId,
                  shareWithRequester: false,
                  reason: reason || null,
                })
              )
            }
            reasonLabel="Nota interna (facoltativa)"
            hideShareToggle
            note="L'email di promozione parte automaticamente al richiedente con il link di completamento."
          />
        ) : null}

        {active === "waitlist" ? (
          <DecisionPanel
            title="Mettere in lista d'attesa?"
            confirmLabel="Metti in lista"
            confirmIcon={<ListChecks className="h-4 w-4" />}
            pending={pending}
            onCancel={close}
            onConfirm={(reason) =>
              run("Richiesta in lista d'attesa", () =>
                waitlistRequestAction({
                  requestId: props.requestId,
                  reason: reason || null,
                })
              )
            }
            reasonLabel="Nota interna (facoltativa)"
            hideShareToggle
          />
        ) : null}

        {active === "reject" ? (
          <DecisionPanel
            title="Rifiutare la richiesta?"
            confirmLabel="Rifiuta"
            confirmIcon={<XCircle className="h-4 w-4" />}
            pending={pending}
            onCancel={close}
            onConfirm={(reason) =>
              run("Richiesta rifiutata", () =>
                rejectRequestAction({
                  requestId: props.requestId,
                  reason: reason || null,
                  shareWithRequester: false,
                })
              )
            }
            reasonLabel="Nota interna (facoltativa)"
            hideShareToggle
            note="L'email di rifiuto parte in automatico al richiedente; la nota qui sopra resta solo per uso interno."
          />
        ) : null}

        {active === "edit_request" ? (
          <EditPanel
            title="Modifica richiesta"
            initial={{
              people: props.currentPeople,
              dietaryNotes: props.currentDietaryNotes ?? "",
              specialOccasion: props.currentSpecialOccasion ?? "",
            }}
            pending={pending}
            onCancel={close}
            onConfirm={(values) =>
              run("Richiesta aggiornata", () =>
                editPendingRequestAction({
                  requestId: props.requestId,
                  people: values.people,
                  dietaryNotes: values.dietaryNotes || null,
                  specialOccasion: values.specialOccasion || null,
                })
              )
            }
          />
        ) : null}

        {active === "edit_booking" && props.bookingId ? (
          <EditPanel
            title="Modifica prenotazione (pre-pagamento)"
            initial={{
              people: props.currentPeople,
              dietaryNotes: props.currentDietaryNotes ?? "",
              specialOccasion: props.currentSpecialOccasion ?? "",
            }}
            warning="Cambiare il numero di persone ricalcola l'importo e invalida il link di completamento già inviato (verrà generato un nuovo token)."
            pending={pending}
            onCancel={close}
            onConfirm={(values) =>
              run("Prenotazione aggiornata", () =>
                editBookingAction({
                  bookingId: props.bookingId!,
                  requestId: props.requestId,
                  people: values.people,
                  dietaryNotes: values.dietaryNotes || null,
                  specialOccasion: values.specialOccasion || null,
                })
              )
            }
          />
        ) : null}

        {active === "delete" ? (
          <DecisionPanel
            title="Eliminare la prenotazione?"
            confirmLabel="Elimina"
            confirmIcon={<Trash2 className="h-4 w-4" />}
            requireReason
            pending={pending}
            onCancel={close}
            onConfirm={(reason) =>
              run("Prenotazione eliminata", () =>
                deletePrenotazioneAction({
                  requestId: props.requestId,
                  reason,
                })
              )
            }
            reasonLabel="Motivazione (obbligatoria)"
            hideShareToggle
            danger
          />
        ) : null}

        {active === "post_cancel" && props.bookingId ? (
          <DecisionPanel
            title="Segnare come cancellata dopo il pagamento?"
            confirmLabel="Conferma cancellazione"
            confirmIcon={<XCircle className="h-4 w-4" />}
            requireReason
            pending={pending}
            onCancel={close}
            onConfirm={(reason, affects) =>
              run("Cancellazione registrata", () =>
                markOperationallyCancelledAction({
                  bookingId: props.bookingId!,
                  requestId: props.requestId,
                  reason,
                  affectsReviewEmail: affects,
                })
              )
            }
            reasonLabel="Motivazione (obbligatoria)"
            shareLabel="L'email post-evento di richiesta recensione resta sospesa"
            shareDefault={true}
            danger
            note="La prenotazione resta in stato pagato ai fini fiscali; nessun rimborso automatico viene effettuato."
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function DecisionPanel({
  title,
  confirmLabel,
  confirmIcon,
  reasonLabel,
  shareLabel,
  shareDefault,
  hideShareToggle,
  requireReason,
  pending,
  danger,
  note,
  onCancel,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  confirmIcon: React.ReactNode;
  reasonLabel?: string;
  shareLabel?: string;
  shareDefault?: boolean;
  hideShareToggle?: boolean;
  requireReason?: boolean;
  pending: boolean;
  danger?: boolean;
  note?: string;
  onCancel: () => void;
  onConfirm: (reason: string, share: boolean) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [share, setShare] = React.useState(Boolean(shareDefault));
  const canConfirm = !requireReason || reason.trim().length > 0;
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {note ? (
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {note}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="reason">{reasonLabel ?? "Note (facoltative)"}</Label>
        <Textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {!hideShareToggle ? (
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={share}
            onCheckedChange={(v) => setShare(v === true)}
            className="mt-0.5"
          />
          <span>{shareLabel ?? "Condividi con il richiedente"}</span>
        </label>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Annulla
        </Button>
        <Button
          variant={danger ? "destructive" : "default"}
          onClick={() => onConfirm(reason.trim(), share)}
          disabled={!canConfirm || pending}
        >
          {confirmIcon}
          {pending ? "Salvataggio…" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function EditPanel({
  title,
  initial,
  warning,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  initial: { people: number; dietaryNotes: string; specialOccasion: string };
  warning?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (values: {
    people: number;
    dietaryNotes: string;
    specialOccasion: string;
  }) => void;
}) {
  const [people, setPeople] = React.useState(initial.people);
  const [dietaryNotes, setDietaryNotes] = React.useState(initial.dietaryNotes);
  const [specialOccasion, setSpecialOccasion] = React.useState(initial.specialOccasion);
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {warning ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {warning}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="people">Persone</Label>
          <Input
            id="people"
            type="number"
            min={1}
            value={people}
            onChange={(e) => setPeople(Number(e.target.value) || 1)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="specialOccasion">Occasione speciale</Label>
          <Input
            id="specialOccasion"
            value={specialOccasion}
            onChange={(e) => setSpecialOccasion(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="dietaryNotes">Allergie / intolleranze</Label>
          <Textarea
            id="dietaryNotes"
            rows={2}
            value={dietaryNotes}
            onChange={(e) => setDietaryNotes(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Annulla
        </Button>
        <Button
          onClick={() =>
            onConfirm({ people, dietaryNotes, specialOccasion })
          }
          disabled={pending}
        >
          {pending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </div>
  );
}
