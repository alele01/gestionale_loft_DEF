import "server-only";

import * as React from "react";

import { sendEmail } from "../send";
import { E10AccountantExport } from "../templates/e10-accountant-export";
import type { EmailSendResult } from "../types";

export type SendE10Input = {
  /** xml_exports.id — used as the audit entity and idempotency anchor. */
  exportId: string;
  /** Recipient (accountant_email from app_settings, captured at run start). */
  accountantEmail: string;
  /** Pre-formatted period label, e.g. "Maggio 2026". */
  periodLabel: string;
  invoiceCount: number;
  totalGrossCents: number;
  firstInvoiceNumber: string;
  lastInvoiceNumber: string;
  /** Signed URL pointing at the Supabase Storage zip. */
  downloadUrl: string;
  downloadTtlLabel: string;
  /**
   * Marks resends: when truthy the idempotency key is suffixed with the
   * timestamp so a new email is actually sent (otherwise the first send
   * is deduplicated).
   */
  resend?: boolean;
};

/**
 * Send E10 (Monthly XML export to the accountant).
 *
 * Idempotency anchor is `xml_export_email:{exportId}` so the cron job
 * is safe to retry. Manual resends pass `resend: true` which appends a
 * timestamp to the key.
 */
export async function sendE10AccountantExport(
  input: SendE10Input
): Promise<EmailSendResult> {
  const baseKey = `xml_export_email:${input.exportId}`;
  const idempotencyKey = input.resend
    ? `${baseKey}:resend_${Date.now()}`
    : baseKey;
  const subject = `Export fatture SDI — ${input.periodLabel}`;
  return sendEmail({
    idempotencyKey,
    emailId: "E10",
    entity: { type: "xml_export", id: input.exportId },
    to: input.accountantEmail,
    subject,
    react: React.createElement(E10AccountantExport, {
      periodLabel: input.periodLabel,
      invoiceCount: input.invoiceCount,
      totalGrossCents: input.totalGrossCents,
      firstInvoiceNumber: input.firstInvoiceNumber,
      lastInvoiceNumber: input.lastInvoiceNumber,
      downloadUrl: input.downloadUrl,
      downloadTtlLabel: input.downloadTtlLabel,
    }),
    headers: {
      "X-Cooker-Xml-Export-Id": input.exportId,
    },
  });
}
