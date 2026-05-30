import { VENDOR } from "./vendor";
import {
  computeVatBreakdown,
  formatCents2,
  formatCents7,
  formatEuroAmount,
  formatQuantity7,
  formatVatRate,
} from "./breakdown";
import type { BuiltInvoice, InvoiceInput } from "./types";
import { validateInvoiceInput } from "./validate";

/**
 * Build the FatturaPA FPR12 XML payload for a single paid booking.
 *
 * The output mirrors the structure of `reference/xml/fattura reference.xml`
 * (the accountant-blessed sample). The element order is locked because
 * the FPR12 XSD is ordered (sequence) — generators must emit the children
 * in the exact order or validation against the official schema fails.
 *
 * Whitespace policy: the reference XML is emitted on a single line by the
 * accountant's tooling (Zucchetti). We emit with NO indentation either:
 * the SDI does not care about whitespace, but staying byte-similar to the
 * reference helps human diff'ing during QA.
 */
export function buildInvoiceXml(input: InvoiceInput): BuiltInvoice {
  validateInvoiceInput(input);

  const breakdown = computeVatBreakdown(input.grossAmountCents, input.vatRateBps);

  const fattura =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"` +
    ` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` versione="FPR12">` +
    buildHeader(input) +
    buildBody(input, breakdown) +
    `</p:FatturaElettronica>`;

  return {
    filename: buildFilename(input.invoiceNumber),
    content: fattura,
  };
}

/**
 * Build a deterministic filename like `IT04049550041_2026_0001.xml`.
 *
 * The FatturaPA naming convention allows alphanumeric progressives. We
 * normalise the user-facing `2026/0001` into `2026_0001` (slash is not
 * allowed in filenames).
 */
export function buildFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^A-Za-z0-9]/g, "_");
  return `IT${VENDOR.vatNumber}_${safe}.xml`;
}

// ────────────────────────────────────────────────────────────────────────
// Header
// ────────────────────────────────────────────────────────────────────────

function buildHeader(input: InvoiceInput): string {
  return (
    `<FatturaElettronicaHeader>` +
    buildDatiTrasmissione(input) +
    buildCedentePrestatore() +
    buildCessionarioCommittente(input) +
    `</FatturaElettronicaHeader>`
  );
}

function buildDatiTrasmissione(input: InvoiceInput): string {
  const codiceDestinatario = resolveCodiceDestinatario(input);
  return (
    `<DatiTrasmissione>` +
    `<IdTrasmittente>` +
    `<IdPaese>${VENDOR.country}</IdPaese>` +
    `<IdCodice>${escapeXml(VENDOR.vatNumber)}</IdCodice>` +
    `</IdTrasmittente>` +
    `<ProgressivoInvio>${escapeXml(input.transmissionProgressive)}</ProgressivoInvio>` +
    `<FormatoTrasmissione>FPR12</FormatoTrasmissione>` +
    `<CodiceDestinatario>${escapeXml(codiceDestinatario)}</CodiceDestinatario>` +
    `</DatiTrasmissione>`
  );
}

function resolveCodiceDestinatario(input: InvoiceInput): string {
  if (input.buyer.kind === "private") return "0000000";
  return (input.buyer.sdiCode || "").toUpperCase();
}

function buildCedentePrestatore(): string {
  return (
    `<CedentePrestatore>` +
    `<DatiAnagrafici>` +
    `<IdFiscaleIVA>` +
    `<IdPaese>${VENDOR.country}</IdPaese>` +
    `<IdCodice>${escapeXml(VENDOR.vatNumber)}</IdCodice>` +
    `</IdFiscaleIVA>` +
    `<CodiceFiscale>${escapeXml(VENDOR.taxCode)}</CodiceFiscale>` +
    `<Anagrafica>` +
    `<Denominazione>${escapeXml(VENDOR.denomination)}</Denominazione>` +
    `</Anagrafica>` +
    `<RegimeFiscale>${VENDOR.regimeFiscale}</RegimeFiscale>` +
    `</DatiAnagrafici>` +
    `<Sede>` +
    `<Indirizzo>${escapeXml(VENDOR.address.street)}</Indirizzo>` +
    (VENDOR.address.streetNumber
      ? `<NumeroCivico>${escapeXml(VENDOR.address.streetNumber)}</NumeroCivico>`
      : "") +
    `<CAP>${escapeXml(VENDOR.address.zip)}</CAP>` +
    `<Comune>${escapeXml(VENDOR.address.city)}</Comune>` +
    `<Provincia>${escapeXml(VENDOR.address.province)}</Provincia>` +
    `<Nazione>${VENDOR.address.country}</Nazione>` +
    `</Sede>` +
    `<IscrizioneREA>` +
    `<Ufficio>${escapeXml(VENDOR.rea.office)}</Ufficio>` +
    `<NumeroREA>${escapeXml(VENDOR.rea.number)}</NumeroREA>` +
    `<CapitaleSociale>${escapeXml(VENDOR.rea.capitaleSociale)}</CapitaleSociale>` +
    `<SocioUnico>${VENDOR.rea.socioUnico}</SocioUnico>` +
    `<StatoLiquidazione>${VENDOR.rea.statoLiquidazione}</StatoLiquidazione>` +
    `</IscrizioneREA>` +
    (VENDOR.pecEmail
      ? `<Contatti><Email>${escapeXml(VENDOR.pecEmail)}</Email></Contatti>`
      : "") +
    `</CedentePrestatore>`
  );
}

function buildCessionarioCommittente(input: InvoiceInput): string {
  const buyer = input.buyer;
  if (buyer.kind === "private") {
    const tc = (buyer.taxCode || "").toUpperCase().replace(/\s+/g, "");
    return (
      `<CessionarioCommittente>` +
      `<DatiAnagrafici>` +
      `<CodiceFiscale>${escapeXml(tc)}</CodiceFiscale>` +
      `<Anagrafica>` +
      `<Nome>${escapeXml(buyer.firstName.trim())}</Nome>` +
      `<Cognome>${escapeXml(buyer.lastName.trim())}</Cognome>` +
      `</Anagrafica>` +
      `</DatiAnagrafici>` +
      buildSede(buyer.address) +
      `</CessionarioCommittente>`
    );
  }
  // company
  const vat = (buyer.vatNumber || "").replace(/\s+/g, "");
  const cf = (buyer.taxCode || "").replace(/\s+/g, "");
  return (
    `<CessionarioCommittente>` +
    `<DatiAnagrafici>` +
    `<IdFiscaleIVA>` +
    `<IdPaese>IT</IdPaese>` +
    `<IdCodice>${escapeXml(vat)}</IdCodice>` +
    `</IdFiscaleIVA>` +
    (cf ? `<CodiceFiscale>${escapeXml(cf)}</CodiceFiscale>` : "") +
    `<Anagrafica>` +
    `<Denominazione>${escapeXml(buyer.denomination.trim())}</Denominazione>` +
    `</Anagrafica>` +
    `</DatiAnagrafici>` +
    buildSede(buyer.address) +
    `</CessionarioCommittente>`
  );
}

function buildSede(addr: InvoiceInput["buyer"]["address"]): string {
  return (
    `<Sede>` +
    `<Indirizzo>${escapeXml(addr.street.trim())}</Indirizzo>` +
    (addr.streetNumber
      ? `<NumeroCivico>${escapeXml(addr.streetNumber.trim())}</NumeroCivico>`
      : "") +
    `<CAP>${escapeXml(addr.zip)}</CAP>` +
    `<Comune>${escapeXml(addr.city.trim())}</Comune>` +
    `<Provincia>${escapeXml(addr.province)}</Provincia>` +
    `<Nazione>${addr.country}</Nazione>` +
    `</Sede>`
  );
}

// ────────────────────────────────────────────────────────────────────────
// Body
// ────────────────────────────────────────────────────────────────────────

function buildBody(
  input: InvoiceInput,
  breakdown: ReturnType<typeof computeVatBreakdown>
): string {
  return (
    `<FatturaElettronicaBody>` +
    buildDatiGenerali(input) +
    buildDatiBeniServizi(input, breakdown) +
    buildDatiPagamento(input) +
    `</FatturaElettronicaBody>`
  );
}

function buildDatiGenerali(input: InvoiceInput): string {
  return (
    `<DatiGenerali>` +
    `<DatiGeneraliDocumento>` +
    `<TipoDocumento>TD01</TipoDocumento>` +
    `<Divisa>EUR</Divisa>` +
    `<Data>${invoiceDocumentDate(input.paidAtIso)}</Data>` +
    `<Numero>${escapeXml(input.invoiceNumber)}</Numero>` +
    `<ImportoTotaleDocumento>${formatCents2(input.grossAmountCents)}</ImportoTotaleDocumento>` +
    `</DatiGeneraliDocumento>` +
    `</DatiGenerali>`
  );
}

function buildDatiBeniServizi(
  input: InvoiceInput,
  breakdown: ReturnType<typeof computeVatBreakdown>
): string {
  // FatturaPA REQUIRES that `sum(DettaglioLinee.PrezzoTotale) ==
  // DatiRiepilogo.ImponibileImporto` — i.e. line amounts are net of
  // VAT, and the IVA is applied on top to produce `ImportoTotaleDocumento`.
  //
  // Our `unitGrossPriceCents` is the GROSS price displayed to the
  // user (Stripe charged the gross). We therefore split it into the
  // net per-unit price and net line total. The split is driven by the
  // already-rounded `breakdown.imponibileCents` (single source of truth):
  //
  //   PrezzoUnitario = imponibileCents / 100 / quantity   (8 decimals)
  //   PrezzoTotale   = imponibileCents / 100              (7 decimals)
  //
  // The two values may differ by a few sub-cents when `imponibileCents`
  // is not divisible by `quantity` (e.g. 24590 / 3); the SDI tolerates
  // this provided that the invariant on the line-total / Imponibile /
  // Imposta / TotaleDocumento sum holds — which is guaranteed by
  // computeVatBreakdown.
  const unitNetEuro =
    breakdown.imponibileCents / 100 / input.line.quantity;
  return (
    `<DatiBeniServizi>` +
    `<DettaglioLinee>` +
    `<NumeroLinea>1</NumeroLinea>` +
    `<Descrizione>${escapeXml(input.line.description.trim())}</Descrizione>` +
    `<Quantita>${formatQuantity7(input.line.quantity)}</Quantita>` +
    `<PrezzoUnitario>${formatEuroAmount(unitNetEuro, 8)}</PrezzoUnitario>` +
    `<PrezzoTotale>${formatCents7(breakdown.imponibileCents)}</PrezzoTotale>` +
    `<AliquotaIVA>${formatVatRate(input.vatRateBps)}</AliquotaIVA>` +
    `</DettaglioLinee>` +
    `<DatiRiepilogo>` +
    `<AliquotaIVA>${formatVatRate(input.vatRateBps)}</AliquotaIVA>` +
    `<ImponibileImporto>${formatCents2(breakdown.imponibileCents)}</ImponibileImporto>` +
    `<Imposta>${formatCents2(breakdown.impostaCents)}</Imposta>` +
    `<EsigibilitaIVA>I</EsigibilitaIVA>` +
    `</DatiRiepilogo>` +
    `</DatiBeniServizi>`
  );
}

function buildDatiPagamento(input: InvoiceInput): string {
  // Align the payment-term reference/due dates to the document date (last
  // day of the month) so the invoice never shows a due date earlier than
  // its issue date.
  const paymentDate = invoiceDocumentDate(input.paidAtIso);
  const mode = input.paymentMode ?? "MP08";
  return (
    `<DatiPagamento>` +
    `<CondizioniPagamento>TP02</CondizioniPagamento>` +
    `<DettaglioPagamento>` +
    `<ModalitaPagamento>${mode}</ModalitaPagamento>` +
    `<DataRiferimentoTerminiPagamento>${paymentDate}</DataRiferimentoTerminiPagamento>` +
    `<DataScadenzaPagamento>${paymentDate}</DataScadenzaPagamento>` +
    `<ImportoPagamento>${formatCents2(input.grossAmountCents)}</ImportoPagamento>` +
    `</DettaglioPagamento>` +
    `</DatiPagamento>`
  );
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

/**
 * XML-escape a free-text string. Replaces the five entity references
 * required by XML 1.0: `&`, `<`, `>`, `"`, `'`.
 *
 * We chain `sanitizeFatturaText` first, because the FatturaPA XSD
 * restricts most string elements to `[\p{IsBasicLatin}\p{IsLatin-1Supplement}]`
 * (i.e. characters in U+0000 – U+00FF). Typographic chars like the em-dash
 * `—` (U+2014) or smart quotes would be rejected by the SDI even though
 * the file is well-formed XML.
 */
export function escapeXml(value: string): string {
  return sanitizeFatturaText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Normalise a free-text string so it fits the FatturaPA character set.
 *
 * The official XSD restricts most string fields to characters in
 * `BasicLatin + Latin-1Supplement` (U+0000 – U+00FF). This function:
 *  1. Replaces common typographic characters with ASCII equivalents
 *     (em/en dashes, smart quotes, ellipsis, NBSP).
 *  2. Unicode-normalises in NFC (combining marks → composed forms).
 *  3. Strips any remaining out-of-range character.
 *
 * The result is still readable Italian text — Italian accented chars
 * (à, è, é, ì, ò, ù, ñ, ü, etc.) live in Latin-1 Supplement and are
 * preserved verbatim.
 */
export function sanitizeFatturaText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u2010-\u2015\u2212]/g, "-") // dashes (en, em, figure, minus)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // double quotes
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/[\u00A0\u2007\u202F]/g, " ") // various non-breaking spaces
    .replace(/[^\u0000-\u00FF]/g, ""); // strip anything still out of range
}

/**
 * Format an ISO-8601 timestamp as a `YYYY-MM-DD` calendar date in
 * `Europe/Rome`. We use `Intl.DateTimeFormat` with `en-CA` (which yields
 * the ISO-style date layout) instead of `toISOString()` because that
 * would emit the UTC date and shift the calendar day for late-evening
 * Rome timestamps.
 */
export function formatRomeDate(iso: string): string {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA gives "YYYY-MM-DD" directly.
  return formatter.format(d);
}

/**
 * Invoice document date (`<Data>` in DatiGeneraliDocumento). Per the
 * venue's accounting policy the document is always dated the LAST day of
 * the month in which the booking was paid — never the actual payment day.
 * E.g. all June bookings (exported on July 1st) are dated 2026-06-30;
 * February bookings get 2026-02-28 (or -29 in a leap year).
 * The month/year are taken in `Europe/Rome` so the calendar boundary
 * matches the accountant's.
 */
export function invoiceDocumentDate(paidAtIso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(paidAtIso));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) {
    throw new Error(`invoiceDocumentDate: cannot derive month from ${paidAtIso}`);
  }
  // Day 0 of the *next* month (1-indexed `month`) === last day of `month`.
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
}
