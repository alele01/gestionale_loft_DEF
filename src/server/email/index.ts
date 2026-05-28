import "server-only";

/**
 * Public barrel for the server-only email layer (Resend integration).
 *
 * Importing from a client component is blocked by the `server-only` marker
 * propagating through every file under `src/server/`.
 *
 * Usage from a state-machine action:
 *
 *   import { sendE2RequestAccepted } from "@/server/email";
 *   await sendE2RequestAccepted({ ... });
 *
 * The senders never throw on transport failure: they log to `email_log`
 * and `audit_log` and return `{ status: 'failed', error }` so the booking
 * state transition can stay committed.
 */

export { sendE1RequestReceived } from "./senders/send-e1";
export type { SendE1Input } from "./senders/send-e1";
export { sendE2RequestAccepted } from "./senders/send-e2";
export type { SendE2Input } from "./senders/send-e2";
export { sendE3RequestRejected } from "./senders/send-e3";
export type { SendE3Input } from "./senders/send-e3";
export { sendE4RequestWaitlisted } from "./senders/send-e4";
export type { SendE4Input } from "./senders/send-e4";
export { sendE5AcceptedFromWaitlist } from "./senders/send-e5";
export type { SendE5Input } from "./senders/send-e5";
export { sendE6PaymentConfirmation } from "./senders/send-e6";
export type { SendE6Input } from "./senders/send-e6";
export { sendE7PaymentRetry } from "./senders/send-e7";
export type { SendE7Input } from "./senders/send-e7";
export { sendE8AdminNewRequest } from "./senders/send-e8";
export type { SendE8Input } from "./senders/send-e8";
export { sendE9ReviewRequest } from "./senders/send-e9";
export type { SendE9Input } from "./senders/send-e9";
export { sendE10AccountantExport } from "./senders/send-e10";
export type { SendE10Input } from "./senders/send-e10";

export type {
  AcceptanceMode,
  EmailId,
  EmailSendResult,
} from "./types";
