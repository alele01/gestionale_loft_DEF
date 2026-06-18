import "server-only";

/**
 * Email module shared types.
 *
 * Email IDs follow the inventory in docs/EMAILS.md §2. E6 (payment confirmed)
 * and E7 (accountant XML export) live in the inventory but are wired in the
 * Stripe and XML phases respectively; we still type them so the dispatcher
 * surface is forward-compatible.
 */

export const EMAIL_IDS = [
  "E1",
  "E2",
  "E3",
  "E4",
  "E5",
  "E6",
  "E7",
  "E8",
  "E9",
  "E10",
  "E11",
  "E12",
] as const;

export type EmailId = (typeof EMAIL_IDS)[number];

export type EmailEntityType = "booking_request" | "booking" | "xml_export";

export type EmailSendResult =
  | { status: "sent"; messageId: string; deduplicated: boolean }
  | { status: "failed"; error: string };

export type AcceptanceMode = "initial" | "amendment";
