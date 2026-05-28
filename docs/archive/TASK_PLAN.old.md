# Cooker Loft V1 — Task Plan

- **Purpose**: define the phased build order, the dependencies between phases, and the acceptance criteria for each phase. This is the implementation roadmap V1 follows after documentation is approved.
- **Scope**: planning-only. This file does not contain code.
- **Out of scope**: V2 work (see [NON_GOALS.md](./NON_GOALS.md) for what is deferred).
- **Owner**: Cooker Loft technical lead.
- **Last updated**: 2026-05-20.

---

## 1. Principles

- **Documentation-first**: this docs/ folder is the source of truth and is treated as a deliverable in its own right.
- **Vertical slices**: each phase ships an end-to-end working slice that can be demoed, not a horizontal layer.
- **State machine first**: the booking state machine is implemented and tested **before** any UI that triggers transitions.
- **Server-only secrets**: every phase adds Vercel env vars to the documented inventory; nothing public-side until reviewed.
- **CI green**: a phase is done only when CI is green (typecheck, lint, unit tests; e2e where applicable).
- **No `paid` outside webhook**: review checklist on every PR confirms no code path violates this rule.
- **External references are dependencies**: phases that depend on `reference/oldPage/` (completion page) or `reference/xml/fattura reference.xml` (XML module) **must not start** until the referenced files exist and have been analyzed. See Phases 5 and 7.

## 2. Repo conventions (to be set up in Phase 0)

- Package manager: pnpm (locked at the chosen Node LTS version on Vercel).
- Code style: ESLint + Prettier with shared config; strict TypeScript.
- Folder layout (working names):
  - `app/` — Next.js App Router routes.
  - `src/server/` — server-only utilities (Supabase server client, Stripe client, Resend client, state machine).
  - `src/modules/booking-state/` — the booking state machine.
  - `src/modules/xml-export/` — isolated XML module.
  - `src/schemas/` — zod schemas shared client/server.
  - `src/lib/` — generic utilities.
  - `src/components/ui/` — shadcn primitives.
  - `src/components/` — feature components.
  - `emails/` — React Email templates.
  - `supabase/migrations/` — SQL migrations.
  - `tests/` — unit + integration tests.
  - `e2e/` — Playwright end-to-end tests.
- Commit hygiene: conventional commits.
- Branch protection on `main`: PR review + green CI required.

## 3. Phases

The phases are sequential by default; some pairs can run in parallel if more than one engineer is available (noted inline).

---

### Phase 0 — Repo & environment bootstrap

- Initialize the Next.js + TypeScript project, Tailwind, shadcn/ui, ESLint, Prettier.
- Configure Supabase project (DB + Auth + Storage bucket `xml-exports`).
- Configure Vercel project, environment variables (server-only secrets per [SECURITY.md](./SECURITY.md) §7).
- Configure Resend domain (DKIM, SPF, DMARC).
- Configure Stripe account (test mode keys, webhook endpoint placeholder).
- Set up CI: typecheck, lint, test, build, preview deploys.
- Add this `docs/` folder as the canonical reference.

**Acceptance criteria**:

- Empty Next.js app deploys to Vercel.
- All required env vars exist on Vercel and locally (`.env.example` complete).
- Supabase project reachable from the server only.
- CI runs and is green on a no-op PR.

**Dependencies**: none.

---

### Phase 1 — Database schema & RLS

- Write the initial SQL migration implementing every table in [DB_SCHEMA.md](./DB_SCHEMA.md), including the consent columns on `booking_requests`, `bookings.revision`/`origin`/consents-jsonb/`cancelled_after_payment_*`/`review_email_sent_at`, and `events.vat_rate_bps`.
- Implement triggers: `set_updated_at`, `prevent_paid_edits` (now also blocks edits to `revision`), `prevent_fiscal_edits_after_paid`, `prevent_revision_decrement`, `enforce_operational_cancel_invariants`.
- Enable RLS on every table; install policies per [DB_SCHEMA.md](./DB_SCHEMA.md) §4.
- Seed the `app_settings` single row with placeholder values (`accountant_email`, `review_url = NULL`, `review_email_enabled = true`, `terms_version`, `privacy_version`, `health_consent_version`, `image_use_consent_version`, `clauses_1341_1342_version`).

**Acceptance criteria**:

- Migration applies cleanly to a fresh Supabase project.
- Direct anon-client queries return no rows from any table (manual smoke test).
- Service-role queries return expected rows.
- `CHECK` constraints reject invalid status transitions (manual SQL).
- `CHECK` constraints reject `booking_requests` inserts with any `consent_*_accepted = false`.
- `prevent_paid_edits` blocks updates to `amount_cents`, `people`, and `revision` on a `paid` booking.
- `prevent_revision_decrement` rejects a `revision` update that does not strictly increase the value.
- `enforce_operational_cancel_invariants` rejects inconsistent `cancelled_after_payment_*` combinations and any operational cancel on a non-paid booking.

**Dependencies**: Phase 0.

---

### Phase 2 — Auth & admin shell

- Build the admin login page (Supabase Auth, email + password).
- Build the admin layout (sidebar, top bar, shadcn primitives, dark/light aware).
- Implement middleware: any `/admin/*` route requires a Supabase session **and** an `admin_users` row.
- Implement a minimal `/admin/dashboard` empty state.
- Provide a CLI/admin-only "invite admin" mechanism (initially manual SQL insert; UI deferred to Phase 8 hardening).

**Acceptance criteria**:

- Unauthenticated access to `/admin/*` redirects to `/admin/login`.
- Successful login lands on `/admin/dashboard`.
- Logout works and revokes the session.
- A signed-in Supabase user without an `admin_users` row is treated as unauthenticated.

**Dependencies**: Phase 1.

---

### Phase 3 — Events CRUD & public embed

**Lifecycle rules (V1)** — see [STATES.md](./STATES.md) §12 for the full state machine:

- Events are created in `status = draft` by default. The form also offers "Pubblica subito" which goes straight to `published`.
- **Edits are allowed only while `draft`.** Once `published`, the event is immutable: the state machine rejects any `updateEvent(...)` call and the admin UI hides the "Modifica" affordance. To change anything on a published event, the team must archive it and create a new one.
- `/embed/[slug]` returns 404 for events that are not `published`.

- Admin UI: create, list, edit (draft-only), archive events. Fields per [DB_SCHEMA.md](./DB_SCHEMA.md) §3.2.
- Slug uniqueness validated client + server.
- For each event, generate:
  - The public embed URL (`/embed/[slug]`).
  - An "Embed code" snippet (iframe HTML) the admin can copy.
- Implement `/embed/[slug]` as a public, read-only Next.js route. Server-rendered, no secrets. Loads via service-role server fetch and returns only the safe public projection.
- The page is iframe-friendly: `Content-Security-Policy: frame-ancestors <wordpress origin>`.

**Acceptance criteria**:

- An admin can create an event in <1 minute, get a working embed URL, and paste the iframe code into a test WordPress page that renders correctly.
- A draft event can be edited freely; the admin UI exposes a clear "Pubblica" affordance.
- A published event cannot be edited from the UI or via API; attempting `updateEvent(...)` against a non-draft event throws.
- Editing a draft event preserves history (audit log).
- Closed/archived events do not appear on the embed page.
- Lighthouse pass on `/embed/[slug]` for performance and accessibility basics.

**Dependencies**: Phase 2.

**Parallelism**: Phases 3 and 4 can be partially parallelized — the request intake API in Phase 4 depends on the schema (already done in Phase 1) but not on the events UI.

---

### Phase 4 — Request intake & admin review

- Build the public form on `/embed/[slug]`. Fields:
  - **first name** (required)
  - **last name** (required)
  - **email** (required, format-validated)
  - **phone** (required)
  - **people count** (required, integer ≥ 1, capped at event capacity)
  - **dietary notes / allergies / intolerances / food needs** (optional free text for the whole group)
  - **special occasion** (optional free text)
  - **notes** (optional free text)
  - **Consent A — Terms** (checkbox, required): "Dichiaro di aver letto e accettato i termini e le condizioni relativi alla richiesta di prenotazione / prenotazione evento."
  - **Consent B — Privacy** (checkbox, required): "Dichiaro di aver letto l'informativa privacy relativa all'iscrizione all'evento / richiesta di prenotazione."
  - **Consent C — Explicit health-data** (checkbox, required, GDPR art. 9.2.a): "Esprimo il mio consenso esplicito al trattamento dei dati relativi alla salute da me eventualmente forniti, come allergie/intolleranze, per le finalità indicate nell'informativa."
  - **event** is implicit from the slug; no event picker on the public form.
- Each consent label includes inline links to the relevant document (terms, privacy notice). The full texts are the same as on the completion page (see [COMPLETION_PAGE_REFERENCE.md](./COMPLETION_PAGE_REFERENCE.md)), but the embed shows compact summaries and the document version constants are read from `app_settings`.
- Implement `POST /api/requests` (server route): zod validation matching the schema above, rate limit, captures IP/UA server-side, inserts `booking_requests` row with the three consent triplets `{accepted, accepted_at, version}` populated server-side. Reject the submission if any consent is missing or `false`.
- Admin UI:
  - Prenotazioni list grouped by event. The UI exposes only the six visible statuses defined in [STATES.md](./STATES.md) §0 (`richiesta ricevuta`, `in lista d'attesa`, `in attesa di pagamento`, `pagata`, `rifiutata`, `pagata · cancellata`). Filtering is offered against this six-status surface only.
  - **Rejected requests remain visible** in the list and filter. Cancelled / expired / void records are folded into a hidden `deleted` bucket (see [STATES.md](./STATES.md) §0): they remain in the database for audit but never appear in any operational list. The team-facing way to "delete" a non-paid prenotazione is the unified **Elimina prenotazione** action at the bottom of the detail page.
  - Per-request actions: accept (no reason), reject (reason required + optional "share with requester" flag), waitlist (no reason), accept-from-waitlist (no reason), cancel-waitlist (reason optional), **edit pending request** (people / dietary / occasion in place; no email; audit log with field-level diff).
- Implement state machine entry points: `acceptRequest`, `rejectRequest(reason)`, `waitlistRequest`, `acceptFromWaitlist`, `editPendingRequest(patch)`, and the unified `deletePrenotazione(requestId, actor)` (which internally fans out to `cancelRequest` / `cancelWaitlistedRequest` / `voidBooking` depending on the underlying state). Audit log on every transition. The `editPendingRequest` entry point does **not** count as a status transition (`status` stays `pending`); see [STATES.md](./STATES.md) §5.3.
- On `accept` (from `pending` or from `waitlisted`), create the `bookings` row with `revision = 1`, set `origin = 'direct'` or `'waitlist'` accordingly, generate the completion token (random 32B), persist `completion_token_hash` and metadata, set `completion_deadline_at`, set `completion_token_issued_at`, and **copy** `dietary_notes` and `special_occasion` from the request to the booking as the initial confirmed values. **Email side effects (E2/E3/E4/E5) are wired in Phase 5**; in Phase 4 the state machine emits the side-effect commands but the email sender is mocked.

**Acceptance criteria**:

- A guest can submit a request from a WordPress test page; it appears in the admin under the correct event within seconds.
- The submitted row has all the data fields populated and **three consent records** stamped with server timestamps, IP, UA, and document versions.
- The form refuses to submit (client) and `POST /api/requests` refuses to insert (server + DB CHECK) if any of the three consent checkboxes is unchecked.
- Admin can accept (no reason), reject (reason required — kept strictly internal; never shared with the requester), waitlist (no reason), accept from waitlist (no reason — but the admin UI gates the action behind an explicit confirmation dialog), and edit a pending request in place (people / dietary / occasion). On any non-paid prenotazione the team can also invoke the unified **Elimina prenotazione** action, which terminates the underlying record and hides it from the dashboard.
- **Rejected prenotazioni stay listed** in the admin dashboard under the event and are filterable. Cancelled / expired / void records are hidden from all UI lists and reachable only through the audit log. A nightly cron transitions any `pending` or `waitlisted` request whose event date has passed to `expired` (see [STATES.md](./STATES.md) §3); from the team's point of view those simply disappear from the dashboard.
- Direct acceptance and waitlist-acceptance both create exactly one `bookings` row with `revision = 1`, the correct `origin`, a hashed token (verified via direct DB inspection), and copy dietary + special-occasion fields onto the booking.
- All transitions write an `audit_log` row.
- Reject and waitlist do not create a `bookings` row.

**Dependencies**: Phase 3.

---

### Phase 5 — Transactional emails & completion page

**Pre-read (mandatory before any code in this phase)**:

- [docs/COMPLETION_PAGE_REFERENCE.md](./COMPLETION_PAGE_REFERENCE.md) — full UX, sections, validation, reuse rules.
- `reference/oldPage/indicazioni.txt`, `reference/oldPage/legalContent.ts`, `reference/oldPage/privacyContent.ts` — the UX reference and the canonical legal/privacy copy.

If `reference/oldPage/` is missing at the start of this phase, **stop**. The completion page cannot be implemented without it. Surface the missing dependency to the venue and pause.

Tasks:

- Integrate Resend (server-only).
- Implement React Email templates:
  - E1 (request received, optional — off by default).
  - E2 (acceptance + completion link, REQUIRED). Renders in `initial` and `amendment` modes.
  - E3 (request rejected, REQUIRED).
  - E4 (request waitlisted, REQUIRED).
  - E5 (accepted from waitlist + completion link, REQUIRED). Renders in `initial` and `amendment` modes.
  - E6 (payment confirmation, REQUIRED — used in Phase 6).
- Wire state-machine side effects to the real sender:
  - `pending → accepted` sends E2 in `initial` mode.
  - `pending → rejected` sends E3 with a fixed body. `decision_reason` is stored for audit/internal use only and is never injected into E3.
  - `pending → waitlisted` sends E4.
  - `waitlisted → accepted` sends E5 in `initial` mode.
- Build `/complete/[token]`: token lookup (hash compare), expiration check, single-use check, renders the completion form per [COMPLETION_PAGE_REFERENCE.md](./COMPLETION_PAGE_REFERENCE.md). Sections, accordion, consensi block, image-use radio, minor flow all match the reference.
- The completion form is a **confirm-only** step for request data and an **extend** step for new data. People, dietary notes, and special occasion are **displayed read-only** from the `bookings` row; the representative cannot edit them on this page. If the data is wrong, the team uses `editPendingRequest` (before acceptance) or `editBookingPrePayment` (after acceptance) from the admin and the system re-sends the completion link. Fiscal profile, legal/privacy/health/clauses checkboxes, image-use radio, and the optional minor-flow declaration are collected on this page for the first time.
- All UI labels that display a price include "IVA inclusa".
- Implement `POST /api/complete/[token]/submit`: zod validation, idempotent transition `awaiting_completion → awaiting_payment`. Persists fiscal profile, writes `bookings.consents` (jsonb) atomically with the scalar rollups (`legal_accepted_at`, `privacy_accepted_at`, `health_consent_accepted_at`, `image_use_choice`); stamps server-captured IP/UA; stores document versions.
- Server-side amount computation (`events.price_cents * bookings.people`) in this submit handler; **Stripe session not yet created** (Phase 6).
- No-PII logging; `Referrer-Policy: no-referrer` on completion route.
- **Pre-payment admin edit flow (`editBookingPrePayment`)**:
  - Admin UI on the booking detail page exposes editable fields (people, dietary notes, special occasion) only while the booking is `awaiting_completion` or `awaiting_payment` and not paid.
  - Server entry point increments `bookings.revision`, rotates the completion token, expires any Stripe Checkout session (best-effort; integration with Stripe is fully wired in Phase 6), transitions the booking back to `awaiting_completion` if needed, and queues the amend variant of E2 / E5 (chosen by `bookings.origin`).
  - The old completion URL returns 410 immediately.
  - All steps audit-logged with `from_revision` / `to_revision` and a field-level diff.
- **Cancel pre-payment (no edit)**: admin action `voidBooking` transitions an unpaid booking to `void` (no email in V1; the representative is informed out-of-band).

**Acceptance criteria**:

- Direct acceptance produces an E2 (`initial`) email delivered to the requester within seconds (validated against Resend dashboard).
- Reject and waitlist actions produce E3 and E4 respectively, with correct copy and no completion link.
- Accept-from-waitlist produces E5 (`initial`) with a working completion link landing on the same `/complete/[token]` page as E2.
- Completion page UX matches the structure documented in `COMPLETION_PAGE_REFERENCE.md` (manual UX review against the reference).
- All UI surfaces that display a price include the "IVA inclusa" qualifier.
- Completion page pre-fills people, dietary notes, special occasion from the request data.
- Completion page rejects malformed, expired, used, **rotated** tokens with HTTP 410 (generic message).
- Completion form persists data and transitions the booking to `awaiting_payment` (verified via DB); `bookings.consents` contains all five sub-objects with versions and server-captured IP/UA.
- Re-submitting the completion form for the same booking returns 409.
- `editBookingPrePayment` on an `awaiting_completion` booking increments `revision`, rotates the token, and triggers an amend-mode email (E2 or E5 per `origin`). The previous URL returns 410.
- `editBookingPrePayment` on an `awaiting_payment` booking additionally transitions the booking back to `awaiting_completion`. (Stripe `sessions.expire` integration lands in Phase 6; in Phase 5 the call is wired but failure is tolerated.)
- Rate limits hold under a small abuse test.

**Dependencies**: Phase 4, and the presence of `reference/oldPage/`.

---

### Phase 6 — Stripe Checkout & webhook

- Integrate Stripe SDK (server-only).
- On completion submit, after persisting fiscal data, create a Stripe Checkout session with: server-computed **gross** amount (IVA inclusa), line item description that includes the "IVA inclusa" qualifier, `client_reference_id = booking.id`, **`metadata = { booking_id, booking_revision }`**, success/cancel URLs, idempotency key derived from booking id + revision.
- Redirect the representative to the Stripe-hosted Checkout page.
- Implement `POST /api/stripe/webhook` on Node runtime:
  - Reads raw body.
  - Verifies signature against `STRIPE_WEBHOOK_SECRET`.
  - Enforces timestamp tolerance.
  - Inserts into `payments` with unique `stripe_event_id` (idempotency gate).
  - **Reads `metadata.booking_revision` from the event and compares to `bookings.revision`. On mismatch: writes `payments.status = 'ignored'`, audit log, responds 200, no state change.**
  - Compares Stripe event amount to `bookings.amount_cents`. If mismatch, logs a security anomaly and **does not** mark `paid`.
  - On match, calls `markPaidFromWebhook` in the state machine.
  - On `paid` transition, sends **E6** (payment confirmation).
- Wire the `editBookingPrePayment` integration with Stripe: when the edit triggers on `awaiting_payment`, the state-machine side effect calls `stripe.checkout.sessions.expire(stripe_session_id)`. Failure is logged and tolerated (revision check is the authoritative defense).
- Build a `/complete/[token]/status` post-checkout page that handles success/cancel return URLs; it polls or subscribes to the booking status, **but does not itself mark the booking paid**.

**Acceptance criteria**:

- Successful Stripe test payment moves the booking to `paid` and sends E6 exactly once.
- Replaying the same `stripe_event_id` produces no duplicate side effects.
- Webhook returns 400 for invalid signatures and 200 for duplicates without side effects.
- An attempted amount mismatch (simulated) is logged and does **not** mark `paid`.
- A webhook arriving with `metadata.booking_revision` lower than current `bookings.revision` is recorded as `payments.status = 'ignored'` with an `audit_log` row tagged `webhook_revision_mismatch`; the booking does not change status.
- After `editBookingPrePayment` on an `awaiting_payment` booking, the previous Stripe Checkout session is expired (verified via Stripe dashboard / test API). Even if the user manages to pay it before expiry, the resulting webhook is rejected by the revision check.
- The frontend at the success URL never has the power to mark the booking `paid` (verified by inspecting code; no client-side mutation hits `bookings.status`).

**Dependencies**: Phase 5.

---

### Phase 7 — XML module & accountant export

**Hard pre-requisite** (must be true before any code is written in this phase):

- `reference/xml/fattura reference.xml` exists and has been analyzed, **or** the accountant has confirmed an alternative target structure in writing.
- The accountant has confirmed (in writing) the V1 working defaults: `FormatoTrasmissione = FPR12`, `TipoDocumento = TD01`, `RegimeFiscale = RF01`, `AliquotaIVA = 22.00`, rounding rule for the imponibile/imposta split, `ModalitaPagamento`, `ProgressivoInvio` policy, B2C `CodiceDestinatario` policy. Open questions listed in [XML_EXPORT.md](./XML_EXPORT.md) §5 are answered.

If either condition is unmet at the start of this phase, **stop**. Surface the missing input to the venue and pause. Do not implement against guesses.

Tasks:

- Implement `src/modules/xml-export/` per [XML_EXPORT.md](./XML_EXPORT.md): pure functions, zod-validated inputs, deterministic outputs. Includes the **gross→imponibile+imposta** breakdown (banker's rounding by default, swappable to round-half-away-from-zero via constant), with an invariant assert that `Imposta + Imponibile == Gross`.
- Vendor identity constants populated from `app_settings` to match the reference sample (Anidra S.r.l. / VAT 04049550041 / RF01 / sede legale / IscrizioneREA where applicable).
- Implement `runXmlExport(period)` calling layer: loads paid bookings + fiscal profiles + per-event `vat_rate_bps`, calls the module, zips outputs, uploads to Supabase Storage, writes `xml_exports` + `xml_export_items`, sends **E7** email with attachment.
- Manifest (`manifest.csv` and `manifest.json`) includes a column `operationallyCancelled` (boolean) for bookings with `cancelled_after_payment_at` set in the period — by default they are still included in the export, flagged for accountant attention (see [XML_EXPORT.md](./XML_EXPORT.md) §5.2).
- Admin UI on the export run preview lets the admin **exclude** specific operationally-cancelled bookings before generation. Excluded bookings get an audit-log entry; they are not in `xml_export_items`.
- Implement Vercel Cron for the **scheduled monthly export** (1st of every calendar month at 03:00 `Europe/Rome`, previous month bookings; see [XML_EXPORT.md](./XML_EXPORT.md) §8.3).
- Admin UI: "Esportazione fiscale" page exposing three modes (see [XML_EXPORT.md](./XML_EXPORT.md) §8):
  - **Invio automatico mensile** — read-only status panel (next run, included period preview, on/off toggle wired to `app_settings.xml_export_cron_enabled`).
  - **Export manuale per periodo** — date-range picker, preview, generate-and-send.
  - **Export manuale per selezione** — paginated table of paid bookings with checkboxes (filterable by event, kind, dates), bulk action "Invia al commercialista". Bookings already included in a prior export are visible and explicitly disabled.
  - Past exports list with download + resend actions.
- Persist the accountant disclaimer text on the email and the admin UI.

**Acceptance criteria**:

- A manual export on a fixture set of paid bookings produces N XML files + manifest matching the documented filename convention. XML structure matches `reference/xml/fattura reference.xml` schema (validated by xmllint or equivalent against the FatturaPA XSD if available).
- For every produced XML, `Imposta + Imponibile == ImportoTotaleDocumento` exactly (no off-by-one cent).
- A unit-test fixture covering at least 10 (gross, vat_rate) pairs produces the expected (imponibile, imposta) split as agreed with the accountant.
- The accountant email (E7) is delivered with the zip attached (validated against Resend dashboard).
- Re-running the same period does not re-include already-exported bookings.
- A paid + operationally-cancelled booking in the period appears in the manifest with `operationallyCancelled = true` and (by default) is included in `xml_export_items`. The admin "exclude" override removes it cleanly with an audit-log entry.
- The XML module imports nothing from `app/`, `src/components/`, or any HTTP/DB client.
- The accountant disclaimer is visible on the trigger screen and present in E7 body.

**Dependencies**: Phase 6, plus the hard pre-requisite above.

---

### Phase 7b — Post-event review email & paid-cancellation marker

- Implement the `markPaidBookingOperationallyCancelled` state machine entry point (see [STATES.md](./STATES.md) §6). **No reversal entry point in V1**: once set, the marker is definitive.
- Admin UI on the paid-booking detail page: "Annulla prenotazione (post-pagamento)" action with required reason. Surfaces a "Cancellata dopo pagamento" badge on the booking. The action is fully internal: no Stripe call, no XML touch, no E-mail to the requester.
- Implement `sendReviewRequestEmail(bookingId)` and the daily Vercel Cron job that selects eligible bookings (see [STATES.md](./STATES.md) §7 and [EMAILS.md](./EMAILS.md) §E9). Job uses partial index on `bookings` for efficiency.
- Implement E9 React Email template per [EMAILS.md](./EMAILS.md) §E9.
- Admin UI on `app_settings`: editable `review_url`, `review_email_enabled` toggle. Saving validates the URL format.
- Admin action on a paid booking: "Forza invio E9 ora" (manual override) for support cases. Audit-logged; respects `cancelled_after_payment_at` and `review_email_enabled`.

**Acceptance criteria**:

- Marking a paid booking as operationally cancelled sets the three marker columns, leaves `status = 'paid'`, and is visible as a badge. No money movement, no fiscal artefact.
- The daily cron, run with `app_settings.review_url` set and `review_email_enabled = true`, sends E9 exactly once per eligible booking and stamps `review_email_sent_at`. Re-running the cron on the same day is a no-op.
- The cron skips bookings with `cancelled_after_payment_at` set.
- The cron skips all sends and logs a single warning when `review_url` is null or `review_email_enabled = false`.
- Marking a paid booking as operationally cancelled is **definitive in V1**: the dashboard does not expose any "undo" affordance and the state machine does not provide a reversal entry point.

**Dependencies**: Phase 7.

---

### Phase 8 — Hardening, e2e, deploy

- E2E tests with Playwright covering: admin login, event create, embed submit (with the three consent checkboxes), admin accept, completion + payment (Stripe test mode), webhook-driven `paid`, **pre-payment admin edit + revision rotation + obsolete-webhook rejection**, **operational paid cancellation**, **E9 review email cron**, XML export (including a paid + operationally-cancelled booking in the period).
- Load-light stress on public form + completion routes.
- Manual QA per [TEST_PLAN.md](./TEST_PLAN.md).
- Accessibility pass (axe, keyboard nav, focus rings) on the embed form and the completion page.
- Lighthouse pass on public pages.
- Final security checklist ([SECURITY.md](./SECURITY.md)).
- Final deliverability checklist ([EMAILS.md](./EMAILS.md)).
- Production cutover: domain, DNS, env vars, Stripe live keys, webhook endpoint, Resend domain verified, Supabase production project, Vercel Cron schedules (XML export + E9 review email).
- Admin-management UI (invite, list, deactivate admins) added in this phase if time allows; otherwise tracked as fast-follow.

**Acceptance criteria**:

- All checklists in [SECURITY.md](./SECURITY.md) and [EMAILS.md](./EMAILS.md) signed off.
- E2E suite green on the staging environment and on production smoke.
- Real Stripe payment in live mode (small amount) confirms the full flow end-to-end.
- A test booking exercised through pre-payment edit shows: old link 410, old Stripe session expired, new amend-mode email delivered, paid only via the new session.
- Operational paid cancellation of a test booking: status remains `paid`, badge visible, E9 cron skips it on the next day.
- Accountant receives a real (test) XML export, confirms format.
- Vercel production deployment is the canonical URL; preview deployments use a separate Stripe key set.

**Dependencies**: Phase 7b.

---

## 4. Cross-phase responsibilities

- **State machine**: extended in every phase that adds transitions. No transition lives outside `src/modules/booking-state/`. New entry points added in V1: `editPendingRequest`, `deletePrenotazione` (unified destructive action fanning out to `cancelRequest` / `cancelWaitlistedRequest` / `voidBooking`), `editBookingPrePayment`, `markPaidBookingOperationallyCancelled`, `sendReviewRequestEmail`, plus the event-side `createEvent` / `updateEvent` (draft-only) / `publishEvent`.
- **Revision discipline**: any code that creates a Stripe session must include `metadata.booking_revision`. Any code that processes a webhook must check it. Any code that mutates a pre-payment booking field other than purely cosmetic flags must go through `editBookingPrePayment` (which rotates the revision and token).
- **Consent discipline**: any code that inserts a `booking_requests` row or writes `bookings.consents` is server-only and stamps IP/UA/document-version server-side.
- **Audit log**: every PR that adds a transition or admin action must add the corresponding audit-log call. New audit actions in V1: `booking.edited_pre_payment`, `booking.token_rotated`, `booking.stripe_session_expired`, `booking.cancelled_after_payment`, `booking.cancellation_cleared`, `email.review_request_sent`, `webhook.revision_mismatch_ignored`.
- **Docs sync**: any change in schema, state, security rules, email inventory, or XML mapping requires an update to the corresponding doc in the same PR.

## 5. Risk register

| Risk                                              | Mitigation                                                                                  |
|---------------------------------------------------|---------------------------------------------------------------------------------------------|
| Fiscal schema interpretation diverges from accountant's expectations | Lock the schema choice with the accountant **before** Phase 7 starts; keep the module parameterized; gate the phase on `reference/xml/fattura reference.xml`. |
| Imponibile/imposta rounding diverges from accountant convention | Unit-test fixture validated by accountant before Phase 7 ships; rounding rule is a constant. |
| Stripe webhook misconfigured in production         | Document the webhook setup; smoke-test with Stripe CLI; alert on webhook 4xx/5xx rate.      |
| Obsolete Stripe session pays after admin edit      | `metadata.booking_revision` check on every webhook; old session also expired best-effort.   |
| Completion page UX drifts from agreed reference     | `reference/oldPage/` is a hard pre-read in Phase 5; manual UX review against it in Phase 8. |
| Consent capture incomplete or tampered             | DB CHECK on `booking_requests.consent_*_accepted = true`; server-side IP/UA stamp; document-version sourced from `app_settings`. |
| Resend deliverability problems (spam folder)       | DKIM/SPF/DMARC configured; pre-launch Mail Tester; warm-up sends.                            |
| Review email sent to an operationally-cancelled booking | Cron query excludes `cancelled_after_payment_at IS NOT NULL`; manual override audit-logged. |
| Review email sent more than once                   | `review_email_sent_at` unique-by-presence; idempotency key `review_request:{booking.id}`.   |
| WordPress iframe blocked by CSP/X-Frame-Options    | Document required CSP/X-Frame headers; provide a verified iframe snippet.                    |
| Slug collisions or non-URL-safe slugs               | Server-side slug normalization + uniqueness constraint.                                      |
| RLS misconfiguration leaking data                  | RLS smoke tests in CI (anon client returns 0 rows from every operational table).             |
| Token leakage via logs                              | Log scrubbing rules; no path logging on `/complete/*`; tests asserting the absence of tokens in error pages. |
| Cron run overlap (XML export, review email)        | `xml_exports.status = 'generating'` acts as a lock; review-email cron uses a per-booking advisory lock and `review_email_sent_at` as a definitive guard. |

## 6. Done definition (V1)

V1 is "done" when:

- All phases (0–7, 7b, 8) meet their acceptance criteria.
- The production environment is live, with the venue's real Stripe and Resend accounts.
- The accountant has confirmed receipt of at least one real XML export and validated the format and the imponibile/imposta breakdown.
- The venue's first real event has been booked, paid, and exported end-to-end. At least one post-event review email (E9) has been sent and observed in inbox.
- Documentation in `docs/` matches the deployed system.

## 7. Related documents

- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md)
- [STATES.md](./STATES.md)
- [DB_SCHEMA.md](./DB_SCHEMA.md)
- [EMAILS.md](./EMAILS.md)
- [SECURITY.md](./SECURITY.md)
- [XML_EXPORT.md](./XML_EXPORT.md)
- [COMPLETION_PAGE_REFERENCE.md](./COMPLETION_PAGE_REFERENCE.md)
- [TEST_PLAN.md](./TEST_PLAN.md)
- [NON_GOALS.md](./NON_GOALS.md)
