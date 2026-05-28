import "server-only";

import { formatRomeDate } from "@/modules/xml-export";

export type ManifestEntry = {
  progressive: string;
  filename: string;
  bookingId: string;
  paidAt: string;
  fiscalKind: "private" | "company";
  legalName: string;
  taxCode: string | null;
  vatNumber: string | null;
  sdiCode: string | null;
  pecEmail: string | null;
  amountEur: string;
  vatRate: string;
  eventTitle: string;
  eventDate: string;
};

export type ManifestArtifacts = {
  csv: string;
  json: string;
};

/**
 * Build the manifest artefacts that ship inside the zip alongside the
 * XML files. CSV is the canonical view for the accountant (spreadsheet-
 * friendly); JSON is included for machine consumers (re-imports, audit
 * scripts).
 *
 * The CSV uses `;` as separator — Italian Excel defaults to `;` and
 * happily double-clicks the file open. Fields are quoted to be safe
 * against embedded separators / newlines.
 */
export function buildManifestArtifacts(entries: ManifestEntry[]): ManifestArtifacts {
  return {
    csv: buildCsv(entries),
    json: JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        invoiceCount: entries.length,
        entries,
      },
      null,
      2
    ),
  };
}

function buildCsv(entries: ManifestEntry[]): string {
  const header = [
    "progressivo",
    "file",
    "booking_id",
    "data_pagamento",
    "tipo_soggetto",
    "denominazione",
    "codice_fiscale",
    "partita_iva",
    "codice_sdi",
    "pec",
    "importo_eur",
    "aliquota_iva",
    "evento",
    "data_evento",
  ];
  const rows = entries.map((e) => [
    e.progressive,
    e.filename,
    e.bookingId,
    formatRomeDate(e.paidAt),
    e.fiscalKind,
    e.legalName,
    e.taxCode ?? "",
    e.vatNumber ?? "",
    e.sdiCode ?? "",
    e.pecEmail ?? "",
    e.amountEur,
    e.vatRate,
    e.eventTitle,
    e.eventDate,
  ]);
  return [header, ...rows].map(csvRow).join("\r\n");
}

function csvRow(cols: Array<string | number | null | undefined>): string {
  return cols.map(csvCell).join(";");
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/["\r\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
