"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Check,
  ListChecks,
  Mail,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  usePrenotazioniDispatch,
  type Prenotazione,
} from "@/lib/mock/store";

/* ----------------------------------------------------------------------------
 * Primary actions (top of the detail page) — per status.
 * Destructive "Elimina prenotazione" is intentionally NOT here. It lives in
 * a dedicated "Elimina prenotazione" section at the bottom of the page,
 * via <DeletePrenotazioneSection />.
 * -------------------------------------------------------------------------- */

export function PrenotazioneActions({ p }: { p: Prenotazione }) {
  switch (p.unifiedStatus) {
    case "received":
      return <PendingActions p={p} />;
    case "waitlisted":
      return <WaitlistActions p={p} />;
    case "to_pay":
      return <PendingBookingActions p={p} />;
    case "paid":
      return <PaidActions p={p} />;
    case "paid_cancelled":
    case "rejected":
    case "deleted":
    default:
      return null;
  }
}

/* ----------------------------------------------------------------------------
 * Received → accept / waitlist / reject / edit
 * -------------------------------------------------------------------------- */

function PendingActions({ p }: { p: Prenotazione }) {
  const { dispatch, actorId } = usePrenotazioniDispatch();
  const [openEdit, setOpenEdit] = React.useState(false);
  const [openReject, setOpenReject] = React.useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            dispatch({ type: "accept_request", requestId: p.id, actorId });
            toast.success("Richiesta accettata", {
              description:
                "Inviata l'email al richiedente con il link per completare i dati.",
            });
          }}
        >
          <Check className="h-4 w-4" />
          Accetta
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            dispatch({ type: "waitlist_request", requestId: p.id, actorId });
            toast.success("Richiesta messa in lista d'attesa", {
              description:
                "Inviata l'email al richiedente con la conferma di iscrizione alla lista d'attesa.",
            });
          }}
        >
          <ListChecks className="h-4 w-4" />
          Metti in lista d&apos;attesa
        </Button>
        <Button variant="outline" onClick={() => setOpenEdit(true)}>
          <Pencil className="h-4 w-4" />
          Modifica
        </Button>
        <Button variant="destructive" onClick={() => setOpenReject(true)}>
          <X className="h-4 w-4" />
          Rifiuta
        </Button>
      </div>

      <EditRequestDialog p={p} open={openEdit} onOpenChange={setOpenEdit} />
      <RejectDialog p={p} open={openReject} onOpenChange={setOpenReject} />
    </>
  );
}

/* ----------------------------------------------------------------------------
 * Waitlisted → accept-from-waitlist (with double confirm)
 * "Annulla" is removed — to drop a waitlist request, use the bottom delete.
 * -------------------------------------------------------------------------- */

function WaitlistActions({ p }: { p: Prenotazione }) {
  const [openConfirm, setOpenConfirm] = React.useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpenConfirm(true)}>
          <Check className="h-4 w-4" />
          Accetta dalla lista d&apos;attesa
        </Button>
      </div>

      <AcceptFromWaitlistDialog
        p={p}
        open={openConfirm}
        onOpenChange={setOpenConfirm}
      />
    </>
  );
}

/* ----------------------------------------------------------------------------
 * To-pay (booking pending) → edit / resend link
 * "Chiudi non pagata" is removed — to drop a non-paid booking, use the
 * bottom "Elimina prenotazione".
 * -------------------------------------------------------------------------- */

function PendingBookingActions({ p }: { p: Prenotazione }) {
  const { dispatch, actorId } = usePrenotazioniDispatch();
  const [openEdit, setOpenEdit] = React.useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setOpenEdit(true)}>
          <Pencil className="h-4 w-4" />
          Modifica
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (!p.booking) return;
            dispatch({
              type: "resend_completion",
              bookingId: p.booking.id,
              actorId,
            });
            toast.success("Email rinviata", {
              description:
                "Reinviato al richiedente il link per completare la prenotazione.",
            });
          }}
        >
          <Mail className="h-4 w-4" />
          Reinvia link
        </Button>
      </div>

      <EditBookingDialog p={p} open={openEdit} onOpenChange={setOpenEdit} />
    </>
  );
}

/* ----------------------------------------------------------------------------
 * Paid → mark as cancelled-after-payment (no undo)
 * -------------------------------------------------------------------------- */

function PaidActions({ p }: { p: Prenotazione }) {
  const [openCancel, setOpenCancel] = React.useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setOpenCancel(true)}>
          <X className="h-4 w-4" />
          Cancella dopo pagamento
        </Button>
      </div>
      <CancelAfterPaymentDialog
        p={p}
        open={openCancel}
        onOpenChange={setOpenCancel}
      />
    </>
  );
}

/* ----------------------------------------------------------------------------
 * Dedicated bottom "Elimina prenotazione" section.
 * Shown only for non-paid prenotazioni. Eliminates the prenotazione,
 * invalidates the completion link if any, and hides it from all lists.
 * -------------------------------------------------------------------------- */

export function DeletePrenotazioneSection({ p }: { p: Prenotazione }) {
  const canDelete =
    p.unifiedStatus === "received" ||
    p.unifiedStatus === "waitlisted" ||
    p.unifiedStatus === "to_pay";

  if (!canDelete) return null;

  return <DeleteCard p={p} />;
}

function DeleteCard({ p }: { p: Prenotazione }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="rounded-md border border-rose-200 bg-rose-50/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-rose-900">
              Elimina questa prenotazione
            </p>
            <p className="text-xs text-rose-900/80">
              {p.unifiedStatus === "to_pay"
                ? "L'eventuale link di completamento smette di funzionare. La prenotazione non sarà più visibile in dashboard."
                : "La prenotazione non sarà più visibile in dashboard. Resta archiviata internamente."}
            </p>
          </div>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Elimina prenotazione
          </Button>
        </div>
      </div>
      <DeleteConfirmDialog p={p} open={open} onOpenChange={setOpen} />
    </>
  );
}

function DeleteConfirmDialog({
  p,
  open,
  onOpenChange,
}: {
  p: Prenotazione;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dispatch, actorId } = usePrenotazioniDispatch();

  const submit = () => {
    dispatch({ type: "delete_prenotazione", requestId: p.id, actorId });
    onOpenChange(false);
    toast.success("Prenotazione eliminata", {
      description:
        "Non comparirà più nelle liste. Resta archiviata per consultazione.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminare la prenotazione?</DialogTitle>
          <DialogDescription>
            La prenotazione di{" "}
            <strong>
              {p.request.firstName} {p.request.lastName}
            </strong>{" "}
            sparirà dalla dashboard.{" "}
            {p.unifiedStatus === "to_pay"
              ? "Il link di completamento smetterà di funzionare. "
              : ""}
            Resta visibile internamente per consultazione. L&apos;azione è
            definitiva: non si può ripristinare.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Indietro
          </Button>
          <Button variant="destructive" onClick={submit}>
            <Trash2 className="h-4 w-4" />
            Sì, elimina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------
 * Reject dialog — reason required, NO "share with requester" checkbox.
 * The motivazione resta interna; al richiedente arriva sempre l'email di
 * rifiuto con un testo standard.
 * -------------------------------------------------------------------------- */

function RejectDialog({
  p,
  open,
  onOpenChange,
}: {
  p: Prenotazione;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dispatch, actorId } = usePrenotazioniDispatch();
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = () => {
    if (reason.trim().length === 0) return;
    dispatch({
      type: "reject_request",
      requestId: p.id,
      actorId,
      reason: reason.trim(),
    });
    onOpenChange(false);
    toast.success("Richiesta rifiutata", {
      description:
        "Inviata l'email di rifiuto al richiedente. La motivazione resta interna.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rifiuta la richiesta di {p.request.firstName}</DialogTitle>
          <DialogDescription>
            La motivazione è solo per uso interno. Verrà salvata in cronologia
            ma non sarà visibile al richiedente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Motivazione interna *</Label>
          <Textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Es. gruppo troppo numeroso per la sala disponibile in questa data."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={reason.trim().length === 0}
          >
            <X className="h-4 w-4" />
            Conferma rifiuto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------
 * Accept-from-waitlist confirm — double confirm before promoting.
 * -------------------------------------------------------------------------- */

function AcceptFromWaitlistDialog({
  p,
  open,
  onOpenChange,
}: {
  p: Prenotazione;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dispatch, actorId } = usePrenotazioniDispatch();

  const submit = () => {
    dispatch({ type: "accept_from_waitlist", requestId: p.id, actorId });
    onOpenChange(false);
    toast.success("Accettata dalla lista d'attesa", {
      description:
        "Inviata l'email al richiedente con il link per completare i dati.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Accettare {p.request.firstName} dalla lista d&apos;attesa?
          </DialogTitle>
          <DialogDescription>
            Confermando, al richiedente viene inviata subito l&apos;email con
            il link di completamento per pagare. L&apos;azione è definitiva.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-medium">
            {p.request.firstName} {p.request.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {p.request.email} · {p.request.people} persone · {p.event.title}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Non ora
          </Button>
          <Button onClick={submit}>
            <Check className="h-4 w-4" />
            Sì, accetta e invia link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------
 * Edit pending request — people / dietary / occasion. No email side effect.
 * -------------------------------------------------------------------------- */

function EditRequestDialog({
  p,
  open,
  onOpenChange,
}: {
  p: Prenotazione;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dispatch, actorId } = usePrenotazioniDispatch();
  const [people, setPeople] = React.useState(p.request.people);
  const [dietary, setDietary] = React.useState(p.request.dietaryNotes ?? "");
  const [occasion, setOccasion] = React.useState(
    p.request.specialOccasion ?? ""
  );

  React.useEffect(() => {
    if (open) {
      setPeople(p.request.people);
      setDietary(p.request.dietaryNotes ?? "");
      setOccasion(p.request.specialOccasion ?? "");
    }
  }, [open, p]);

  const submit = () => {
    dispatch({
      type: "edit_pending_request",
      requestId: p.id,
      actorId,
      patch: {
        people,
        dietaryNotes: dietary.trim().length > 0 ? dietary.trim() : null,
        specialOccasion: occasion.trim().length > 0 ? occasion.trim() : null,
      },
    });
    onOpenChange(false);
    toast.success("Richiesta aggiornata", {
      description:
        "Le modifiche sono registrate. Nessuna email viene inviata al richiedente in questo momento.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica la richiesta</DialogTitle>
          <DialogDescription>
            Puoi correggere persone, allergie/intolleranze e occasione prima di
            accettare. La modifica resta in cronologia; nessuna email viene
            inviata in questo momento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-people">Persone</Label>
            <Input
              id="edit-people"
              type="number"
              min={1}
              max={p.event.capacity}
              value={people}
              onChange={(e) =>
                setPeople(
                  Math.max(
                    1,
                    Math.min(p.event.capacity, Number(e.target.value) || 1)
                  )
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-occasion">Occasione speciale</Label>
            <Input
              id="edit-occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-dietary">
              Allergie / intolleranze / esigenze alimentari
            </Label>
            <Textarea
              id="edit-dietary"
              rows={3}
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={submit}>
            <Check className="h-4 w-4" />
            Salva modifica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------
 * Edit booking pre-payment — rotates link, reason required.
 * -------------------------------------------------------------------------- */

function EditBookingDialog({
  p,
  open,
  onOpenChange,
}: {
  p: Prenotazione;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dispatch, actorId } = usePrenotazioniDispatch();
  const [people, setPeople] = React.useState(
    p.booking?.people ?? p.request.people
  );
  const [dietary, setDietary] = React.useState(
    p.booking?.dietaryNotes ?? p.request.dietaryNotes ?? ""
  );
  const [occasion, setOccasion] = React.useState(
    p.booking?.specialOccasion ?? p.request.specialOccasion ?? ""
  );
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (open && p.booking) {
      setPeople(p.booking.people);
      setDietary(p.booking.dietaryNotes ?? "");
      setOccasion(p.booking.specialOccasion ?? "");
      setReason("");
    }
  }, [open, p]);

  if (!p.booking) return null;

  const submit = () => {
    if (reason.trim().length === 0) return;
    dispatch({
      type: "edit_booking",
      bookingId: p.booking!.id,
      actorId,
      patch: {
        people,
        dietaryNotes: dietary.trim().length > 0 ? dietary.trim() : null,
        specialOccasion: occasion.trim().length > 0 ? occasion.trim() : null,
      },
      reason: reason.trim(),
    });
    onOpenChange(false);
    toast.success("Prenotazione aggiornata", {
      description:
        "Il vecchio link non funziona più. Inviata una nuova email con il link aggiornato.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica la prenotazione</DialogTitle>
          <DialogDescription>
            Aggiorna i dati prima del pagamento. Il sistema invalida il link
            precedente e ne invia uno nuovo al richiedente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-b-people">Persone</Label>
            <Input
              id="edit-b-people"
              type="number"
              min={1}
              max={p.event.capacity}
              value={people}
              onChange={(e) =>
                setPeople(
                  Math.max(
                    1,
                    Math.min(p.event.capacity, Number(e.target.value) || 1)
                  )
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-b-occasion">Occasione speciale</Label>
            <Input
              id="edit-b-occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-b-dietary">
              Allergie / intolleranze / esigenze alimentari
            </Label>
            <Textarea
              id="edit-b-dietary"
              rows={3}
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-b-reason">Motivazione *</Label>
            <Textarea
              id="edit-b-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Es. il referente ha aggiunto una persona al gruppo."
            />
            <p className="text-[11px] text-muted-foreground">
              Verrà salvata nella cronologia della prenotazione.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={reason.trim().length === 0}>
            <Check className="h-4 w-4" />
            Salva e reinvia link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------
 * Cancel after payment dialog — reason required, NO undo afterwards.
 * -------------------------------------------------------------------------- */

function CancelAfterPaymentDialog({
  p,
  open,
  onOpenChange,
}: {
  p: Prenotazione;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { dispatch, actorId } = usePrenotazioniDispatch();
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = () => {
    if (!p.booking) return;
    if (reason.trim().length === 0) return;
    dispatch({
      type: "mark_cancelled_after_payment",
      bookingId: p.booking.id,
      actorId,
      reason: reason.trim(),
    });
    onOpenChange(false);
    toast.success("Prenotazione cancellata dopo il pagamento", {
      description:
        "Resta pagata ai fini contabili. L'email post-evento di richiesta recensione viene sospesa. L'azione è definitiva.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancella la prenotazione dopo il pagamento</DialogTitle>
          <DialogDescription>
            Operazione interna definitiva: la prenotazione resta pagata (per la
            contabilità) ma viene segnalata come cancellata. Non parte alcun
            rimborso automatico e l&apos;email post-evento di recensione viene
            sospesa. Una volta confermato, non si può annullare.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cap-reason">Motivazione *</Label>
          <Textarea
            id="cap-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Es. il referente ha comunicato impossibilità a partecipare."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={reason.trim().length === 0}
          >
            Conferma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
