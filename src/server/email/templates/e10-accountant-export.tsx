import "server-only";

import { Section, Text } from "@react-email/components";
import * as React from "react";

import {
  Heading,
  InfoBlock,
  Muted,
  Paragraph,
  PrimaryButton,
  WarningBlock,
} from "./_components";
import { EmailLayout } from "./_layout";
import { formatCurrencyEUR } from "../format";

export type E10Props = {
  /**
   * Period label e.g. "Maggio 2026" or "01/05/2026 – 31/05/2026".
   * Pre-formatted server-side so the email renderer stays locale-stable.
   */
  periodLabel: string;
  /** How many XML invoices the zip contains. */
  invoiceCount: number;
  /** Sum of all gross amounts, in cents. */
  totalGrossCents: number;
  /** First and last invoice numbers issued in this batch ("YYYY/NNNN"). */
  firstInvoiceNumber: string;
  lastInvoiceNumber: string;
  /**
   * Time-limited download URL pointing at the Supabase Storage zip.
   * TTL is set by the sender (default: 7 days).
   */
  downloadUrl: string;
  /** Human-friendly TTL hint ("7 giorni"). */
  downloadTtlLabel: string;
};

/**
 * E10 — Monthly XML export for the accountant.
 *
 * Triggered by either the monthly cron job or an admin-initiated manual
 * run. Idempotency key is `xml_export_email:{export_id}` (see `send-e10.ts`).
 *
 * The email never carries the XML payload as an attachment: the zip
 * lives in a private Supabase Storage bucket and we send a signed URL
 * here. This keeps the message size predictable (Resend caps inbound
 * attachments at 40 MB) and lets us revoke access after the TTL expires.
 */
export function E10AccountantExport({
  periodLabel,
  invoiceCount,
  totalGrossCents,
  firstInvoiceNumber,
  lastInvoiceNumber,
  downloadUrl,
  downloadTtlLabel,
}: E10Props) {
  const preview = `Export fatture SDI — ${periodLabel} (${invoiceCount} fatture)`;
  return (
    <EmailLayout preview={preview}>
      <Heading>Export fatture SDI — {periodLabel}</Heading>

      <Paragraph>
        In allegato il pacchetto delle fatture elettroniche del periodo, in
        formato FPR12 pronto per l&apos;invio allo SDI.
      </Paragraph>

      <Section style={summaryStyle}>
        <Text style={summaryLabel}>Periodo</Text>
        <Text style={summaryValue}>{periodLabel}</Text>

        <Text style={summaryLabel}>Numero fatture</Text>
        <Text style={summaryValue}>{invoiceCount}</Text>

        <Text style={summaryLabel}>Importo lordo totale</Text>
        <Text style={summaryValue}>{formatCurrencyEUR(totalGrossCents)}</Text>

        <Text style={summaryLabel}>Numerazione</Text>
        <Text style={summaryValue}>
          dalla {firstInvoiceNumber} alla {lastInvoiceNumber}
        </Text>
      </Section>

      <PrimaryButton href={downloadUrl}>Scarica il pacchetto ZIP</PrimaryButton>

      <Muted>
        Il link è valido per {downloadTtlLabel}. Se hai problemi a scaricarlo,
        rispondi a questa email o accedi all&apos;area amministrativa per
        rigenerarlo.
      </Muted>

      <InfoBlock>
        Il pacchetto contiene un file XML per ogni prenotazione pagata nel
        periodo, oltre a un <strong>manifest.csv</strong> (e una versione JSON)
        con il riepilogo per tracciabilità.
      </InfoBlock>

      <WarningBlock>
        Le fatture <strong>non sono firmate digitalmente</strong> né trasmesse
        automaticamente allo SDI: l&apos;invio resta a cura dello studio
        secondo le procedure usuali.
      </WarningBlock>

      <Paragraph>
        Grazie,
        <br />
        <strong>Anidra S.r.l. — Cooker Loft</strong>
      </Paragraph>
    </EmailLayout>
  );
}

const summaryStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  margin: "16px 0",
  padding: "16px",
};

const summaryLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.05em",
  margin: "8px 0 2px 0",
  textTransform: "uppercase",
};

const summaryValue: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: 600,
  lineHeight: "1.4",
  margin: "0 0 4px 0",
};

export default E10AccountantExport;
