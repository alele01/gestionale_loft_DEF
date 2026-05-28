import "server-only";

import * as React from "react";

import { serverEnv } from "@/server/env";

import { sendEmail } from "../send";
import { E8AdminNewRequest } from "../templates/e8-admin-new-request";
import type { EmailSendResult } from "../types";

export type SendE8Input = {
  requestId: string;
  adminId: string;
  adminEmail: string;
  eventTitle: string;
  eventStartsAt: string;
  people: number;
  requesterFullName: string;
  requesterEmail: string;
};

/**
 * Send E8 (Admin internal notice) to a single admin. The state machine
 * fans out across admin_users when the toggle is on.
 */
export async function sendE8AdminNewRequest(
  input: SendE8Input
): Promise<EmailSendResult> {
  const adminUrl = `${serverEnv.APP_BASE_URL.replace(/\/+$/u, "")}/admin/prenotazioni/${input.requestId}`;
  return sendEmail({
    idempotencyKey: `admin_new_request:${input.requestId}:${input.adminId}`,
    emailId: "E8",
    entity: { type: "booking_request", id: input.requestId },
    to: input.adminEmail,
    subject: `Nuova richiesta — ${input.eventTitle}`,
    react: React.createElement(E8AdminNewRequest, {
      eventTitle: input.eventTitle,
      eventStartsAt: input.eventStartsAt,
      people: input.people,
      requesterFullName: input.requesterFullName,
      requesterEmail: input.requesterEmail,
      adminUrl,
    }),
    headers: {
      "X-Cooker-Request-Id": input.requestId,
    },
  });
}
