"use client";

import * as React from "react";

import { mockAdmins, mockCurrentAdmin } from "./admin";
import { mockAuditEntries } from "./audit";
import { mockBookings } from "./bookings";
import { mockEvents } from "./events";
import { mockRequests } from "./requests";
import type {
  AuditEntry,
  Booking,
  BookingConsents,
  BookingRequest,
  EventRecord,
  EventStatus,
} from "./types";

/* ----------------------------------------------------------------------------
 * Unified prenotazione concept (UI-level)
 * The team sees ONE thing: a "Prenotazione" with at most 6 visible statuses.
 * Anything else (cancelled / expired / voided in the underlying data) is
 * folded into "deleted" and hidden from all UI lists.
 * -------------------------------------------------------------------------- */

export type UnifiedStatus =
  | "received" // pending request
  | "waitlisted" // waitlisted request
  | "to_pay" // booking in attesa di pagamento (sia awaiting_completion sia awaiting_payment)
  | "paid" // booking paid
  | "rejected" // rejected request
  | "paid_cancelled" // booking paid + cancelled_after_payment
  | "deleted"; // hidden: cancelled / expired / voided

export const VISIBLE_STATUSES: UnifiedStatus[] = [
  "received",
  "waitlisted",
  "to_pay",
  "paid",
  "rejected",
  "paid_cancelled",
];

export type Prenotazione = {
  /** id of the request — stable across the whole lifecycle */
  id: string;
  request: BookingRequest;
  booking: Booking | null;
  event: EventRecord;
  audit: AuditEntry[];
  unifiedStatus: UnifiedStatus;
  isCancelledAfterPayment: boolean;
};

/* ----------------------------------------------------------------------------
 * Store state
 * -------------------------------------------------------------------------- */

type State = {
  events: EventRecord[];
  requests: BookingRequest[];
  bookings: Booking[];
  audit: AuditEntry[];
  nextBookingSeq: number;
  nextAuditSeq: number;
  nextEventSeq: number;
};

const initialState: State = {
  events: mockEvents.map((e) => ({ ...e })),
  requests: mockRequests.map((r) => ({ ...r })),
  bookings: mockBookings.map((b) => ({ ...b })),
  audit: mockAuditEntries.map((a) => ({ ...a })),
  nextBookingSeq: mockBookings.length + 1,
  nextAuditSeq: mockAuditEntries.length + 1,
  nextEventSeq: mockEvents.length + 1,
};

/* ----------------------------------------------------------------------------
 * Actions
 * -------------------------------------------------------------------------- */

export type PatchFields = Partial<{
  people: number;
  dietaryNotes: string | null;
  specialOccasion: string | null;
}>;

export type EventDraft = {
  title: string;
  description: string;
  startsAt: string; // ISO
  durationMin: number;
  capacity: number;
  priceCents: number;
  status: Extract<EventStatus, "draft" | "published">;
};

export type Action =
  | { type: "accept_request"; requestId: string; actorId: string }
  | { type: "accept_from_waitlist"; requestId: string; actorId: string }
  | {
      type: "reject_request";
      requestId: string;
      actorId: string;
      reason: string;
    }
  | { type: "waitlist_request"; requestId: string; actorId: string }
  | {
      type: "edit_pending_request";
      requestId: string;
      actorId: string;
      patch: PatchFields;
    }
  | {
      type: "edit_booking";
      bookingId: string;
      actorId: string;
      patch: PatchFields;
      reason: string;
    }
  | { type: "resend_completion"; bookingId: string; actorId: string }
  | {
      type: "mark_cancelled_after_payment";
      bookingId: string;
      actorId: string;
      reason: string;
    }
  | {
      /**
       * Unified "Elimina prenotazione" — works on any non-paid stage.
       * Handles: pending request → cancelled; waitlisted → cancelled;
       * to_pay/to_complete booking → voided. Always invalidates the
       * completion link and hides the prenotazione from UI lists.
       */
      type: "delete_prenotazione";
      requestId: string;
      actorId: string;
    }
  | {
      type: "create_event";
      actorId: string;
      draft: EventDraft;
    }
  | {
      type: "update_event";
      eventId: string;
      actorId: string;
      patch: Partial<EventDraft>;
    }
  | { type: "publish_event"; eventId: string; actorId: string };

/* ----------------------------------------------------------------------------
 * Reducer helpers
 * -------------------------------------------------------------------------- */

function findActor(actorId: string) {
  return mockAdmins.find((a) => a.id === actorId) ?? mockCurrentAdmin;
}

function diff(
  before: {
    people: number;
    dietaryNotes: string | null;
    specialOccasion: string | null;
  },
  patch: PatchFields
) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  if (patch.people !== undefined && patch.people !== before.people) {
    out.people = { from: before.people, to: patch.people };
  }
  if (
    patch.dietaryNotes !== undefined &&
    patch.dietaryNotes !== before.dietaryNotes
  ) {
    out.dietaryNotes = { from: before.dietaryNotes, to: patch.dietaryNotes };
  }
  if (
    patch.specialOccasion !== undefined &&
    patch.specialOccasion !== before.specialOccasion
  ) {
    out.specialOccasion = {
      from: before.specialOccasion,
      to: patch.specialOccasion,
    };
  }
  return out;
}

function isoNow() {
  return new Date().toISOString();
}

function makeBookingId(seq: number) {
  return `bkg-${String(900 + seq).padStart(3, "0")}`;
}

function makeAuditId(seq: number) {
  return `aud-${String(900 + seq).padStart(3, "0")}`;
}

function makeEventId(seq: number) {
  return `evt-new-${String(seq).padStart(3, "0")}`;
}

function makeSlug(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function makeToken(seq: number) {
  return `tok-mock-${seq}-${Math.random().toString(36).slice(2, 10)}`;
}

function replaceAt<T>(arr: T[], index: number, next: T): T[] {
  const copy = arr.slice();
  copy[index] = next;
  return copy;
}

/* ----------------------------------------------------------------------------
 * Reducer
 * -------------------------------------------------------------------------- */

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "accept_request":
    case "accept_from_waitlist": {
      const idx = state.requests.findIndex((r) => r.id === action.requestId);
      if (idx === -1) return state;
      const req = state.requests[idx];
      const expectedFrom =
        action.type === "accept_request" ? "pending" : "waitlisted";
      if (req.status !== expectedFrom) return state;

      const now = isoNow();
      const event = state.events.find((e) => e.id === req.eventId);
      if (!event) return state;
      const actor = findActor(action.actorId);

      const newBookingId = makeBookingId(state.nextBookingSeq);
      const newAuditA = makeAuditId(state.nextAuditSeq);
      const newAuditB = makeAuditId(state.nextAuditSeq + 1);

      const booking: Booking = {
        id: newBookingId,
        requestId: req.id,
        eventId: req.eventId,
        status: "awaiting_completion",
        origin: action.type === "accept_request" ? "direct" : "waitlist",
        revision: 1,
        people: req.people,
        amountCents: event.priceCents * req.people,
        currency: "EUR",
        completionToken: makeToken(state.nextBookingSeq),
        completionTokenIssuedAt: now,
        completionTokenUsedAt: null,
        completionDeadlineAt: new Date(
          Date.now() + 72 * 60 * 60 * 1000
        ).toISOString(),
        paymentDeadlineAt: null,
        dietaryNotes: req.dietaryNotes,
        specialOccasion: req.specialOccasion,
        consents: null,
        fiscalProfile: null,
        stripeSessionId: null,
        stripePaymentIntentId: null,
        amountPaidCents: null,
        paidAt: null,
        cancelledAfterPaymentAt: null,
        cancelledAfterPaymentBy: null,
        cancelledAfterPaymentReason: null,
        reviewEmailSentAt: null,
        voidedAt: null,
        voidReason: null,
        createdAt: now,
        updatedAt: now,
      };

      const updatedRequest: BookingRequest = {
        ...req,
        status: "accepted",
        decidedAt: now,
        decidedBy: actor.id,
        decisionReason: null,
        decisionShareWithRequester: false,
        bookingId: newBookingId,
      };

      const requestAudit: AuditEntry = {
        id: newAuditA,
        entityType: "booking_request",
        entityId: req.id,
        fromState: req.status,
        toState: "accepted",
        action:
          action.type === "accept_request"
            ? "request.accepted"
            : "request.accepted_from_waitlist",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: null,
        metadata: {},
        createdAt: now,
      };

      const bookingAudit: AuditEntry = {
        id: newAuditB,
        entityType: "booking",
        entityId: newBookingId,
        fromState: null,
        toState: "awaiting_completion",
        action: "booking.created",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: null,
        metadata: { revision: 1, origin: booking.origin },
        createdAt: now,
      };

      return {
        ...state,
        requests: replaceAt(state.requests, idx, updatedRequest),
        bookings: [...state.bookings, booking],
        audit: [...state.audit, requestAudit, bookingAudit],
        nextBookingSeq: state.nextBookingSeq + 1,
        nextAuditSeq: state.nextAuditSeq + 2,
      };
    }

    case "reject_request": {
      const idx = state.requests.findIndex((r) => r.id === action.requestId);
      if (idx === -1) return state;
      const req = state.requests[idx];
      if (req.status !== "pending") return state;

      const now = isoNow();
      const actor = findActor(action.actorId);

      const updated: BookingRequest = {
        ...req,
        status: "rejected",
        decidedAt: now,
        decidedBy: actor.id,
        decisionReason: action.reason,
        decisionShareWithRequester: false,
      };

      const audit: AuditEntry = {
        id: makeAuditId(state.nextAuditSeq),
        entityType: "booking_request",
        entityId: req.id,
        fromState: "pending",
        toState: "rejected",
        action: "request.rejected",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: action.reason,
        metadata: {},
        createdAt: now,
      };

      return {
        ...state,
        requests: replaceAt(state.requests, idx, updated),
        audit: [...state.audit, audit],
        nextAuditSeq: state.nextAuditSeq + 1,
      };
    }

    case "waitlist_request": {
      const idx = state.requests.findIndex((r) => r.id === action.requestId);
      if (idx === -1) return state;
      const req = state.requests[idx];
      if (req.status !== "pending") return state;

      const now = isoNow();
      const actor = findActor(action.actorId);

      const updated: BookingRequest = {
        ...req,
        status: "waitlisted",
        decidedAt: now,
        decidedBy: actor.id,
        decisionReason: null,
        decisionShareWithRequester: false,
      };

      const audit: AuditEntry = {
        id: makeAuditId(state.nextAuditSeq),
        entityType: "booking_request",
        entityId: req.id,
        fromState: "pending",
        toState: "waitlisted",
        action: "request.waitlisted",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: null,
        metadata: {},
        createdAt: now,
      };

      return {
        ...state,
        requests: replaceAt(state.requests, idx, updated),
        audit: [...state.audit, audit],
        nextAuditSeq: state.nextAuditSeq + 1,
      };
    }

    case "edit_pending_request": {
      const idx = state.requests.findIndex((r) => r.id === action.requestId);
      if (idx === -1) return state;
      const req = state.requests[idx];
      if (req.status !== "pending") return state;

      const fieldDiff = diff(
        {
          people: req.people,
          dietaryNotes: req.dietaryNotes,
          specialOccasion: req.specialOccasion,
        },
        action.patch
      );
      if (Object.keys(fieldDiff).length === 0) return state;

      const now = isoNow();
      const actor = findActor(action.actorId);

      const updated: BookingRequest = {
        ...req,
        people: action.patch.people ?? req.people,
        dietaryNotes:
          action.patch.dietaryNotes !== undefined
            ? action.patch.dietaryNotes
            : req.dietaryNotes,
        specialOccasion:
          action.patch.specialOccasion !== undefined
            ? action.patch.specialOccasion
            : req.specialOccasion,
      };

      const audit: AuditEntry = {
        id: makeAuditId(state.nextAuditSeq),
        entityType: "booking_request",
        entityId: req.id,
        fromState: "pending",
        toState: "pending",
        action: "request.edited",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: null,
        metadata: { diff: fieldDiff },
        createdAt: now,
      };

      return {
        ...state,
        requests: replaceAt(state.requests, idx, updated),
        audit: [...state.audit, audit],
        nextAuditSeq: state.nextAuditSeq + 1,
      };
    }

    case "edit_booking": {
      const idx = state.bookings.findIndex((b) => b.id === action.bookingId);
      if (idx === -1) return state;
      const booking = state.bookings[idx];
      if (
        booking.status !== "awaiting_completion" &&
        booking.status !== "awaiting_payment"
      ) {
        return state;
      }

      const fieldDiff = diff(
        {
          people: booking.people,
          dietaryNotes: booking.dietaryNotes,
          specialOccasion: booking.specialOccasion,
        },
        action.patch
      );
      if (Object.keys(fieldDiff).length === 0) return state;

      const event = state.events.find((e) => e.id === booking.eventId);
      if (!event) return state;

      const now = isoNow();
      const actor = findActor(action.actorId);
      const newPeople = action.patch.people ?? booking.people;
      const newAmount = event.priceCents * newPeople;

      const updated: Booking = {
        ...booking,
        people: newPeople,
        amountCents: newAmount,
        dietaryNotes:
          action.patch.dietaryNotes !== undefined
            ? action.patch.dietaryNotes
            : booking.dietaryNotes,
        specialOccasion:
          action.patch.specialOccasion !== undefined
            ? action.patch.specialOccasion
            : booking.specialOccasion,
        revision: booking.revision + 1,
        status: "awaiting_completion",
        completionToken: makeToken(state.nextBookingSeq),
        completionTokenIssuedAt: now,
        completionTokenUsedAt: null,
        completionDeadlineAt: new Date(
          Date.now() + 72 * 60 * 60 * 1000
        ).toISOString(),
        paymentDeadlineAt: null,
        stripeSessionId: null,
        updatedAt: now,
      };

      const audit: AuditEntry = {
        id: makeAuditId(state.nextAuditSeq),
        entityType: "booking",
        entityId: booking.id,
        fromState: booking.status,
        toState: "awaiting_completion",
        action: "booking.edited_pre_payment",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: action.reason,
        metadata: {
          fromRevision: booking.revision,
          toRevision: booking.revision + 1,
          diff: fieldDiff,
        },
        createdAt: now,
      };

      return {
        ...state,
        bookings: replaceAt(state.bookings, idx, updated),
        audit: [...state.audit, audit],
        nextAuditSeq: state.nextAuditSeq + 1,
      };
    }

    case "resend_completion": {
      const idx = state.bookings.findIndex((b) => b.id === action.bookingId);
      if (idx === -1) return state;
      const booking = state.bookings[idx];
      if (
        booking.status !== "awaiting_completion" &&
        booking.status !== "awaiting_payment"
      ) {
        return state;
      }
      const now = isoNow();
      const actor = findActor(action.actorId);

      const updated: Booking = {
        ...booking,
        completionTokenIssuedAt: now,
        updatedAt: now,
      };

      const audit: AuditEntry = {
        id: makeAuditId(state.nextAuditSeq),
        entityType: "booking",
        entityId: booking.id,
        fromState: booking.status,
        toState: booking.status,
        action: "booking.completion_link_resent",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: null,
        metadata: {},
        createdAt: now,
      };

      return {
        ...state,
        bookings: replaceAt(state.bookings, idx, updated),
        audit: [...state.audit, audit],
        nextAuditSeq: state.nextAuditSeq + 1,
      };
    }

    case "mark_cancelled_after_payment": {
      const idx = state.bookings.findIndex((b) => b.id === action.bookingId);
      if (idx === -1) return state;
      const booking = state.bookings[idx];
      if (booking.status !== "paid") return state;
      if (booking.cancelledAfterPaymentAt !== null) return state;

      const now = isoNow();
      const actor = findActor(action.actorId);

      const updated: Booking = {
        ...booking,
        cancelledAfterPaymentAt: now,
        cancelledAfterPaymentBy: actor.id,
        cancelledAfterPaymentReason: action.reason,
        updatedAt: now,
      };

      const audit: AuditEntry = {
        id: makeAuditId(state.nextAuditSeq),
        entityType: "booking",
        entityId: booking.id,
        fromState: "paid",
        toState: "paid",
        action: "booking.cancelled_after_payment",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: action.reason,
        metadata: {},
        createdAt: now,
      };

      return {
        ...state,
        bookings: replaceAt(state.bookings, idx, updated),
        audit: [...state.audit, audit],
        nextAuditSeq: state.nextAuditSeq + 1,
      };
    }

    case "delete_prenotazione": {
      const idx = state.requests.findIndex((r) => r.id === action.requestId);
      if (idx === -1) return state;
      const req = state.requests[idx];
      const now = isoNow();
      const actor = findActor(action.actorId);

      // Find optional matching booking (if request was already accepted)
      const bookingIdx = state.bookings.findIndex(
        (b) => b.requestId === req.id
      );

      // Don't allow deletion if the prenotazione is paid
      if (bookingIdx !== -1) {
        const b = state.bookings[bookingIdx];
        if (b.status === "paid") return state;
      }

      // Mark the request as cancelled (regardless of its current state, as
      // long as it isn't already terminated). This is the unified "delete".
      const updatedReq: BookingRequest = {
        ...req,
        status: "cancelled",
        decidedAt: now,
        decidedBy: actor.id,
      };

      const reqAudit: AuditEntry = {
        id: makeAuditId(state.nextAuditSeq),
        entityType: "booking_request",
        entityId: req.id,
        fromState: req.status,
        toState: "cancelled",
        action: "request.deleted",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: null,
        metadata: {},
        createdAt: now,
      };

      if (bookingIdx === -1) {
        return {
          ...state,
          requests: replaceAt(state.requests, idx, updatedReq),
          audit: [...state.audit, reqAudit],
          nextAuditSeq: state.nextAuditSeq + 1,
        };
      }

      // If there was a booking, void it too (invalidates the completion link)
      const booking = state.bookings[bookingIdx];
      const updatedBooking: Booking = {
        ...booking,
        status: "void",
        voidedAt: now,
        voidReason: "Prenotazione eliminata dal team.",
        updatedAt: now,
      };

      const bookingAudit: AuditEntry = {
        id: makeAuditId(state.nextAuditSeq + 1),
        entityType: "booking",
        entityId: booking.id,
        fromState: booking.status,
        toState: "void",
        action: "booking.voided",
        actorType: "admin",
        actorId: actor.id,
        actorLabel: actor.name,
        reason: null,
        metadata: {},
        createdAt: now,
      };

      return {
        ...state,
        requests: replaceAt(state.requests, idx, updatedReq),
        bookings: replaceAt(state.bookings, bookingIdx, updatedBooking),
        audit: [...state.audit, reqAudit, bookingAudit],
        nextAuditSeq: state.nextAuditSeq + 2,
      };
    }

    case "create_event": {
      const seq = state.nextEventSeq;
      const id = makeEventId(seq);
      const slug = makeSlug(action.draft.title) || `evento-${seq}`;
      const now = isoNow();

      const event: EventRecord = {
        id,
        slug,
        title: action.draft.title,
        description: action.draft.description,
        startsAt: action.draft.startsAt,
        durationMin: action.draft.durationMin,
        capacity: action.draft.capacity,
        priceCents: action.draft.priceCents,
        currency: "EUR",
        vatRateBps: 2200,
        status: action.draft.status,
        createdAt: now,
      };

      return {
        ...state,
        events: [...state.events, event],
        nextEventSeq: seq + 1,
      };
    }

    case "update_event": {
      const idx = state.events.findIndex((e) => e.id === action.eventId);
      if (idx === -1) return state;
      const event = state.events[idx];
      // Block edits if the event is past the draft stage.
      if (event.status !== "draft") return state;

      const next: EventRecord = {
        ...event,
        title: action.patch.title ?? event.title,
        slug: action.patch.title ? makeSlug(action.patch.title) : event.slug,
        description: action.patch.description ?? event.description,
        startsAt: action.patch.startsAt ?? event.startsAt,
        durationMin: action.patch.durationMin ?? event.durationMin,
        capacity: action.patch.capacity ?? event.capacity,
        priceCents: action.patch.priceCents ?? event.priceCents,
      };
      return {
        ...state,
        events: replaceAt(state.events, idx, next),
      };
    }

    case "publish_event": {
      const idx = state.events.findIndex((e) => e.id === action.eventId);
      if (idx === -1) return state;
      const event = state.events[idx];
      if (event.status !== "draft") return state;

      const next: EventRecord = { ...event, status: "published" };
      return {
        ...state,
        events: replaceAt(state.events, idx, next),
      };
    }

    default:
      return state;
  }
}

/* ----------------------------------------------------------------------------
 * Derive unified status (folds hidden states into "deleted")
 * -------------------------------------------------------------------------- */

export function deriveUnifiedStatus(
  request: BookingRequest,
  booking: Booking | null
): UnifiedStatus {
  if (request.status === "pending") return "received";
  if (request.status === "rejected") return "rejected";
  if (request.status === "waitlisted") return "waitlisted";
  if (request.status === "cancelled" || request.status === "expired") {
    return "deleted";
  }
  // accepted → look at booking
  if (!booking) return "deleted";
  if (booking.status === "paid") {
    if (booking.cancelledAfterPaymentAt) return "paid_cancelled";
    return "paid";
  }
  if (
    booking.status === "awaiting_completion" ||
    booking.status === "awaiting_payment"
  ) {
    return "to_pay";
  }
  return "deleted";
}

/* ----------------------------------------------------------------------------
 * Capacity recap (computed reactively from store state)
 * -------------------------------------------------------------------------- */

export type CapacityRecap = {
  capacity: number;
  paidSeats: number;
  toPaySeats: number;
  waitlistedSeats: number;
  receivedSeats: number;
  rejectedSeats: number;
  paidCancelledSeats: number;
  availableSeats: number;
};

export function computeRecap(
  event: EventRecord,
  prenotazioni: Prenotazione[]
): CapacityRecap {
  let paidSeats = 0;
  let toPaySeats = 0;
  let waitlistedSeats = 0;
  let receivedSeats = 0;
  let rejectedSeats = 0;
  let paidCancelledSeats = 0;
  for (const p of prenotazioni) {
    const people = p.booking?.people ?? p.request.people;
    switch (p.unifiedStatus) {
      case "paid":
        paidSeats += people;
        break;
      case "paid_cancelled":
        paidSeats += people;
        paidCancelledSeats += people;
        break;
      case "to_pay":
        toPaySeats += people;
        break;
      case "waitlisted":
        waitlistedSeats += people;
        break;
      case "received":
        receivedSeats += people;
        break;
      case "rejected":
        rejectedSeats += people;
        break;
      // "deleted" → ignored
    }
  }
  return {
    capacity: event.capacity,
    paidSeats,
    toPaySeats,
    waitlistedSeats,
    receivedSeats,
    rejectedSeats,
    paidCancelledSeats,
    availableSeats: Math.max(0, event.capacity - paidSeats),
  };
}

/* ----------------------------------------------------------------------------
 * Context
 * -------------------------------------------------------------------------- */

type ContextValue = {
  state: State;
  dispatch: React.Dispatch<Action>;
  actorId: string;
};

const Ctx = React.createContext<ContextValue | null>(null);

export function PrenotazioniProvider({
  children,
  actorId = mockCurrentAdmin.id,
}: {
  children: React.ReactNode;
  actorId?: string;
}) {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const value = React.useMemo(
    () => ({ state, dispatch, actorId }),
    [state, actorId]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx() {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "PrenotazioniProvider mancante. Avvolgi le pagine admin con il provider."
    );
  }
  return ctx;
}

/* ----------------------------------------------------------------------------
 * Public hooks / selectors
 * -------------------------------------------------------------------------- */

function buildPrenotazione(
  req: BookingRequest,
  state: State
): Prenotazione | null {
  const event = state.events.find((e) => e.id === req.eventId);
  if (!event) return null;
  const booking = state.bookings.find((b) => b.requestId === req.id) ?? null;
  const audit = state.audit
    .filter(
      (a) =>
        (a.entityType === "booking_request" && a.entityId === req.id) ||
        (a.entityType === "booking" && booking && a.entityId === booking.id)
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    id: req.id,
    request: req,
    booking,
    event,
    audit,
    unifiedStatus: deriveUnifiedStatus(req, booking),
    isCancelledAfterPayment: booking?.cancelledAfterPaymentAt != null,
  };
}

/** All prenotazioni — includes "deleted" ones for the rare case a consumer
 * actually wants them. Hide them in UI lists by filtering. */
export function usePrenotazione(id: string): Prenotazione | null {
  const { state } = useCtx();
  const req = state.requests.find((r) => r.id === id);
  if (!req) return null;
  return buildPrenotazione(req, state);
}

export function usePrenotazioniByEvent(eventId: string): Prenotazione[] {
  const { state } = useCtx();
  return state.requests
    .filter((r) => r.eventId === eventId)
    .map((r) => buildPrenotazione(r, state))
    .filter((p): p is Prenotazione => p !== null)
    .filter((p) => p.unifiedStatus !== "deleted")
    .sort((a, b) =>
      b.request.submittedAt.localeCompare(a.request.submittedAt)
    );
}

export function usePrenotazioniAll(): Prenotazione[] {
  const { state } = useCtx();
  return state.requests
    .map((r) => buildPrenotazione(r, state))
    .filter((p): p is Prenotazione => p !== null)
    .filter((p) => p.unifiedStatus !== "deleted");
}

export function usePrenotazioniDispatch() {
  const { dispatch, actorId } = useCtx();
  return { dispatch, actorId };
}

export function useEvents() {
  const { state } = useCtx();
  return state.events;
}

export function useEvent(id: string): EventRecord | null {
  const { state } = useCtx();
  return state.events.find((e) => e.id === id) ?? null;
}

export function useEventRecap(eventId: string): CapacityRecap | null {
  const { state } = useCtx();
  const event = state.events.find((e) => e.id === eventId);
  if (!event) return null;
  const prenotazioni = state.requests
    .filter((r) => r.eventId === eventId)
    .map((r) => buildPrenotazione(r, state))
    .filter((p): p is Prenotazione => p !== null);
  return computeRecap(event, prenotazioni);
}

/* ----------------------------------------------------------------------------
 * Status display labels (single source of truth for the UI)
 * -------------------------------------------------------------------------- */

export const unifiedStatusLabel: Record<UnifiedStatus, string> = {
  received: "Richiesta ricevuta",
  waitlisted: "In lista d'attesa",
  to_pay: "In attesa di pagamento",
  paid: "Pagata",
  rejected: "Rifiutata",
  paid_cancelled: "Pagata · cancellata",
  deleted: "Eliminata",
};

export type UnifiedTone =
  | "neutral"
  | "amber"
  | "indigo"
  | "emerald"
  | "rose"
  | "muted";

export const unifiedStatusTone: Record<UnifiedStatus, UnifiedTone> = {
  received: "neutral",
  waitlisted: "amber",
  to_pay: "indigo",
  paid: "emerald",
  rejected: "muted",
  paid_cancelled: "rose",
  deleted: "muted",
};

/* ----------------------------------------------------------------------------
 * Re-export consent helpers (for components that need them)
 * -------------------------------------------------------------------------- */

export type { Booking, BookingConsents, BookingRequest, EventRecord };
