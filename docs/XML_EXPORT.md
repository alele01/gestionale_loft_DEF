# Cooker Loft V1 — Fiscal XML Export

- **Purpose**: define how V1 produces fiscal XML files for paid bookings and delivers them to the accountant by email, and where the boundaries of responsibility lie.
- **Scope**: the isolated XML module, the periodic export job, the accountant email delivery, and the audit trail.
- **Out of scope**: direct submission to the Sistema di Interscambio (SDI), Fatture in Cloud / third-party fiscal SaaS integration, automatic refunds, electronic signature. See [NON_GOALS.md](./NON_GOALS.md).
- **Owner**: Cooker Loft technical lead.
- **Last updated**: 2026-05-20.

---

## 1. Disclaimer (binding)

**Fiscal correctness of the generated XML files is not guaranteed by the V1 system and must be validated by the venue's accountant and/or legal counsel before the XML is used for any fiscal purpose.**

V1 generates XML in a format aligned with the Italian fattura elettronica (FatturaPA) family of schemas, but:

- The exact schema version (`FormatoTrasmissione`) is **confirmed with the accountant** before go-live. The default working assumption, derived from the accountant's reference sample (see §1.1), is **`FPR12`** (FatturaElettronicaPrivati v1.2) with `TipoDocumento` **`TD01`** and `RegimeFiscale` **`RF01`**.
- V1 **does not** transmit XML to SDI.
- V1 **does not** apply a qualified digital signature (.p7m).
- V1 produces files; the accountant is the human gate between V1 and the fiscal authority.

This disclaimer is reproduced in the accountant email (E7 in [EMAILS.md](./EMAILS.md)) and in the admin UI screen that triggers the export.

## 1.1 Reference sample from the accountant (binding dependency)

The XML module's implementation **depends on** the accountant's reference XML file, located at:

- [reference/xml/fattura reference.xml](../reference/xml/fattura%20reference.xml)

This file is the structural reference for the V1 generator. It is **not** the literal template (it carries one specific transaction's data); it is the **structural source of truth** for:

- Schema namespace and version (`http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2`, `versione="FPR12"`).
- The set and order of `FatturaElettronicaHeader` children (`DatiTrasmissione`, `CedentePrestatore`, `CessionarioCommittente`, optionally `TerzoIntermediarioOSoggettoEmittente`, `SoggettoEmittente`).
- The set and order of `FatturaElettronicaBody` children (`DatiGenerali` → `DatiGeneraliDocumento`, `DatiBeniServizi` → `DettaglioLinee` + `DatiRiepilogo`, `DatiPagamento`, optional `Allegati`).
- The shape and value-set of fiscal fields (`TipoDocumento = TD01`, `RegimeFiscale = RF01`, `EsigibilitaIVA`, `CondizioniPagamento`, `ModalitaPagamento`).
- The vendor identity placeholders for `CedentePrestatore`: `IdPaese=IT`, `IdCodice=04049550041`, `Denominazione=ANIDRA S.R.L.`, sede legale, IscrizioneREA (where applicable).

**Implementation gate**: writing code for `src/modules/xml-export/` is **blocked** until either (a) this sample exists at the path above and has been analyzed, or (b) the accountant has confirmed an alternative target structure in writing. See [TASK_PLAN.md](./TASK_PLAN.md) Phase 7.

If the accountant later provides an updated sample (e.g. a B2C / private-customer variant), the new file is added alongside the existing one (e.g. `reference/xml/fattura reference-privato.xml`) and referenced in this section before any implementation changes.

## 2. Why an isolated module

The brief mandates isolation, and there are concrete reasons:

- Fiscal rules change. Quarantining the change surface to one module makes upgrades safe.
- The module's correctness is something the accountant must be able to **review** without reading the whole app.
- Testing fiscal XML generation is a pure-functional problem. Isolating it makes it trivially unit-testable.

### Module boundary

- Path (working name, confirmed in the implementation phase): `src/modules/xml-export/`.
- Imports allowed:
  - Standard library, well-known XML builders (e.g. `fast-xml-parser` or a dedicated builder).
  - Type definitions from a shared `types/` location.
- Imports **forbidden**:
  - Any React / Next.js / UI module.
  - Any direct DB client (Supabase). Inputs are passed in as plain TypeScript objects.
  - Any HTTP / network client. The module does not call Resend, does not write to Supabase Storage, does not call Stripe.
- Outputs:
  - For a single booking: a string (the XML body) and a `filename` (deterministic).
  - For a batch: an array of `{ filename, content }` plus a `manifest` (see §6).

The module is therefore a **pure function** of its inputs. Side effects (reading bookings, writing files to storage, sending email) live in the calling layer (`src/server/jobs/xml-export-run.ts` or equivalent).

## 3. Inputs

The module accepts a typed payload per booking. Shape (illustrative, final types confirmed at implementation):

- `bookingId`
- `bookingNumber` (a human-readable progressive number assigned by the export run; see §7)
- `paidAt` (ISO timestamp)
- `currency` (`'EUR'`)
- `grossAmountCents`: **the IVA-inclusa total**, equal to `bookings.amount_paid_cents`.
- `vatRateBps`: VAT rate in basis points (e.g. `2200` = 22.00%), read from the event (`events.vat_rate_bps`). Default 22%.
- `unitGrossPriceCents`: per-person gross price (= `events.price_cents`), preserved for `<PrezzoUnitario>` / `<PrezzoTotale>` line construction.
- `event`: `{ title, startsAt, lineDescription }` — `lineDescription` is the free-text description for `DettaglioLinee/Descrizione`, derived from the event title and date (template configurable).
- `people` (= `Quantita` in `DettaglioLinee`).
- `fiscalProfile`:
  - `kind` (`private` | `company`)
  - `legalName`
  - `taxCode` (CF) — required for `private`
  - `vatNumber` (P.IVA) — required for `company`
  - `address`: `{ street, city, zip, province, country }`
  - `sdiCode` (7-char codice destinatario)
  - `pecEmail`
  - `invoiceNote`
- `vendor`: app-level constants describing Cooker Loft as the seller (legal name `ANIDRA S.R.L.`, VAT `04049550041`, sede legale, REA where applicable, `RegimeFiscale`). Stored in `app_settings` or a typed constants module. Default values mirror the reference sample at `reference/xml/fattura reference.xml`.
- `operationalCancellation` (optional): `{ cancelledAt, by, reason }`. When present, the manifest flags the line for the accountant's attention but the XML is still produced (see §5.2 and §12).

Validation:

- The module **validates its inputs** with zod and throws on any inconsistency (e.g. `kind = company` with no `vatNumber`, `grossAmountCents <= 0`, `vatRateBps < 0`, sum of derived `imponibile + imposta` not equal to `grossAmountCents`).
- The caller is expected to load all required data first; the module does not "fix" missing data.

## 3.1 IVA inclusa: VAT breakdown computation (binding)

All money values fed to the XML module are **IVA inclusa (gross)**. The XML schema requires the breakdown as `ImponibileImporto` (net) and `Imposta` (VAT amount). The module computes the breakdown as follows, in integer cents:

```
imposta_cents     = round_half_to_even(grossAmountCents * vatRateBps / (10000 + vatRateBps))
imponibile_cents  = grossAmountCents - imposta_cents
```

Rationale:

- The Italian fattura format expects `ImponibileImporto + Imposta = ImportoTotaleDocumento` exactly.
- We anchor on the gross amount because (a) the gross is what Stripe charged and what the customer paid, (b) recomputing the gross from a stored net would create rounding drift between Stripe and the XML.
- `round_half_to_even` (banker's rounding) avoids systematic upward bias on `.5` half-cents.
- `Imposta` is computed first; `ImponibileImporto` is the gross minus `Imposta`. This guarantees the equality even in edge cases.

The accountant validates the rounding rule before go-live. If the accountant requests `round_half_away_from_zero` (more common in invoicing software), the constant is swapped — single-line change. The unit-test suite covers a list of fixtures with known expected breakdowns (see [TEST_PLAN.md](./TEST_PLAN.md)).

Per-line construction (within `DettaglioLinee`):

- `Quantita = people`.
- `PrezzoUnitario = unitGrossPriceCents / 100` formatted to 8 decimal places (matches the reference sample's precision).
- `PrezzoTotale = (unitGrossPriceCents * people) / 100`, 7 decimal places.
- `AliquotaIVA = vatRateBps / 100` (e.g. `"22.00"`).

`DatiRiepilogo` then carries `AliquotaIVA`, `ImponibileImporto`, `Imposta`, `EsigibilitaIVA` (`"I"` immediate by default, per the reference sample).

## 4. Outputs and filenames

- One XML file per paid booking.
- Filename convention: `IT{vendorVat}_{progressive}.xml` where `progressive` is a zero-padded alphanumeric counter assigned by the export run. This aligns with FatturaPA file-naming conventions and is finalized with the accountant.
- Each XML is UTF-8 encoded, with the appropriate XML declaration.
- The module also produces a `manifest.csv` per batch with columns: `progressive, filename, bookingId, paidAt, fiscalKind, legalName, taxCode, vatNumber, amountEur, note`. The manifest is for the accountant's convenience and for internal audit.

## 5. XML structure (high level)

The default mapping mirrors `reference/xml/fattura reference.xml` (schema `FPR12`, namespace `http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2`). The conceptual structure is:

- `<p:FatturaElettronica versione="FPR12">`
  - `<FatturaElettronicaHeader>`
    - `<DatiTrasmissione>`: `IdTrasmittente`, `ProgressivoInvio` (10-char alphanumeric, generated per send), `FormatoTrasmissione = "FPR12"`, `CodiceDestinatario` (= `fiscalProfile.sdiCode` for companies; `"0000000"` for private customers or companies without SDI; the PEC, when present, goes into the buyer block instead).
    - `<CedentePrestatore>`: Cooker Loft as the seller — `IdFiscaleIVA(IT, 04049550041)`, `CodiceFiscale=04049550041`, `Denominazione="ANIDRA S.R.L."`, `RegimeFiscale="RF01"`, sede legale, `IscrizioneREA` (where applicable), `Contatti.Email` (PEC vendor).
    - `<CessionarioCommittente>`: the booking's `fiscal_profiles` row mapped to either `IdFiscaleIVA + CodiceFiscale` (company) or `CodiceFiscale + Anagrafica.Cognome/Nome` (private).
  - `<FatturaElettronicaBody>`
    - `<DatiGenerali><DatiGeneraliDocumento>`: `TipoDocumento="TD01"`, `Divisa="EUR"`, `Data` (`paidAt` in `Europe/Rome`, date only), `Numero` (progressive, see §7), `ImportoTotaleDocumento = grossAmountCents/100`.
    - `<DatiBeniServizi>`:
      - `<DettaglioLinee>`: one line per booking by default — `NumeroLinea=1`, `Descrizione=event.lineDescription`, `Quantita=people`, `PrezzoUnitario=unitGrossPriceCents/100`, `PrezzoTotale=(unitGrossPriceCents*people)/100`, `AliquotaIVA=vatRateBps/100`.
      - `<DatiRiepilogo>`: `AliquotaIVA`, `ImponibileImporto`, `Imposta`, `EsigibilitaIVA="I"`.
    - `<DatiPagamento>`: `CondizioniPagamento="TP02"` (single full payment), `DettaglioPagamento` with `ModalitaPagamento` matching Stripe (V1: `"MP08"` for card payments; final value confirmed with the accountant), `DataRiferimentoTerminiPagamento=paidAt`, `DataScadenzaPagamento=paidAt`, `ImportoPagamento=grossAmountCents/100`.
    - `<Allegati>`: not generated by V1 by default. (The reference sample includes a courtesy PDF; V1 may attach an internal courtesy summary if the accountant requests it.)

Open questions explicitly flagged for the accountant before go-live (see also §1.1):

- **VAT regime** confirmation — default `RF01` matches the reference sample, but to be re-confirmed if Cooker Loft moves to forfettario or another regime.
- **Document type** for advance/event reservations — default `TD01`. If the accountant prefers `TD24` (deferred invoice) for event reservations, the choice is configurable.
- **Treatment of private (B2C) buyers** — typically `CodiceDestinatario = "0000000"` and `CodiceFiscale` populated in `CessionarioCommittente`. The V1 generator branches on `fiscal_profiles.kind = 'private'` accordingly.
- **`ModalitaPagamento`** — `MP08` (carta di credito) vs `MP05` (bonifico) vs other. Stripe payment events do not always disambiguate cleanly; the accountant confirms the default.
- **Cassa professionale / ritenuta d'acconto** — likely not applicable to a venue, but to be confirmed.
- **`ProgressivoInvio`** policy — random 10-char per send vs deterministic per export — confirmed with the accountant.

These are documented as a checklist in the implementation phase. The module is parameterized so changes flow through configuration, not code edits.

## 5.2 Paid bookings cancelled operationally (fiscal implications)

A `paid` booking can be marked as **operationally cancelled** by the team (see [STATES.md](./STATES.md) §6 and [NON_GOALS.md](./NON_GOALS.md) §3, §7, §16). This is a marker, **not** a state change, and V1 does **not** automate refunds, credit notes, or SDI actions.

Fiscal implications, documented explicitly:

- A paid booking that has **not yet been included** in any `xml_exports` is **still included** in the next export run by default. The customer paid; the invoice is fiscally due. The `manifest.csv` / `manifest.json` flags the booking with a `operationallyCancelled = true` column so the accountant sees it at a glance and can decide whether a credit note is appropriate (handled out-of-band).
- A paid booking that has **already been included** in a prior `xml_exports` is **not** re-touched by V1. Any credit note or correction is handled out-of-band by the accountant; V1 does not produce credit-note XML in V1 (see §13).
- The XML content for a cancelled-after-payment booking is **identical** to a non-cancelled paid booking. The cancellation marker is metadata, not invoice data.
- An admin can choose to **exclude** an operationally-cancelled booking from the next export at run time (UI toggle). This decision is audit-logged and the booking does not appear in `xml_export_items`. This is an explicit, manual override; the default is "include and flag".

The accountant approves the default policy ("include and flag") before go-live. If the accountant prefers "exclude by default", the policy is flipped in `app_settings` (one boolean, no code change).

## 6. Batch / manifest

A single export run produces:

- N XML files (`IT{vendorVat}_{progressive}.xml`).
- 1 `manifest.csv`.
- 1 `manifest.json` with the same data plus run metadata (`period_start`, `period_end`, `bookings_count`, `total_amount_cents`).

All artifacts are zipped into `cooker-loft-fatture-{period_label}.zip`. The zip is uploaded to a **private** Supabase Storage bucket (`xml-exports`) under a path like `{year}/{export_id}.zip`. The bucket has no public read; access is via signed URL or service-role download.

## 7. Numbering and idempotency

Two concerns: progressive numbering and idempotent exports.

### 7.1 Progressive numbers

- The vendor's progressive invoice numbering is the legal numbering. V1's `bookingNumber` for a given XML file must follow the venue's existing scheme. Two strategies:
  - **Reuse**: the accountant gives Cooker Loft a numbering range each year and the system assigns progressives from it.
  - **Delegate**: V1 leaves `Numero` empty in the XML draft and the accountant fills it in.
- V1 default: **reuse**, with the year + a zero-padded counter (e.g. `2026/0001`). The counter is persisted server-side (`app_settings.next_invoice_number` or a dedicated table). This is finalized with the accountant before go-live.

### 7.2 Idempotent export runs

- An export run targets a `[period_start, period_end)` window and includes every booking `paid_at` in that window that is not already included in any prior `xml_exports`.
- If an export run is retried, it sees the prior `xml_export_items` and skips already-exported bookings. The same booking is never invoiced twice by V1.
- If a booking should be re-exported (correction), this is an explicit admin action that creates a `xml_exports` row marked with a reason and links to the original.

## 8. Triggers

V1 supports three ways to trigger an export. They all funnel into the same `runXmlExport` function. The XML module itself is unaware of who triggered it.

### 8.1 Manual export by period (admin button)

- Admin opens the "Esportazione fiscale" page in the dashboard.
- Picks a date range (default: previous month, calendar bounds).
- Sees a preview of the bookings that would be included (count, totals, IVA breakdown).
- Confirms; the export run executes synchronously for small batches (V1 expected volume) or in the background for larger ones.
- The accountant email (E7) is sent at the end of the run.

### 8.2 Manual export by selection (admin button)

- Same page exposes a table of `paid` bookings filterable by event, fiscal kind, and date.
- Admin checks the rows to include (one or many), with no constraint on contiguity in time. Operationally-cancelled bookings can be included or excluded explicitly.
- Confirms; the export run executes on the selected set only, produces N XMLs + a manifest, and sends E7 to the accountant with the artefacts attached.
- This mode is intended for ad-hoc corrections and out-of-cycle deliveries to the accountant. The selection is recorded in `xml_export_items` like any other run; bookings already included in a prior export are blocked from being re-selected (the UI greys them out with a clear reason).

### 8.3 Scheduled monthly (Vercel Cron)

- A Vercel Cron job runs **on the 1st of every calendar month at 03:00 `Europe/Rome`**.
- The job runs `runXmlExport({ periodStart, periodEnd })` for the **previous calendar month** (`Europe/Rome` boundaries: first day at 00:00 inclusive to first day of the new month at 00:00 exclusive).
- The job sends E7 with the period zip attached and writes an `audit_log` row visible to the admin in the export page.
- The job is **idempotent**: re-running it the same day produces no duplicate `xml_exports` row; bookings already included in any prior export are skipped automatically.
- The job is **gated** by `app_settings.xml_export_cron_enabled`. Default ON, admin can pause. The export page surfaces the next-run timestamp and the kill-switch state. (Operational copy in the admin UI keeps the "kill-switch" terminology internal; user-facing copy uses "invio automatico".)
- If a month has no eligible paid bookings, the cron still writes an `audit_log` row but does **not** send E7. The admin sees a row "0 prenotazioni nel periodo" in the past-exports list.

## 9. Email delivery to the accountant

- Recipient: `app_settings.accountant_email`.
- Template: E7 in [EMAILS.md](./EMAILS.md).
- Attachment: the zip from §6 (downloaded from Supabase Storage at send time).
- Failure handling: see EMAILS.md §7. On exhaustion of retries, `xml_exports.status = 'failed'`; admin sees a banner; the admin can re-trigger sending without regenerating.

## 10. Audit

Every export run writes audit log entries:

- `entity_type = 'xml_export'`, `entity_id = xml_export.id`.
- Actions: `generate_start`, `generate_complete`, `email_attempt`, `email_success`, `email_failure`.
- Metadata: bookings count, total amount, error details on failure.

Per-booking inclusion is captured in `xml_export_items` (see [DB_SCHEMA.md](./DB_SCHEMA.md)). The admin UI can answer "which export included booking X?" via that table.

## 11. Re-downloading past exports

- The admin UI lists all `xml_exports` with their period, status, counts, and a download action.
- Downloading uses a short-lived signed URL from Supabase Storage.
- A "resend to accountant" action exists; it does **not** regenerate the XML.

## 12. Failure modes and handling

| Scenario                                                   | Behavior                                                                                                       |
|------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| A booking in the export window is missing fiscal profile   | Should not happen (fiscal profile is required for the `paid` transition), but the module throws a precise error so the run fails loudly. |
| Two paid bookings in the same window for the same customer | Two separate XML files; the accountant deduplicates if needed.                                                 |
| Cron runs while a previous run is still in progress        | A short-lived lock (`xml_exports.status = 'generating'`) prevents overlap. New trigger waits or no-ops.        |
| Storage upload fails                                       | The run is marked `failed` with the error; no email is sent; the admin can retry.                              |
| Email send fails (after success in generation)             | Status moves to `generated`; subsequent retries can move it to `emailed`.                                      |
| Accountant email address misconfigured                     | The run fails at the email step. Generation artifacts are preserved; the admin fixes `app_settings.accountant_email` and re-sends. |
| Operationally-cancelled paid booking in window             | Included in the export by default; `manifest` marks it `operationallyCancelled = true`. Admin can exclude via UI override (audit-logged). |
| Rounding edge case where `Imposta + Imponibile ≠ Gross`    | The module asserts the equality at the end of breakdown computation and refuses to emit the XML if the invariant fails. This indicates a bug; the run is marked `failed`. |
| Reference sample missing at implementation time            | The XML phase is **blocked** by the task plan (see [TASK_PLAN.md](./TASK_PLAN.md) Phase 7). Implementation must not begin. |

## 13. Future work (V2 candidates)

- Direct SDI transmission via an accredited provider.
- Fatture in Cloud / Aruba integration to push invoices upstream.
- Qualified digital signature (`.p7m`).
- Per-event fiscal templates (e.g. `TD24` deferred invoices for events with advance payment models).
- Refund / credit note XML generation.
- Per-period UI for the accountant directly into the dashboard.

## 14. Related documents

- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) — where this module fits in the system.
- [DB_SCHEMA.md](./DB_SCHEMA.md) — `bookings`, `fiscal_profiles`, `xml_exports`, `xml_export_items`, `app_settings`.
- [EMAILS.md](./EMAILS.md) — E7 accountant export email.
- [SECURITY.md](./SECURITY.md) — secrets, signed URLs, fiscal data handling.
- [NON_GOALS.md](./NON_GOALS.md) — what XML export does **not** do in V1.
