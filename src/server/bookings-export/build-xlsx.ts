import "server-only";

import ExcelJS from "exceljs";

import type { BookingExportRow } from "./queries";

export type BookingsXlsxEventMeta = {
  title: string;
  startsAtIso: string;
};

const HEADER_FILL = "FFAA2620";

function statusLabel(status: BookingExportRow["status"]): string {
  return status === "paid" ? "Pagata" : "In attesa di pagamento";
}

function imageConsentLabel(choice: string | null): string {
  if (choice === "accept") return "Sì";
  if (choice === "decline") return "No";
  return "—";
}

/**
 * Build a styled .xlsx workbook (as a Buffer) listing the people booked on
 * an event. Pure formatting — no DB access, no side effects. Columns mirror
 * the public pre-registration form, plus payment status/amount and image
 * consent.
 */
export async function buildBookingsXlsx(
  rows: BookingExportRow[],
  event: BookingsXlsxEventMeta
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cooker Loft";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Prenotazioni", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Nome", key: "firstName", width: 18 },
    { header: "Cognome", key: "lastName", width: 18 },
    { header: "N. persone", key: "people", width: 12 },
    { header: "Telefono", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 30 },
    {
      header: "Allergie / intolleranze / esigenze",
      key: "dietaryNotes",
      width: 40,
    },
    { header: "Occasione speciale", key: "specialOccasion", width: 24 },
    { header: "Stato pagamento", key: "status", width: 20 },
    { header: "Importo (€)", key: "amount", width: 14 },
    { header: "Consenso immagini", key: "imageConsent", width: 18 },
  ];

  for (const r of rows) {
    sheet.addRow({
      firstName: r.firstName,
      lastName: r.lastName,
      people: r.people,
      phone: r.phone,
      email: r.email,
      dietaryNotes: r.dietaryNotes,
      specialOccasion: r.specialOccasion,
      status: statusLabel(r.status),
      amount: r.amountCents / 100,
      imageConsent: imageConsentLabel(r.imageUseChoice),
    });
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
  });

  sheet.getColumn("amount").numFmt = '#,##0.00 "€"';
  sheet.getColumn("people").alignment = { horizontal: "center" };

  // Light borders + wrap on the long free-text columns.
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E2E2" } },
      };
      if (rowNumber > 1) {
        cell.alignment = { ...cell.alignment, vertical: "top", wrapText: true };
      }
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Filename like `prenotazioni-2026-06-12-fermento.xlsx`, ASCII-safe.
 */
export function buildBookingsXlsxFilename(event: BookingsXlsxEventMeta): string {
  const datePart = event.startsAtIso.slice(0, 10);
  const slug = event.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `prenotazioni-${datePart}${slug ? `-${slug}` : ""}.xlsx`;
}
