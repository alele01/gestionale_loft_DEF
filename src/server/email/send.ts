import "server-only";

import { render } from "@react-email/render";

import { appendAuditLog } from "@/server/audit/log";
import { AUDIT_ACTIONS, AUDIT_ACTORS } from "@/server/audit-actions";
import { getResendReplyToEmail, requireResendFromEmail } from "@/server/env";
import { getServiceClient } from "@/server/supabase";

import { getResendClient } from "./client";
import {
  appendEmailLog,
  findEmailByIdempotencyKey,
} from "./log";
import type {
  EmailEntityType,
  EmailId,
  EmailSendResult,
} from "./types";

const EMAIL_AUDIT_ACTION: Record<EmailId, (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]> = {
  E1: AUDIT_ACTIONS.emailE1,
  E2: AUDIT_ACTIONS.emailE2,
  E3: AUDIT_ACTIONS.emailE3,
  E4: AUDIT_ACTIONS.emailE4,
  E5: AUDIT_ACTIONS.emailE5,
  E6: AUDIT_ACTIONS.emailE6,
  E7: AUDIT_ACTIONS.emailE7,
  E8: AUDIT_ACTIONS.emailE8,
  E9: AUDIT_ACTIONS.emailE9,
  E10: AUDIT_ACTIONS.emailE10,
  E11: AUDIT_ACTIONS.emailE11,
  E12: AUDIT_ACTIONS.emailE12,
};

const AUDIT_ENTITY_BY_TYPE: Record<EmailEntityType, "booking_request" | "booking" | "xml_export"> = {
  booking_request: "booking_request",
  booking: "booking",
  xml_export: "xml_export",
};

export type SendEmailInput = {
  /** Stable per-event key. Used to short-circuit duplicate sends. */
  idempotencyKey: string;
  emailId: EmailId;
  entity: { type: EmailEntityType; id: string };
  to: string;
  subject: string;
  react: React.ReactElement;
  /** Optional override; falls back to RESEND_REPLY_TO_EMAIL/venue contact. */
  replyTo?: string;
  /** Optional headers (e.g. X-Cooker-Booking-Id). */
  headers?: Record<string, string>;
};

/**
 * Send a transactional email via Resend.
 *
 * Behaviour:
 *  - Looks up `email_log.idempotency_key` first. If a `sent` row exists,
 *    returns the existing message id without re-sending. If a `failed` row
 *    exists, we retry by sending again (using a NEW row).
 *  - Renders the React Email template to HTML + plain-text.
 *  - On Resend success, writes a `sent` row to email_log and an audit_log
 *    row with action `side_effect.email.EN` and `status='sent'` metadata.
 *  - On any failure (render or transport), writes a `failed` row and audit
 *    entry. Never throws: the caller — typically a state-machine action —
 *    must not roll back because email is best-effort.
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const client = getServiceClient();

  const existing = await findEmailByIdempotencyKey(client, input.idempotencyKey);
  if (existing && existing.status === "sent" && existing.resend_message_id) {
    return {
      status: "sent",
      messageId: existing.resend_message_id,
      deduplicated: true,
    };
  }

  let html: string;
  let text: string;
  try {
    html = await render(input.react);
    text = await render(input.react, { plainText: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await onFailure(client, input, `template render failed: ${message}`);
    return { status: "failed", error: message };
  }

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: requireResendFromEmail(),
      to: [input.to],
      replyTo: input.replyTo ?? getResendReplyToEmail(),
      subject: input.subject,
      html,
      text,
      headers: input.headers,
    });
    if (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
      await onFailure(client, input, message);
      return { status: "failed", error: message };
    }
    const messageId = data?.id ?? null;
    await appendEmailLog(client, {
      idempotencyKey: input.idempotencyKey,
      emailId: input.emailId,
      entityType: input.entity.type,
      entityId: input.entity.id,
      recipientEmail: input.to,
      subject: input.subject,
      status: "sent",
      resendMessageId: messageId,
      errorMessage: null,
    });
    await appendAuditLog({
      entityType: AUDIT_ENTITY_BY_TYPE[input.entity.type],
      entityId: input.entity.id,
      action: EMAIL_AUDIT_ACTION[input.emailId],
      actorType: AUDIT_ACTORS.system,
      metadata: {
        status: "sent",
        email_id: input.emailId,
        recipient: input.to,
        subject: input.subject,
        resend_message_id: messageId,
        idempotency_key: input.idempotencyKey,
      },
    });
    return {
      status: "sent",
      messageId: messageId ?? "",
      deduplicated: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await onFailure(client, input, message);
    return { status: "failed", error: message };
  }
}

async function onFailure(
  client: ReturnType<typeof getServiceClient>,
  input: SendEmailInput,
  message: string
): Promise<void> {
  // Failed sends use a timestamped suffix on the idempotency key so the
  // unique constraint doesn't collide if we retry later with the same
  // logical key.
  const failedKey = `${input.idempotencyKey}:failed_${Date.now()}`;
  await appendEmailLog(client, {
    idempotencyKey: failedKey,
    emailId: input.emailId,
    entityType: input.entity.type,
    entityId: input.entity.id,
    recipientEmail: input.to,
    subject: input.subject,
    status: "failed",
    resendMessageId: null,
    errorMessage: message,
  });
  await appendAuditLog({
    entityType: AUDIT_ENTITY_BY_TYPE[input.entity.type],
    entityId: input.entity.id,
    action: EMAIL_AUDIT_ACTION[input.emailId],
    actorType: AUDIT_ACTORS.system,
    metadata: {
      status: "failed",
      email_id: input.emailId,
      recipient: input.to,
      subject: input.subject,
      error: message,
      idempotency_key: input.idempotencyKey,
    },
  });
  // eslint-disable-next-line no-console
  console.error("[email] send failed", {
    emailId: input.emailId,
    idempotencyKey: input.idempotencyKey,
    error: message,
  });
}
