# Cooker Loft V1 — Completion Page Reference

- **Purpose**: define the UX, structure, and validation rules for the booking completion page (`/complete/[token]`). This page is **not** designed from scratch: it adapts a pre-existing Cursor project as its UX reference.
- **Scope**: the representative-facing completion page that runs after the admin accepts a request and before the Stripe Checkout redirect.
- **Out of scope**: payment processing (handled by Stripe Checkout, see [STATES.md](./STATES.md) and [SECURITY.md](./SECURITY.md)), per-participant flows (see [NON_GOALS.md](./NON_GOALS.md)).
- **Owner**: Cooker Loft technical lead.
- **Last updated**: 2026-05-20.

---

## 1. Required pre-reads before writing any code for this page

Before implementing the completion page, the agent or engineer **MUST** read:

- This document.
- The reference assets from the prior Cursor project:
  - [reference/oldPage/indicazioni.txt](../reference/oldPage/indicazioni.txt) — UX layout for legal/privacy/consensi, accordion behavior, mandatory checkboxes, image radio, minor flow, submit button caption.
  - [reference/oldPage/legalContent.ts](../reference/oldPage/legalContent.ts) — full Condizioni generali copy (Anidra S.r.l. legal text).
  - [reference/oldPage/privacyContent.ts](../reference/oldPage/privacyContent.ts) — full privacy notice copy.

If `reference/oldPage/` is missing or empty at the time of implementation, the completion page **must not** be implemented. The missing reference is a hard dependency.

## 2. Purpose of the completion page

The completion page is the only page on which the booking representative interacts with Cooker Loft V1 between acceptance and payment. On a single page the representative must:

1. **Review and confirm** the data already on file from the public request (people count, dietary notes, special occasion). These fields are displayed **read-only** at this step; if any of them is wrong, the representative contacts the team out-of-band, which edits the booking from the admin and re-sends a fresh completion link (see [STATES.md](./STATES.md) §5.2 and §5.3).
2. **Enter fiscal data** (private or company, tax code / VAT, billing address, optional PEC / SDI, invoice note).
3. **Read and accept** the legal documents (Condizioni generali + clausole 1341/1342, Privacy notice, explicit health-data consent).
4. **Express the image-use choice** (separate consent for promotional use of image, mandatory either way).
5. **Declare the minor-flow** information when applicable.
6. **Proceed to Stripe Checkout** for payment.

The page is **token-gated** (the URL contains a single-use, expiring token; see [SECURITY.md](./SECURITY.md) §4). The browser never queries Supabase directly.

## 3. What must be reused from the prior project

| Area                              | Reuse                                                                                                        |
|-----------------------------------|--------------------------------------------------------------------------------------------------------------|
| Overall UX structure              | Single-page form with logical sections separated by light dividers; section order as listed below.           |
| Accordion for long legal copy     | "Condizioni generali" expanded only on click, all items closed by default. Identical pattern for the Privacy notice. |
| Consensi block layout             | Distinct visual block titled "Consensi" containing the mandatory checkboxes, immediately above the submit button. |
| Mandatory checkbox set            | Same three core checkboxes (Condizioni, Approvazione 1341/1342, Privacy) plus the explicit health-data consent specific to V1. |
| Privacy checkbox UX               | Label includes a clickable "informativa privacy" link/button that toggles the inline privacy text below the checkbox; the link does not tick the checkbox; the user is not required to expand the text to submit. |
| Image-use radio (separate)        | Two-option radio "Acconsento / Non acconsento", required, independent of the other checkboxes; clearly marked as revocable. |
| Minor flow (conditional)          | "Il partecipante è minorenne?" Sì/No selector; on "Sì" expose: legal guardian name (required), participation authorization (required), dietary disclosure declaration (required), image use for minor (optional, explicitly facoltativa e revocabile). |
| Reassuring tone of copy           | The reference's "Inviando il modulo confermi…" closing line, adapted to V1 wording.                          |
| Validation approach               | Client-side validation with reactive feedback, server-side re-validation (zod schemas). Errors shown next to the field with a clear, polite tone. |
| Error handling                    | Friendly, blame-free error messages. Network errors retry-able with a manual button.                         |
| Confirmation step                 | A brief "review your data" summary before the final submit if it is technically feasible without a second route. |

## 4. What must NOT be reused from the prior project

| Area                                    | Reason                                                                                          |
|-----------------------------------------|-------------------------------------------------------------------------------------------------|
| Any payment logic from the old project  | Cooker Loft V1 uses Stripe Checkout exclusively, server-driven amount, webhook-only `paid`.     |
| Per-participant data flows              | V1 collects from the **representative** only (see [NON_GOALS.md](./NON_GOALS.md) §1).           |
| Business rules unrelated to V1          | Custom pricing, codes, vouchers, refunds, discounts.                                            |
| Multi-step / wizard with router pages   | V1 keeps the completion as a single page (with intra-page sections) to minimize state plumbing. |
| Hard-coded contract texts that diverge from V1 vendor identity | Cooker Loft V1 vendor identity comes from `app_settings` / vendor constants; legal texts must reference Anidra S.r.l. consistently with the current `legalContent.ts`. |
| Any UI element that exposes secrets or tokens client-side | V1 hard rule: no secrets in the frontend.                                                       |

## 5. Required sections (in order)

The page renders the following sections, top-to-bottom:

1. **Header**
   - Title: "Completa la tua prenotazione".
   - Subtitle: event title + date/time (local, `Europe/Rome`).
   - Reassuring line: "Hai aperto questo link dalla nostra email di conferma. Compila i campi qui sotto per completare la prenotazione e procedere al pagamento."
   - The header reads `bookings` data already on file (no token in this content).

2. **Conferma dati prenotazione** (read-only display)
   - **Numero di persone** (read-only).
   - **Allergie / intolleranze / esigenze alimentari (gruppo)** (read-only; multi-line if needed).
   - **Occasione speciale** (read-only).
   - These three fields are intentionally **not editable** on this page. They were collected on the public form and may have been refined by the team via `editPendingRequest` (before acceptance) or `editBookingPrePayment` (after acceptance) before this email was sent. See [STATES.md](./STATES.md) §5.2 and §5.3.
   - Helper card immediately above or below this block, with a calm tone: "Se i dati non sono corretti, scrivici a `{venue_contact_email}`: il nostro team li aggiorna e ti rimanda un nuovo link." `venue_contact_email` is sourced from `app_settings` / vendor constants (single value in V1).
   - The values displayed here are read server-side from `bookings` (which mirror the latest request data after any pre-acceptance or pre-payment edits). The client cannot mutate them.

3. **Minorenne** (condizionale)
   - Domanda "Il partecipante / il gruppo include un minorenne sotto la responsabilità di un adulto?" Sì/No (required).
   - On "Sì": campi e checkbox da `indicazioni.txt` (autorizzazione partecipazione minore, disclosure allergie minore, image-use minore facoltativa).
   - V1 nota: il minor-flow è UX-equivalente alla reference, ma applicato alla figura del referente/accompagnatore.

4. **Dati fiscali**
   - **Tipo**: radio "Privato" / "Azienda / Professionista".
   - Comuni a entrambi: ragione sociale / nome+cognome legali; indirizzo (via, CAP, città, provincia, nazione default `IT`).
   - **Privato**: Codice Fiscale (obbligatorio); `vat_number` e `sdi_code` non visibili.
   - **Azienda / Professionista**: Partita IVA (obbligatorio); almeno uno tra `sdi_code` (7 caratteri) **oppure** `pec_email` (validato). Se assenti entrambi, l'UI compila `sdi_code = "0000000"` con un avviso esplicito.
   - **Nota fattura** (textarea, opzionale).
   - Validazioni di formato CF / P.IVA con messaggi puliti.

5. **Consensi** (blocco visivamente distinto, accordion legali sopra)
   - **Accordion "Condizioni generali di partecipazione"** (chiuso di default). Contenuto: `legalContent.ts`. La presenza dell'accordion non è una checkbox.
   - **Checkbox obbligatoria — Condizioni generali**: "Dichiaro di aver letto e accettato le Condizioni generali di partecipazione."
   - **Checkbox obbligatoria — Approvazione 1341/1342 c.c.**: testo identico alla reference.
   - **Checkbox obbligatoria — Privacy**: "Dichiaro di aver preso visione dell'[informativa privacy]." Il link inline toggle l'informativa (`privacyContent.ts`) sotto la checkbox; non spunta la checkbox; non è necessario aprirla per inviare.
   - **Checkbox obbligatoria — Consenso esplicito al trattamento dei dati relativi alla salute**: "Esprimo il mio consenso esplicito al trattamento dei dati relativi alla salute eventualmente forniti (allergie, intolleranze, esigenze alimentari), per le finalità indicate nell'informativa." Required (art. 9.2.a GDPR).
   - **Radio obbligatoria — Utilizzo immagine**: "Acconsento / Non acconsento all'utilizzo della mia immagine per finalità promozionali." Una delle due è obbligatoria. Nota sotto: "Scelta separata e revocabile."

6. **Riepilogo importo (read-only)**
   - "Totale (IVA inclusa): € {amount_total} per {people} persona/e."
   - "L'importo è calcolato dal sistema sulla base del prezzo per persona pubblicato; la riga di dettaglio fattura è gestita lato amministrazione."
   - L'importo è **server-rendered**; il client non lo invia e non può modificarlo.

7. **Submit + nota di chiusura**
   - Bottone primario: "Procedi al pagamento".
   - Nota sotto il bottone (adattata dalla reference): "Inviando il modulo confermi la veridicità dei dati forniti, la presa visione delle Condizioni e dell'informativa privacy, e le dichiarazioni di cui sopra. Verrai reindirizzato alla pagina di pagamento sicuro."

## 6. Confirm-only semantics for request data

The completion page is a **confirm-only** step for the data that came from the public request, and an **extend** step for what was not collected yet:

- People, dietary notes, special occasion are **displayed read-only** from `bookings` (which mirror `booking_requests` at acceptance time, plus any subsequent admin edits via `editBookingPrePayment`).
- The representative **cannot** edit those values on this page. If they are wrong, the representative writes to the venue out-of-band; the team applies an admin edit, and the system re-sends the completion link (E2 or E5 amend variant, depending on `bookings.origin`).
- Fiscal data, all consents (legal, privacy, health-data, clauses 1341/1342), image-use choice, and the optional minor-flow declaration are **collected here for the first time** and persisted only on submit.
- The original request row remains unchanged for audit; the booking row carries the latest values plus the fiscal and consent attachments.

## 7. Validation rules (summary; canonical schemas in `src/schemas/`)

- Read-only fields (`people`, `dietary_notes`, `special_occasion`) are **not** part of the submit payload. The server reads them straight from the booking; the client cannot send them. Any client-side payload that includes those keys is rejected by the submit handler.
- Required field set on submit: fiscal "Tipo" + fields conditional on Tipo, all four mandatory consent checkboxes, image-use radio, and the minor-flow Sì/No selector. When minor-flow is "Sì", the conditional minor-flow checkboxes/fields become required.
- Conditional required: minor-flow checkboxes when "minorenne = Sì".
- Lengths: free text ≤ 1000 chars; name fields ≤ 80 chars; phone ≤ 32 chars.
- CF: 16 chars, formato Codice Fiscale italiano.
- P.IVA: 11 cifre (IT) o formato VIES per estero (V1 default: IT).
- `sdi_code`: 7 caratteri alfanumerici; in assenza, default `"0000000"` se `pec_email` presente.
- `pec_email`: formato email valido.
- Amount is never sent by the client; the server recomputes from `events.price_cents * people` (IVA inclusa).

## 8. Consent capture (data persisted on submit)

For each mandatory checkbox and the image-use radio, the server persists:

- `value` (boolean for checkboxes; enum `consent` | `decline` for image-use).
- `accepted_at` (timestamptz at server time of submission).
- `ip_address`, `user_agent` (captured at server, not trusted from client).
- `document_version` (e.g. `terms@2026-05` and `privacy@2026-05`), sourced from app constants. The version string is the audit anchor when copy changes.

Storage is on `bookings` (and / or a dedicated `booking_consents` table; final shape confirmed in implementation). See [DB_SCHEMA.md](./DB_SCHEMA.md).

**Health-data consent** (`art. 9.2.a` GDPR) is captured separately from the privacy consent because the legal basis is different.

## 9. Boundary with payment

This page **never** sets `bookings.status = 'paid'`. The flow is:

1. POST `/api/complete/[token]/submit`:
   - Validate token, validate payload (zod).
   - Persist confirmed/edited critical data + fiscal profile + consents.
   - Compute `amount_cents = events.price_cents * bookings.people` server-side.
   - Create Stripe Checkout session with `client_reference_id = booking.id` and metadata including `booking_id` and `booking_revision`.
   - Persist `stripe_session_id`.
   - Move booking to `awaiting_payment`.
   - Respond with `{ checkout_url }`.
2. Client redirects to Stripe Checkout.
3. Stripe webhook (signature-verified, `booking_revision` match) sets `paid` (see [SECURITY.md](./SECURITY.md) §5).

If the admin edits the booking pre-payment, the previous token and Stripe session are invalidated and a new completion email is sent (see [STATES.md](./STATES.md) §5.2 and [SECURITY.md](./SECURITY.md) §6).

## 10. Reassuring tone of voice (cheat sheet)

- "Hai aperto questo link dalla nostra email…" instead of "Token verified, please proceed."
- "Conferma i dati della prenotazione qui sotto. Se qualcosa non torna, scrivici a `{venue_contact_email}` e li aggiorniamo noi: ti rimanderemo un nuovo link." instead of "Please re-enter your data."
- "Non riusciamo a trovare la tua prenotazione, il link potrebbe essere scaduto." for expired tokens.
- Italian, `Europe/Rome` for date/time, `it-IT` for currency.

## 11. Implementation notes for future development

- The page must work on mobile (the most likely device for clicking an email link). Mobile layout is the default; desktop is a wider container, not a different page.
- No third-party analytics on this page in V1 (no Google Analytics, no Hotjar). Server-side audit logging only.
- `Referrer-Policy: no-referrer` for this route (token in URL).
- The page sets `<meta name="robots" content="noindex,nofollow">`.
- No autocomplete that leaks fiscal data into the browser's saved-forms beyond what is strictly useful (rely on the browser's defaults; do not turn off autocomplete on common fields).
- All copy lives in a single Italian locale file to enable future translation without code changes.
- Document version constants (`TERMS_VERSION`, `PRIVACY_VERSION`) live in a shared constants module; bumping a version invalidates nothing automatically — it only changes what future submissions record. Past consent records are untouched.

## 12. Related documents

- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) — overall flow placement.
- [STATES.md](./STATES.md) — transitions invoked by this page.
- [DB_SCHEMA.md](./DB_SCHEMA.md) — `bookings`, `fiscal_profiles`, consent persistence.
- [SECURITY.md](./SECURITY.md) — token, consent metadata, webhook revision check.
- [EMAILS.md](./EMAILS.md) — the email that delivers the link to this page.
- [TASK_PLAN.md](./TASK_PLAN.md) — phase ordering and the explicit dependency on `reference/oldPage/`.
