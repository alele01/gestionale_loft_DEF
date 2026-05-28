# Cooker Loft V1 — Transactional Email

- **Purpose**: define every email V1 sends, the trigger, the template, the variables, idempotency, retry, and deliverability requirements.
- **Scope**: transactional emails sent from the application via Resend.
- **Out of scope**: drip / reminder campaigns and marketing emails. The single post-event Google review email (**E9**) is in scope; multi-step drip sequences are not (see [NON_GOALS.md](./NON_GOALS.md) §7).
- **Owner**: Cooker Loft technical lead.
- **Last updated**: 2026-05-20.

---

## 1. Provider

- **Provider**: Resend.
- **Templating**: React Email for HTML, plain-text fallback generated from the same component tree.
- **From domain**: a dedicated subdomain such as `mail.cookerloft.example` (final value confirmed at setup).
- **DKIM, SPF, DMARC**: all three configured at the DNS level before go-live. DMARC starts at `p=none` for monitoring, then moves to `p=quarantine` once volume is stable.
- **Sender name**: "Cooker Loft".
- **Reply-To**: a monitored mailbox at the venue (not the system's `from` address).
- **Bounce / complaint handling**: Resend webhooks consumed to update an internal email-status log; addresses with hard bounces are flagged so admins see them in the booking detail UI.

## 2. Inventory

| #  | Email                                       | Trigger                                                                          | Recipient        | Required          |
|----|---------------------------------------------|----------------------------------------------------------------------------------|------------------|-------------------|
| E1 | Request received (optional)                 | New `booking_request` inserted                                                   | Requester        | Optional (off by default) |
| E2 | Request accepted + completion link          | `booking_request` accepted directly (not from waitlist), **or** admin amends a `direct`-origin booking pre-payment | Requester / Rep  | Required          |
| E3 | Request rejected                            | `booking_request` moved to `rejected`                                            | Requester        | Required          |
| E4 | Request waitlisted                          | `booking_request` moved to `waitlisted`                                          | Requester        | Required          |
| E5 | Accepted from waitlist + completion link    | `booking_request` moved from `waitlisted` to `accepted`, **or** admin amends a `waitlist`-origin booking pre-payment | Requester / Rep  | Required          |
| E6 | Payment confirmation                        | Stripe webhook verified, booking marked `paid`                                   | Representative   | Required          |
| E7 | Accountant XML export                       | XML export generated and ready                                                   | Accountant       | Required          |
| E8 | Admin internal notice (optional)            | New request submitted                                                            | Admins           | Optional (off by default) |
| E9 | Google review request (post-event)          | Daily cron, day after a paid + not-operationally-cancelled event                 | Representative   | Required (gated by `app_settings.review_url` and `app_settings.review_email_enabled`) |

**Email amendment variant note**: E2 and E5 each have an "aggiornamento" variant (same template, additional preamble block) used when the admin amends booking data pre-payment via `editBookingPrePayment` (see [STATES.md](./STATES.md) §5.2). The variant is driven by a `mode` flag passed at render time (`'initial' | 'amendment'`); it does **not** introduce a new email id. The completion URL embedded in the amend variant carries the **rotated** token.

V1 explicitly **does not** send: drip "you have not completed yet" reminders, T-7d / T-1d reminders, marketing emails. See [NON_GOALS.md](./NON_GOALS.md) §7.

## 3. Common rules

- All emails are sent from server-only code, never from the browser.
- Every send carries a Resend idempotency key derived from the entity and event, so retries do not duplicate.
- Every send is recorded in a lightweight `email_log` (or as an entry in `audit_log` with `entity_type = 'email'` — implementation detail confirmed at build time) with: template id, recipient, message id from Resend, sent_at, status.
- Failures do **not** roll back the related booking state transition. The state transition is the source of truth; emails are best-effort with retry.
- Every email has a plain-text version generated from the same source.
- Every email passes link-validation (no unresolved `{{variable}}` placeholders).
- All outbound links are absolute URLs.

## 4. Templates

### E1. Request received (optional)

- **Idempotency key**: `req_received:{request.id}`.
- **Recipient**: `booking_requests.requester_email`.
- **Subject**: `Abbiamo ricevuto la tua richiesta — {event.title}`.
- **Body (summary)**:
  - Confirmation that the request is in review.
  - Event title, date, party size.
  - Explicit note that this is **not** a confirmation; an admin will review.
  - No payment link in this email.
- **Variables**: `requester_first_name`, `event_title`, `event_starts_at_local`, `people`.
- **Decision**: ship with this email **off by default** in V1 to keep noise low; flip on per venue preference via `app_settings.requester_receipt_email_enabled` (admin Impostazioni → "Notifiche email opzionali").

### E2. Request accepted + completion link (REQUIRED)

This is the most important email of V1.

- **Idempotency key**: `req_accepted:{booking.id}:rev{booking.revision}`. Including the revision means a fresh send is issued on every pre-payment edit (the previous send is preserved in `email_log`, but the new send is **not** deduplicated against the old one).
- **Recipient**: `booking_requests.requester_email`.
- **Subject (mode = initial)**: `Richiesta accettata — completa la prenotazione per {event.title}`.
- **Subject (mode = amendment)**: `Prenotazione aggiornata — completa nuovamente per {event.title}`.
- **Body (summary)**:
  - `mode = initial`: friendly acceptance line.
  - `mode = amendment`: short preamble: "Abbiamo aggiornato i dati della tua prenotazione su tua richiesta. Per completare il pagamento utilizza il **nuovo** link qui sotto. Il link precedente non è più valido."
  - Event recap: title, date/time (local timezone), party size, total amount (IVA inclusa).
  - One large primary CTA: "Completa la prenotazione e paga".
  - The completion URL: `https://{APP_HOST}/complete/{token}` (the token is the **current** one after any rotation).
  - Deadline notice: "Il link è valido fino al {completion_deadline_local}.".
  - Footer with venue contact info and a line that links are personal and should not be shared.
- **Variables**:
  - `mode` (`'initial' | 'amendment'`)
  - `requester_first_name`
  - `event_title`, `event_starts_at_local`
  - `people`, `amount_total_eur` (formatted from `bookings.amount_cents`, labeled "IVA inclusa")
  - `completion_url`
  - `completion_deadline_local`
- **Security**: the URL contains the **plaintext** completion token; the token plaintext is **never persisted** in the DB or in the email log. Only the hash is stored (see [SECURITY.md](./SECURITY.md) and [DB_SCHEMA.md](./DB_SCHEMA.md)). On a pre-payment amendment, the **previous token is invalidated server-side** before this email is sent.
- **Selection**: E2 is used only for bookings with `bookings.origin = 'direct'`. For `bookings.origin = 'waitlist'`, the amend variant uses **E5** instead so the wording stays consistent with the original acceptance lineage.
- **Retry**: on send failure, retry up to 3 times with exponential backoff. If all retries fail, mark the booking with a flag and surface in the admin UI so the link can be resent manually.

### E3. Request rejected (REQUIRED)

- **Idempotency key**: `req_rejected:{request.id}`.
- **Recipient**: `booking_requests.requester_email`.
- **Subject**: `Aggiornamento sulla tua richiesta — {event.title}`.
- **Body (summary)**:
  - Polite line stating that the request could not be confirmed for this event.
  - Event recap (title, date, party size) for context.
  - Fixed neutral body in V1. The admin's `audit_log.reason` is **always kept internal** and is never injected into the email. The legacy "condividi motivazione" toggle has been removed from the admin UI; the underlying column (`decision_share_with_requester`) is reserved for future use.
  - Invitation to look at upcoming events on the venue's site, with a link to the venue homepage.
  - Venue contact info for questions.
- **Variables**: `requester_first_name`, `event_title`, `event_starts_at_local`, `people`, `public_reason` (nullable), `venue_home_url`.
- **No CTA to pay**, no completion link, no token. This email is a terminal communication for that request.
- **Retry**: up to 3 attempts.

### E4. Request waitlisted (REQUIRED)

- **Idempotency key**: `req_waitlisted:{request.id}`.
- **Recipient**: `booking_requests.requester_email`.
- **Subject**: `Sei in lista d'attesa per {event.title}`.
- **Body (summary)**:
  - Clear statement: the request has been placed on the waitlist for this event.
  - Explanation: a confirmed seat is not guaranteed; the venue will contact the requester only if a seat opens up.
  - Event recap (title, date, party size).
  - Explicit note that **no payment is required at this stage** and **no booking is confirmed**. Receiving this email is not a confirmation.
  - If/when an admin later accepts from the waitlist, a separate email (E5) will be sent with the completion + payment link.
  - Venue contact info.
- **Variables**: `requester_first_name`, `event_title`, `event_starts_at_local`, `people`, `venue_contact_url`.
- **No completion link, no token** in this email — completion is only emailed at acceptance time (E2 or E5).
- **Retry**: up to 3 attempts.

### E5. Accepted from waitlist + completion link (REQUIRED)

A distinct variant of E2, used when a booking originated from the waitlist (`bookings.origin = 'waitlist'`). Same security properties as E2, different wording so the recipient understands the context (they were waitlisted, now a seat opened up, action is now needed).

- **Idempotency key**: `req_accepted_from_waitlist:{booking.id}:rev{booking.revision}`. As with E2, the revision suffix ensures pre-payment amendments produce a fresh send (the variant `mode = 'amendment'` is rendered with an explicit preamble).
- **Recipient**: `booking_requests.requester_email`.
- **Subject (mode = initial)**: `Buone notizie: posto disponibile per {event.title} — completa la prenotazione`.
- **Subject (mode = amendment)**: `Prenotazione aggiornata — completa nuovamente per {event.title}`.
- **Body (summary)**:
  - `mode = initial`: friendly line: a seat has opened up; the request is now confirmed pending completion and payment.
  - `mode = amendment`: same preamble as the E2 amendment variant.
  - Event recap: title, date/time, party size, total amount (IVA inclusa).
  - One primary CTA: "Completa la prenotazione e paga". Leads to the **same** `/complete/{token}` page used by E2.
  - Deadline notice (the deadline may be tighter than a normal acceptance — copy reflects whichever `completion_deadline_at` was computed).
  - Optional explicit note that the offer may expire if not completed in time, and the seat will be released.
  - Venue contact info; reminder that the link is personal.
- **Variables**: `mode`, `requester_first_name`, `event_title`, `event_starts_at_local`, `people`, `amount_total_eur`, `completion_url`, `completion_deadline_local`.
- **Security**: identical to E2. The plaintext token only appears in this email; the DB stores `sha256(token)` only.
- **Selection**: E5 is used for bookings with `bookings.origin = 'waitlist'`, both for the initial send (acceptance from waitlist) and for any subsequent pre-payment amend variant.
- **Retry**: as E2.

### E6. Payment confirmation (REQUIRED)

- **Idempotency key**: `payment_confirmed:{booking.id}`.
- **Recipient**: `booking_requests.requester_email` (representative) — V1 does not yet store a separate billing email, but the fiscal email (PEC / SDI) is **not** used as a contact channel for this confirmation.
- **Subject**: `Pagamento ricevuto — {event.title}`.
- **Body (summary)**:
  - Confirmation that payment was received.
  - Event recap: title, date/time, party size.
  - Amount paid, currency.
  - A short recap of fiscal data on file (name + city, no full address, no tax code).
  - Note about invoice: "L'amministrazione invierà la fattura secondo i dati fiscali forniti.".
  - Venue contact for changes.
- **Variables**:
  - `requester_first_name`
  - `event_title`, `event_starts_at_local`
  - `people`, `amount_paid_eur`
  - `fiscal_legal_name`, `fiscal_city`
- **Trigger**: called by the Stripe webhook handler **after** the booking has been moved to `paid` in the same logical operation. The webhook handler is idempotent on `stripe_event_id`, so the email cannot be sent twice for the same event.
- **Retry**: as E2.
- **Implementation note (Phase 5)**: implemented as `sendE6PaymentConfirmation` (template at `src/server/email/templates/e6-payment-confirmation.tsx`). Invoked only when `markPaidFromWebhook` returns `alreadyPaid: false` and the booking has a non-null `fiscal_profiles` row; on failure the booking remains `paid` (fail-soft). Stripe automatic receipt is **additionally** active via `payment_intent_data.receipt_email` — the two messages are complementary (Stripe sends the receipt, we send the operational recap).

### E7. Accountant XML export (REQUIRED)

- **Idempotency key**: `xml_export:{xml_export.id}`. Always derived from the export row id, regardless of trigger; the body template branches on `mode` (`'monthly_auto' | 'manual_period' | 'manual_selection'`).
- **Recipient**: `app_settings.accountant_email`.
- **Subject (mode = monthly_auto)**: `Cooker Loft — export automatico fatturazione {period_label}`.
- **Subject (mode = manual_period)**: `Cooker Loft — export fatturazione {period_label}`.
- **Subject (mode = manual_selection)**: `Cooker Loft — export fatturazione (selezione manuale, {bookings_count} prenotazioni)`.
- **Body (summary)**:
  - Opening paragraph:
    - `monthly_auto`: "In allegato l'export automatico delle prenotazioni pagate per il mese di {period_label}, generato il giorno 1 del mese successivo."
    - `manual_period`: "In allegato l'export delle prenotazioni pagate per il periodo {period_start_local} — {period_end_local}, generato manualmente dall'amministrazione."
    - `manual_selection`: "In allegato l'export di una selezione di {bookings_count} prenotazioni pagate, generato manualmente dall'amministrazione."
  - Bullet-style recap: number of bookings, total amount (IVA inclusa), currency, distinct events.
  - A note: "Generato automaticamente dal gestionale Cooker Loft. La correttezza fiscale dei contenuti è soggetta a validazione da parte del commercialista." (see [XML_EXPORT.md](./XML_EXPORT.md)).
  - Optional CTA to open the export in the admin (admin URL).
- **Attachments**:
  - A single `.zip` containing the per-booking XML files and a `manifest.csv` index.
  - The zip is regenerated from `xml_exports.storage_path` at send time (or attached on first send and not re-attached on retry).
- **Variables**: `mode`, `period_label`, `period_start_local`, `period_end_local`, `bookings_count`, `total_amount_eur`, `admin_export_url`.
- **Retry**: up to 5 attempts (this is the most important email for the venue's compliance posture). If all retries fail, the `xml_exports.status` is set to `failed` and the admin UI surfaces a banner.

### E8. Admin internal notice (optional)

- **Idempotency key**: `admin_new_request:{request.id}:{admin_user.id}`.
- **Recipient**: each admin's email.
- **Subject**: `Nuova richiesta — {event.title}`.
- **Body**: requester name, party size, link to the admin review page.
- **Decision**: ship **off** by default; admins use the dashboard. Flip on via `app_settings.admin_new_request_email_enabled` (admin Impostazioni → "Notifiche email opzionali"). When on, the sender fans out across every `admin_users` row; idempotency key `admin_new_request:{request.id}:{admin_user.id}` keeps fan-outs deduplicated per admin.

### E9. Google review request (post-event) (REQUIRED, gated)

A single transactional email sent the day after the event, asking the representative to leave a Google review. This is **not** a marketing email; it is operational, one-shot per booking, and gated by application settings.

- **Idempotency key**: `review_request:{booking.id}`.
- **Recipient**: `booking_requests.requester_email` (the representative who paid).
- **Subject**: `Grazie per averci scelti — lasciaci una recensione su Google`.
- **Body (summary)**:
  - Friendly greeting addressed to the representative by first name.
  - Short thank-you for participating in the event.
  - One primary CTA: "Lascia una recensione su Google" → `{review_url}`.
  - Soft note: "Se hai avuto un problema, rispondi pure a questa email: ti ascoltiamo prima di lasciare una recensione." (reply-to is the monitored venue mailbox).
  - Venue contact info.
  - No unsubscribe link is required because this is a one-shot transactional email tied to a specific paid booking; a `List-Unsubscribe: <mailto:>` header is still added for inbox hygiene.
- **Variables**:
  - `requester_first_name`
  - `event_title`, `event_starts_at_local`
  - `review_url` (= `app_settings.review_url`)
  - `venue_reply_email`
- **Trigger**: daily Vercel Cron (typically 10:00 `Europe/Rome`) calls `sendReviewRequestEmail(bookingId)` for every booking matching, in `Europe/Rome`:
  - `bookings.status = 'paid'`,
  - `bookings.cancelled_after_payment_at IS NULL`,
  - `bookings.review_email_sent_at IS NULL`,
  - `events.starts_at + COALESCE(events.duration_min, 0) * interval '1 min' < now() - interval '12 hours'` (event has ended at least ~half a day ago, so the cron at T+1 day catches it cleanly).
  See [STATES.md](./STATES.md) §7.
- **Pre-conditions checked at send time** (defense in depth):
  - `app_settings.review_email_enabled = true` (kill switch).
  - `app_settings.review_url IS NOT NULL` (else the job logs a single warning per run and skips all sends).
- **Post-conditions**: on Resend success, set `bookings.review_email_sent_at = now()`. The booking remains `paid`. This is **not** a state transition.
- **Retry**: up to 3 attempts with backoff. On exhaustion, leave `review_email_sent_at` `NULL` so the next day's cron retries naturally. The retry budget across days is implicitly capped by the event having ended; an alert is raised after 3 consecutive daily failures for the same booking.
- **Suppression**: if `cancelled_after_payment_at` becomes non-null between the cron tick and the actual send, the send is aborted. Idempotency key + the partial index on `bookings` make a double-send physically impossible.

## 5. Localization

V1 emails are in **Italian**. The codebase isolates copy in a single locale file (`it.json` or equivalent) so a future English version is a translation-only change, not a code change.

Dates, times, and currency are formatted with `Intl` in the **`Europe/Rome`** timezone and the `it-IT` locale.

## 6. Headers and metadata

- `List-Unsubscribe`: not set for V1 (these are transactional emails directly related to the user's booking, not marketing). When E8 or any optional admin notice is enabled with broader use, this will be revisited.
- `Reply-To`: monitored venue mailbox.
- `Message-ID`: managed by Resend.
- `X-Cooker-Booking-Id`: custom header included where applicable to make support lookups trivial.

## 7. Failure handling and retries

Resend supports retries internally for transient transport errors. Our application-level retries cover the case where the API call itself fails.

- Retry policy: up to N attempts (3 for guest emails, 5 for accountant), exponential backoff (2s, 8s, 32s, ...), jitter applied.
- After exhaustion, the failure is recorded and an alert is raised (logged + visible in the admin UI). For E7 specifically, the export is left in `failed` status; an admin can re-trigger sending without re-generating the XML.
- A "resend" admin action exists for E2, E3, E4, E5, E6, E7, E9. It produces a **new** Resend message id but uses the same template; for E2 and E5, the **token is not rotated** on a plain resend — the same link is delivered again. To rotate, the admin uses `editBookingPrePayment` (which rotates the token, expires the Stripe session, increments the revision, and sends the amend variant of E2/E5; see [STATES.md](./STATES.md) §5.2). A plain resend of E9 does **not** clear `review_email_sent_at`; the admin uses a dedicated "force review email" action only when explicitly intending to re-send.

## 8. Deliverability checklist (pre-launch)

- [ ] DNS: DKIM, SPF, DMARC records configured and validated through Resend's domain UI.
- [ ] Send a test set covering all required templates to a Mail Tester / equivalent to verify a clean score.
- [ ] Send tests to Gmail, Outlook, Apple Mail to verify rendering and inbox placement.
- [ ] Validate no images break, no remote tracking pixels block, no unresolved variables.
- [ ] Verify plain-text fallback is non-empty for every email.
- [ ] Validate links use the production domain.
- [ ] Stripe webhook end-to-end test from Stripe CLI confirms E6 is sent exactly once per real event, and that the webhook rejects events whose `booking_revision` is stale.
- [ ] XML export end-to-end test confirms E7 sends the correct attachment.
- [ ] Admin reject / waitlist / accept-from-waitlist actions deliver E3, E4, E5 respectively, with correct copy and (for E5) a working completion link.
- [ ] Admin pre-payment edit on a `direct`-origin booking delivers E2 in amend mode with a fresh, working token; the previous token no longer authorizes the completion page; any prior Stripe session is expired.
- [ ] Admin pre-payment edit on a `waitlist`-origin booking delivers E5 in amend mode with a fresh token.
- [ ] Daily review cron run with `app_settings.review_url` set delivers E9 exactly once per eligible booking; suppresses E9 for bookings with `cancelled_after_payment_at` set; sends no email and logs a single warning when `review_url` is null.

## 9. Related documents

- [STATES.md](./STATES.md) — which transitions fire which emails.
- [SECURITY.md](./SECURITY.md) — token handling for the link in E2 and E5.
- [XML_EXPORT.md](./XML_EXPORT.md) — what is attached to E7 and how it is generated.
- [DB_SCHEMA.md](./DB_SCHEMA.md) — `app_settings.accountant_email`, fiscal columns referenced in E6.
