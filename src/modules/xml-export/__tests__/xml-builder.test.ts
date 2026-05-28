import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  buildInvoiceXml,
  buildFilename,
  escapeXml,
  formatRomeDate,
  sanitizeFatturaText,
} from "../xml-builder";
import { computeVatBreakdown } from "../breakdown";
import {
  ALL_FIXTURES,
  companyWithPecOnly,
  companyWithSdi,
  halfCentRounding,
  privateApostrophe,
  privateDittaIndividuale,
  privateTorino,
} from "./fixtures";

describe("buildInvoiceXml — structure (strict-ordered)", () => {
  it("emits the FPR12 root with the expected namespaces", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    assert.match(content, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(
      content,
      /<p:FatturaElettronica [^>]*xmlns:p="http:\/\/ivaservizi\.agenziaentrate\.gov\.it\/docs\/xsd\/fatture\/v1\.2"/
    );
    assert.match(content, /versione="FPR12"/);
    assert.match(content, /<\/p:FatturaElettronica>$/);
  });

  it("keeps the FatturaPA child sequence (Header → Body)", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    const headerIdx = content.indexOf("<FatturaElettronicaHeader>");
    const bodyIdx = content.indexOf("<FatturaElettronicaBody>");
    assert.ok(headerIdx >= 0 && bodyIdx > headerIdx);
  });

  it("emits Header sequence (DatiTrasmissione → CedentePrestatore → CessionarioCommittente)", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    const dt = content.indexOf("<DatiTrasmissione>");
    const cp = content.indexOf("<CedentePrestatore>");
    const cc = content.indexOf("<CessionarioCommittente>");
    assert.ok(dt >= 0 && cp > dt && cc > cp);
  });

  it("emits Body sequence (DatiGenerali → DatiBeniServizi → DatiPagamento)", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    const dg = content.indexOf("<DatiGenerali>");
    const db = content.indexOf("<DatiBeniServizi>");
    const dp = content.indexOf("<DatiPagamento>");
    assert.ok(dg >= 0 && db > dg && dp > db);
  });
});

describe("buildInvoiceXml — vendor (CedentePrestatore)", () => {
  it("emits the locked ANIDRA S.R.L. P.IVA", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    assert.match(content, /<CedentePrestatore>[\s\S]*<IdCodice>04049550041<\/IdCodice>/);
    assert.match(content, /<Denominazione>ANIDRA S\.R\.L\.<\/Denominazione>/);
    assert.match(content, /<RegimeFiscale>RF01<\/RegimeFiscale>/);
  });

  it("emits the vendor REA block", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    assert.match(content, /<IscrizioneREA>[\s\S]*<Ufficio>TO<\/Ufficio>/);
    assert.match(content, /<SocioUnico>SM<\/SocioUnico>/);
    assert.match(content, /<StatoLiquidazione>LN<\/StatoLiquidazione>/);
  });
});

describe("buildInvoiceXml — buyer branching", () => {
  it("emits CodiceDestinatario = SDI for B2B with SDI", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    assert.match(content, /<CodiceDestinatario>M5UXCR1<\/CodiceDestinatario>/);
  });

  it("emits CodiceDestinatario = 0000000 for B2C", () => {
    const { content } = buildInvoiceXml(privateTorino);
    assert.match(content, /<CodiceDestinatario>0000000<\/CodiceDestinatario>/);
  });

  it("emits CodiceDestinatario = 0000000 for B2B with PEC routing", () => {
    const { content } = buildInvoiceXml(companyWithPecOnly);
    assert.match(content, /<CodiceDestinatario>0000000<\/CodiceDestinatario>/);
  });

  it("emits Anagrafica.Nome + Cognome for private buyer", () => {
    const { content } = buildInvoiceXml(privateTorino);
    assert.match(
      content,
      /<CessionarioCommittente>[\s\S]*<Anagrafica><Nome>Mario<\/Nome><Cognome>Rossi<\/Cognome><\/Anagrafica>/
    );
    // Private buyer must NOT have IdFiscaleIVA
    const ccMatch = content.match(
      /<CessionarioCommittente>([\s\S]*?)<\/CessionarioCommittente>/
    );
    assert.ok(ccMatch);
    assert.equal(
      ccMatch![1].includes("<IdFiscaleIVA>"),
      false,
      "private buyer must not have IdFiscaleIVA"
    );
  });

  it("emits IdFiscaleIVA + Denominazione for company buyer", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    assert.match(
      content,
      /<CessionarioCommittente>[\s\S]*<IdFiscaleIVA>[\s\S]*<IdCodice>01234567890<\/IdCodice>/
    );
    assert.match(
      content,
      /<CessionarioCommittente>[\s\S]*<Denominazione>Acme S\.r\.l\.<\/Denominazione>/
    );
  });

  it("uses the 11-digit ditta-individuale tax code as CodiceFiscale", () => {
    const { content } = buildInvoiceXml(privateDittaIndividuale);
    assert.match(
      content,
      /<CessionarioCommittente>[\s\S]*<CodiceFiscale>98765432109<\/CodiceFiscale>/
    );
  });
});

describe("buildInvoiceXml — VAT breakdown", () => {
  it("respects the imponibile + imposta = gross invariant for every fixture", () => {
    for (const [name, input] of Object.entries(ALL_FIXTURES)) {
      const { content } = buildInvoiceXml(input);
      const breakdown = computeVatBreakdown(input.grossAmountCents, input.vatRateBps);
      const expected =
        `<ImponibileImporto>${cents(breakdown.imponibileCents)}</ImponibileImporto>` +
        `<Imposta>${cents(breakdown.impostaCents)}</Imposta>`;
      assert.ok(
        content.includes(expected),
        `fixture ${name}: breakdown block not found, expected ${expected}`
      );
      assert.equal(
        breakdown.imponibileCents + breakdown.impostaCents,
        input.grossAmountCents,
        `fixture ${name}: invariant violated`
      );
    }
  });

  it("emits the same gross in ImportoTotaleDocumento and ImportoPagamento", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    assert.match(content, /<ImportoTotaleDocumento>240\.00<\/ImportoTotaleDocumento>/);
    assert.match(content, /<ImportoPagamento>240\.00<\/ImportoPagamento>/);
  });

  it("handles the half-cent rounding fixture without exception", () => {
    const { content } = buildInvoiceXml(halfCentRounding);
    const breakdown = computeVatBreakdown(
      halfCentRounding.grossAmountCents,
      halfCentRounding.vatRateBps
    );
    assert.equal(
      breakdown.imponibileCents + breakdown.impostaCents,
      halfCentRounding.grossAmountCents
    );
    assert.match(content, /<ImportoTotaleDocumento>122\.00<\/ImportoTotaleDocumento>/);
  });
});

describe("buildInvoiceXml — text safety", () => {
  it("XML-escapes apostrophes and accented chars in private buyer fields", () => {
    const { content } = buildInvoiceXml(privateApostrophe);
    // Apostrophe must be encoded as &apos;
    assert.match(content, /D&apos;Azeglio/);
    // Accented Italian characters survive UTF-8 round-trip.
    assert.match(content, /Lùcia/);
  });

  it("does not double-escape ampersands", () => {
    const input = { ...companyWithSdi };
    (input.buyer as { denomination: string }).denomination = "Acme & Co. S.r.l.";
    const { content } = buildInvoiceXml(input);
    assert.match(content, /Acme &amp; Co\. S\.r\.l\./);
    assert.equal(
      content.includes("&amp;amp;"),
      false,
      "double-escape detected"
    );
  });
});

describe("buildInvoiceXml — line item & payment", () => {
  it("emits the line block with prices NET of VAT (FatturaPA requirement)", () => {
    // companyWithSdi: gross 240€ (2 × 120€), VAT 22% →
    //   imponibile = 196.72, imposta = 43.28, totale = 240.00
    // PrezzoUnitario / PrezzoTotale must be the NET (imponibile) split,
    // not the gross, so that sum(PrezzoTotale) == ImponibileImporto.
    const { content } = buildInvoiceXml(companyWithSdi);
    assert.match(content, /<NumeroLinea>1<\/NumeroLinea>/);
    assert.match(content, /<Quantita>2\.0000000<\/Quantita>/);
    assert.match(content, /<PrezzoUnitario>98\.36000000<\/PrezzoUnitario>/);
    assert.match(content, /<PrezzoTotale>196\.7200000<\/PrezzoTotale>/);
    assert.match(content, /<AliquotaIVA>22\.00<\/AliquotaIVA>/);
    assert.match(content, /<ImponibileImporto>196\.72<\/ImponibileImporto>/);
    assert.match(content, /<Imposta>43\.28<\/Imposta>/);
    assert.match(content, /<ImportoTotaleDocumento>240\.00<\/ImportoTotaleDocumento>/);
  });

  it("uses MP08 (carta) and TP02 (pagamento completo) by default", () => {
    const { content } = buildInvoiceXml(companyWithSdi);
    assert.match(content, /<CondizioniPagamento>TP02<\/CondizioniPagamento>/);
    assert.match(content, /<ModalitaPagamento>MP08<\/ModalitaPagamento>/);
  });
});

describe("filename / helpers", () => {
  it("buildFilename converts slashes to underscores", () => {
    assert.equal(buildFilename("2026/0001"), "IT04049550041_2026_0001.xml");
    assert.equal(buildFilename("2026-0001"), "IT04049550041_2026_0001.xml");
  });

  it("escapeXml covers the 5 entity references", () => {
    assert.equal(escapeXml("<&\">'"), "&lt;&amp;&quot;&gt;&apos;");
  });

  it("sanitizeFatturaText normalises typographic chars to Latin-1", () => {
    // em-dash, en-dash, smart quotes, ellipsis, NBSP
    assert.equal(
      sanitizeFatturaText("hello — world – \u201Cciao\u201D \u2018a\u2019\u2026"),
      `hello - world - "ciao" 'a'...`
    );
    // Italian accented characters survive (Latin-1 Supplement).
    assert.equal(sanitizeFatturaText("àèéìòùÀÈÉÌÒÙñü"), "àèéìòùÀÈÉÌÒÙñü");
    // Out-of-range emoji is stripped, NOT replaced with a placeholder.
    assert.equal(sanitizeFatturaText("ciao🍝"), "ciao");
    // Non-breaking space becomes a regular space.
    assert.equal(sanitizeFatturaText("a\u00A0b"), "a b");
  });

  it("escapeXml strips typographic chars (em-dash) before XML-escaping", () => {
    // em-dash must NOT survive XML escape — it's outside the SDI charset.
    const out = escapeXml("a — b");
    assert.equal(out, "a - b");
  });

  it("formatRomeDate renders the Rome calendar day for late-evening UTC timestamps", () => {
    // 23 May 22:30 UTC = 24 May 00:30 Rome (CEST).
    assert.equal(formatRomeDate("2026-05-23T22:30:00Z"), "2026-05-24");
    // 23 May 12:00 UTC = 23 May 14:00 Rome.
    assert.equal(formatRomeDate("2026-05-23T12:00:00Z"), "2026-05-23");
  });
});

function cents(c: number): string {
  const intPart = Math.trunc(Math.abs(c) / 100);
  const fracPart = Math.abs(c) % 100;
  const sign = c < 0 ? "-" : "";
  return `${sign}${intPart}.${fracPart.toString().padStart(2, "0")}`;
}
