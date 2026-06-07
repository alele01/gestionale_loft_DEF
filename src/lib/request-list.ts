import type { UnifiedStatus } from "@/lib/status";

/**
 * Lean, fully-serializable projection of a booking request + its context,
 * shaped for the admin list/filter UI. Kept deliberately small so we never
 * ship unnecessary PII or heavy DB rows into the client bundle.
 */
export type RequestListItem = {
  id: string;
  firstName: string;
  lastName: string;
  people: number;
  email: string;
  phone: string;
  submittedAt: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  unifiedStatus: UnifiedStatus;
  specialOccasion: string | null;
};

/**
 * Structural input accepted by {@link toRequestListItem}. We avoid importing
 * the server-only `RequestContext` type here so this module stays pure and
 * importable from both server pages and client components.
 */
type RequestContextLike = {
  request: {
    id: string;
    requester_first_name: string;
    requester_last_name: string;
    requester_email: string;
    requester_phone: string;
    people: number;
    submitted_at: string;
    special_occasion: string | null;
  };
  booking: { people: number | null; special_occasion: string | null } | null;
  event: { id: string; title: string; starts_at: string };
  unifiedStatus: UnifiedStatus;
};

export function toRequestListItem(ctx: RequestContextLike): RequestListItem {
  return {
    id: ctx.request.id,
    firstName: ctx.request.requester_first_name,
    lastName: ctx.request.requester_last_name,
    people: ctx.booking?.people ?? ctx.request.people,
    email: ctx.request.requester_email,
    phone: ctx.request.requester_phone,
    submittedAt: ctx.request.submitted_at,
    eventId: ctx.event.id,
    eventTitle: ctx.event.title,
    eventStartsAt: ctx.event.starts_at,
    unifiedStatus: ctx.unifiedStatus,
    specialOccasion:
      ctx.booking?.special_occasion ?? ctx.request.special_occasion ?? null,
  };
}

export const REQUEST_STATUS_ORDER: UnifiedStatus[] = [
  "received",
  "waitlisted",
  "to_pay",
  "paid",
  "paid_cancelled",
  "rejected",
  "deleted",
];

export const REQUEST_STATUS_HINT: Record<UnifiedStatus, string> = {
  received: "Richieste appena arrivate, in attesa di una tua decisione.",
  waitlisted:
    "Richieste in lista d'attesa, pronte da promuovere se si liberano posti.",
  to_pay:
    "Prenotazioni accettate, link di completamento aperto o pagamento in corso.",
  paid: "Prenotazioni confermate e saldate.",
  paid_cancelled:
    "Restano pagate ai fini contabili; l'email post-evento è sospesa.",
  rejected: "Richieste declinate; storico consultabile.",
  deleted: "Richieste annullate o scadute.",
};
