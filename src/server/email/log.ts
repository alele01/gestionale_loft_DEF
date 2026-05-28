import "server-only";

import { getServiceClient, type ServiceClient } from "@/server/supabase";

import type { EmailEntityType, EmailId } from "./types";

export type EmailLogRow = {
  id: string;
  idempotency_key: string;
  email_id: string;
  entity_type: string;
  entity_id: string;
  recipient_email: string;
  subject: string | null;
  resend_message_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

/**
 * Look up an existing email_log row by idempotency key. Returns null if
 * absent. Used by `sendEmail` to short-circuit duplicate sends.
 */
export async function findEmailByIdempotencyKey(
  client: ServiceClient,
  idempotencyKey: string
): Promise<EmailLogRow | null> {
  const { data, error } = await client
    .from("email_log")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[email_log] lookup failed", { idempotencyKey, error });
    return null;
  }
  return data as EmailLogRow | null;
}

export type AppendEmailLogInput = {
  idempotencyKey: string;
  emailId: EmailId;
  entityType: EmailEntityType;
  entityId: string;
  recipientEmail: string;
  subject: string | null;
  status: "sent" | "failed";
  resendMessageId: string | null;
  errorMessage: string | null;
};

export async function appendEmailLog(
  client: ServiceClient,
  input: AppendEmailLogInput
): Promise<void> {
  const { error } = await client.from("email_log").insert({
    idempotency_key: input.idempotencyKey,
    email_id: input.emailId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    recipient_email: input.recipientEmail,
    subject: input.subject,
    status: input.status,
    resend_message_id: input.resendMessageId,
    error_message: input.errorMessage,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[email_log] insert failed", { input, error });
  }
}

/**
 * Default service client variant for callers that don't want to thread a
 * client through (e.g. ad-hoc admin-triggered actions).
 */
export async function appendEmailLogDefault(
  input: AppendEmailLogInput
): Promise<void> {
  await appendEmailLog(getServiceClient(), input);
}
