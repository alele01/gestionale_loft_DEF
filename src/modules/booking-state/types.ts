import type { Tables } from "@/server/supabase";

/**
 * Shared types for the booking state machine. Centralised here so action
 * modules don't duplicate union literals.
 */

export type BookingRequestRow = Tables<"booking_requests">;
export type BookingRow = Tables<"bookings">;
export type EventRow = Tables<"events">;
export type AppSettingsRow = Tables<"app_settings">;

export type RequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "waitlisted"
  | "cancelled"
  | "expired";

export type BookingStatus =
  | "awaiting_completion"
  | "awaiting_payment"
  | "paid"
  | "expired"
  | "void";

export type BookingOrigin = "direct" | "waitlist";

/**
 * Actor invoking a transition. We carry the actor through every action so
 * audit_log gets a meaningful actor_id/actor_type without each call site
 * having to plumb it manually.
 */
export type Actor =
  | { type: "admin"; adminId: string; email?: string }
  | { type: "representative"; bookingId?: string }
  | { type: "system" }
  | { type: "webhook" }
  | { type: "cron" };

export type SubmitRequestInput = {
  eventId: string;
  requesterFirstName: string;
  requesterLastName: string;
  requesterEmail: string;
  requesterPhone: string;
  people: number;
  dietaryNotes?: string | null;
  specialOccasion?: string | null;
  notes?: string | null;
  ipAddress: string;
  userAgent: string;
  /** Source channel; defaults to "embed". */
  source?: "embed" | "admin";
  /** Consent versions snapshot. */
  consentTermsVersion: string;
  consentPrivacyVersion: string;
  consentHealthVersion: string;
};
