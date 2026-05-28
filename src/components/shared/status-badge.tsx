import { Badge } from "@/components/ui/badge";

type RequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "waitlisted"
  | "cancelled"
  | "expired";

type BookingStatus =
  | "awaiting_completion"
  | "awaiting_payment"
  | "paid"
  | "expired"
  | "void";

type EventStatus = "draft" | "published" | "closed" | "archived";

const requestVariants: Record<
  RequestStatus,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "destructive"
      | "outline"
      | "success"
      | "warning"
      | "info"
      | "muted";
  }
> = {
  pending: { label: "In attesa", variant: "warning" },
  accepted: { label: "Accettata", variant: "success" },
  rejected: { label: "Rifiutata", variant: "destructive" },
  waitlisted: { label: "Lista d'attesa", variant: "info" },
  cancelled: { label: "Annullata", variant: "muted" },
  expired: { label: "Scaduta", variant: "muted" },
};

const bookingVariants: Record<
  BookingStatus,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "destructive"
      | "outline"
      | "success"
      | "warning"
      | "info"
      | "muted";
  }
> = {
  awaiting_completion: { label: "Da completare", variant: "warning" },
  awaiting_payment: { label: "In attesa pagamento", variant: "info" },
  paid: { label: "Pagata", variant: "success" },
  expired: { label: "Scaduta", variant: "muted" },
  void: { label: "Annullata (admin)", variant: "muted" },
};

const eventVariants: Record<
  EventStatus,
  {
    label: string;
    variant: "outline" | "success" | "muted" | "warning";
  }
> = {
  draft: { label: "Bozza", variant: "warning" },
  published: { label: "Pubblicato", variant: "success" },
  closed: { label: "Chiuso", variant: "muted" },
  archived: { label: "Archiviato", variant: "muted" },
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const v = requestVariants[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const v = bookingVariants[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const v = eventVariants[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function PostPaymentCancellationBadge() {
  return (
    <Badge
      variant="destructive"
      className="bg-rose-100 text-rose-900 hover:bg-rose-200"
    >
      Cancellata dopo pagamento
    </Badge>
  );
}

export function RevisionBadge({ revision }: { revision: number }) {
  return (
    <Badge variant="outline" className="font-mono">
      rev {revision}
    </Badge>
  );
}

export function OriginBadge({ origin }: { origin: "direct" | "waitlist" }) {
  if (origin === "waitlist") {
    return <Badge variant="info">Da lista d&apos;attesa</Badge>;
  }
  return <Badge variant="muted">Diretta</Badge>;
}
