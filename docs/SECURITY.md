# Cooker Loft V1 — Security

- **Purpose**: define the security model for V1 across authentication, secrets, public token-based access, payment integrity, RLS, input validation, logging, and GDPR.
- **Scope**: V1 application and infrastructure boundaries (Next.js on Vercel, Supabase, Stripe, Resend).
- **Out of scope**: e-signature, advanced fraud scoring, advanced analytics-driven anomaly detection.
- **Owner**: Cooker Loft technical lead.
- **Last updated**: 2026-05-20.

---

## 1. Threat model (V1)

Primary risks V1 must defend against:

1. **Money tampering**: a malicious client tries to pay less than the configured price or marks a booking as paid without paying.
2. **Unauthorized admin access**: someone accesses the admin dashboard, manipulates events, or reads guest data.
3. **Completion link hijacking**: an attacker guesses or replays a completion link to alter someone else's booking.
4. **Webhook spoofing**: an attacker posts a fake Stripe event to the webhook endpoint to trigger a `paid` transition.
5. **PII leakage**: fiscal data (CF, VAT, address) leaks via logs, error pages, or accidental client exposure.
6. **Abuse of the public form**: bots flood requests, scrape, or DoS.

Out of model for V1: targeted nation-state attacks, supply-chain compromise of Supabase/Stripe/Vercel themselves.

## 2. Hard rules (binding)

Reproduced from the project brief and binding for all V1 code:

- Do not expose secrets in frontend code.
- Admin dashboard must require authentication.
- Public completion links must use secure non-guessable tokens.
- Payment amount must be calculated server-side from database values.
- Frontend must never set a booking as paid.
- Paid/confirmed status can only be set by verified Stripe webhook.
- XML generation must be isolated in a dedicated module.
- Keep business logic outside UI components.
- Centralize booking state transitions.

Every section below enforces one or more of these.

## 3. Authentication & authorization

### 3.1 Admin auth

- Provider: **Supabase Auth** (email + password).
- Onboarding: invite-based. New admin emails are added through a controlled provisioning step (initially manual; an admin-management UI is in scope for V1 final hardening).
- Password policy: Supabase defaults at minimum (length, complexity), plus a passphrase-friendly minimum length of 12.
- Sessions: Supabase cookies set as **HttpOnly, Secure, SameSite=Lax**. Session length: 8 hours rolling, with refresh tokens handled by Supabase.
- MFA: not required for V1; left as a fast-follow if requested.
- Server checks: every admin route handler verifies the session **and** the presence of an `admin_users` row with `role = 'admin'`. A signed-in Supabase user without a corresponding `admin_users` row is treated as unauthenticated.
- UI shell: `/admin/*` routes are gated by middleware that 302s to `/admin/login` when unauthenticated.

### 3.2 Authorization model

- V1 has one role: `admin`. Every authenticated admin can see and act on every booking. This is acceptable for V1 due to the small team size.
- Future roles (`reader`, `accountant`, `super_admin`) can be introduced behind the `admin_users.role` column without schema change.

### 3.3 Guest / representative access

- Guests are **not** authenticated. They access:
  - The embed page `/embed/[slug]` — read-only public projection of an event.
  - The completion page `/complete/[token]` — token-gated.
- The token **is the credential**. It is treated as a bearer secret.

## 4. Completion link tokens

This is the highest-risk surface after the webhook.

### 4.1 Generation

- Tokens are generated server-side with a cryptographically secure RNG (e.g. `crypto.randomBytes(32)` → 32 bytes of entropy).
- Encoding: URL-safe base64 (no padding), yielding a ~43-character string.
- Each token is bound to exactly one booking.

### 4.2 Storage

- **The plaintext token is never persisted.** The DB stores `sha256(token)` in `bookings.completion_token_hash`.
- Optionally, `bookings.completion_token_last4` stores the last 4 characters of the URL-safe encoding for support lookups. This is not sensitive on its own.

### 4.3 Lifetime & single-use

- A token expires at `bookings.completion_deadline_at`.
- The first successful POST of the completion form marks `completion_token_used_at`. After that, GETs for the same token return a read-only "already completed" view; POSTs are rejected.
- Tokens are **invalidated** when a booking is moved to `expired` or `void`, or when an admin explicitly rotates the link.
- **Rotation on pre-payment edit**: every call to `editBookingPrePayment` (see [STATES.md](./STATES.md) §5.2) generates a fresh token, overwrites `bookings.completion_token_hash`, updates `completion_token_issued_at`, clears `completion_token_used_at`, and increments `bookings.revision`. The previous token becomes invalid immediately — even before the new completion email is delivered. This is an audit-logged action with `from_revision` and `to_revision`.
- **Plain rotation**: outside of a data edit, the admin can also trigger a "rotate completion link" action (e.g. the rep lost the email). This rotates the token **without** incrementing `revision`, so any in-flight Stripe Checkout session remains valid. It is also audit-logged.

### 4.4 Transport

- Tokens are only ever sent over HTTPS.
- Tokens appear in the URL path (`/complete/{token}`). To minimize logging exposure:
  - The Next.js app **does not log the URL path** for `/complete/*` routes; logs use the booking id instead, derived after token validation.
  - The token does not appear in any Resend metadata, in Stripe metadata, or in client-side telemetry.
- Referer leakage: the completion page sets `Referrer-Policy: no-referrer` so navigating away does not leak the token to third-party hosts.

### 4.5 Rate limiting

- The completion endpoint is rate-limited by IP and by token-prefix (so a brute-force attempt with random tokens against the endpoint is throttled before it can scan the keyspace).
- A failed validation does not reveal whether the token format was wrong, the token is expired, or the token does not exist. The response is a generic "link invalid or expired" with HTTP 410.

## 5. Stripe webhook handling

The webhook is the **only** code path that may transition a booking to `paid`.

### 5.1 Endpoint

- `POST /api/stripe/webhook`.
- Runs on Node runtime (not Edge) because it requires access to the raw request body for signature verification.
- Configured in Stripe Dashboard with the events V1 cares about (`checkout.session.completed`, `payment_intent.succeeded` for safety).

### 5.2 Verification

- The handler reads the raw request body (no JSON parsing first).
- The handler verifies the `Stripe-Signature` header using the **webhook signing secret** loaded from environment.
- If verification fails, the handler responds `400` and writes nothing.
- Successful verification: the event is processed.

### 5.3 Idempotency

- Each Stripe event has a unique `id` (`evt_*`). The handler **inserts** a row into `payments` with `stripe_event_id` as a unique constraint.
- If the insert fails on the unique constraint, the event has already been processed; the handler responds `200` and exits.
- Only if the insert succeeded does the handler then transition the booking to `paid` via the state machine. The transition itself is also defensive against double-application (it checks current status).

### 5.4 Replay protection

- Stripe signature includes a timestamp. The handler rejects events with a timestamp older than the allowed tolerance window (5 minutes by default), even if the signature is otherwise valid.
- Combined with the unique `stripe_event_id` insert, replay is neutralized.

### 5.5 Revision check (binding)

- When the server creates a Stripe Checkout session, it sets **`metadata.booking_id`** and **`metadata.booking_revision`** to the booking's current `id` and `revision` values.
- When the webhook is processed, the handler reads `metadata.booking_revision` from the event and compares it to the **current** `bookings.revision`.
- If the two values do not match:
  - The handler **does not** mark the booking `paid`.
  - It writes a `payments` row with `status = 'ignored'` and an `audit_log` entry with `metadata.reason = 'webhook_revision_mismatch'`.
  - It responds `200` to Stripe so Stripe stops retrying.
  - An admin alert is raised (the dashboard surfaces it as a security anomaly).
- This makes obsolete Stripe sessions (created before a pre-payment edit) physically incapable of marking a booking `paid`, even if the rep races to pay right before the edit and Stripe delivers the event late.
- The amount comparison is performed against `bookings.amount_cents` **as it stands at the time of the webhook** (which equals the amount embedded in the active session, since `editBookingPrePayment` also recomputes `amount_cents`).

### 5.6 What the handler never does

- It never trusts amounts from the client. The amount paid is taken from the **Stripe event** and compared to `bookings.amount_cents`. Any mismatch is logged as a security anomaly, and the booking is **not** marked `paid` automatically (admin alert).
- It never reads or echoes the completion token.
- It never accepts events for bookings already in `paid`, `void`, or `expired` status (these are logged and ignored).
- It never marks `paid` when `bookings.cancelled_after_payment_at` is set (theoretical case: a paid booking that was already operationally cancelled — the webhook for a later session attempt is rejected).

## 6. Server-side amount calculation & pre-payment edit safety

### 6.1 Amount calculation

- Amounts are computed **server-side only**, in the state machine when transitioning `awaiting_completion → awaiting_payment` and on every `editBookingPrePayment` that changes `people`:
  - `amount = events.price_cents * bookings.people`.
- `events.price_cents` is the per-person **gross** price (IVA inclusa). The Stripe Checkout amount is therefore the gross total. VAT breakdown for fiscal output happens later in the XML module (see [XML_EXPORT.md](./XML_EXPORT.md)).
- The client sends no amount; any amount-like fields in client payloads are ignored.
- The Stripe Checkout session is created on the server with the computed amount, the line item description, `client_reference_id = booking.id`, and `metadata = { booking_id, booking_revision }`.
- The webhook compares the Stripe event amount to the stored `bookings.amount_cents` before marking `paid`.

### 6.2 Pre-payment edit flow (security view)

When the admin calls `editBookingPrePayment(bookingId, patch, actor, reason)`:

1. The state machine confirms `bookings.status ∈ {awaiting_completion, awaiting_payment}` and `bookings.cancelled_after_payment_at IS NULL`. Otherwise the call is rejected (use `void` for pre-payment cancellations).
2. The new fields are persisted; `bookings.amount_cents` is recomputed.
3. `bookings.revision` is incremented atomically.
4. A fresh completion token is generated; `bookings.completion_token_hash` and `completion_token_issued_at` are updated; `completion_token_used_at` is cleared.
5. If a Stripe Checkout session is currently active:
   - The server calls `stripe.checkout.sessions.expire(stripe_session_id)`. Failures are logged but do not block the edit (the revision check in §5.5 is the authoritative safeguard).
   - The booking transitions back to `awaiting_completion` so the rep must re-submit the completion form against the new state.
6. The amend variant of the appropriate completion email (E2 for `origin = 'direct'`, E5 for `origin = 'waitlist'`) is queued with the new completion URL.

After this flow:

- The previous completion URL returns 410.
- The previous Stripe Checkout session, if not yet expired by Stripe, can still be paid by the user — but the resulting webhook event will carry the old `booking_revision` and will be rejected by §5.5.
- No security state depends on Stripe's `expire` succeeding.

### 6.3 Operational paid-cancellation (security view)

- `markPaidBookingOperationallyCancelled` writes only operational marker fields; it does not change `status`, `amount_cents`, or `revision`. The DB trigger `prevent_paid_edits` (see [DB_SCHEMA.md](./DB_SCHEMA.md) §5) enforces this.
- It does not call Stripe (no Refund), nor does it touch any fiscal record.
- It does set `cancellation_affects_review_email = true` and thereby gates the E9 sender (see [EMAILS.md](./EMAILS.md) §E9).

## 7. Consent capture (binding)

V1 captures consents in two places and treats them as audit-grade records.

### 7.1 Public request form (embed)

Three mandatory checkboxes (terms, privacy, explicit health-data — see [DB_SCHEMA.md](./DB_SCHEMA.md) §3.3). For each:

- The boolean is stored.
- A server-side timestamp is stored (the client cannot influence it).
- The submitter's IP and User-Agent are stored (read from the request, never from a client-provided payload).
- The document version is stored (server constant at the time of submission). Changing the constant in the future only affects future submissions.

The DB enforces `CHECK (consent_*_accepted = true)` so a `false` row cannot exist. The application also re-validates with zod server-side. The client-side check is for UX, not for security.

### 7.2 Completion page

The completion page collects a richer consent set (see [COMPLETION_PAGE_REFERENCE.md](./COMPLETION_PAGE_REFERENCE.md) §5):

- Condizioni generali (boolean, required).
- Approvazione specifica delle clausole 1341/1342 c.c. (boolean, required).
- Privacy notice (boolean, required).
- Explicit health-data consent (boolean, required).
- Image-use choice (radio, required, value `'accept' | 'decline'`).

These are written to `bookings.consents` (jsonb) atomically with `bookings.legal_accepted_at`, `privacy_accepted_at`, `health_consent_accepted_at`, and `image_use_choice`. The IP and User-Agent are captured server-side.

### 7.3 Tamper resistance

- Once `bookings.status = 'paid'`, the trigger `prevent_paid_edits` (see [DB_SCHEMA.md](./DB_SCHEMA.md) §5) blocks edits to the consents column.
- Pre-payment, a consent record can be overwritten only by a fresh completion submission (which is what happens after `editBookingPrePayment`); the audit log keeps the diff.

### 7.4 Subject-access response

When a data subject asks for their data, support pulls the booking, the request, the consent jsonb, the fiscal profile, and the audit log entries. No additional consent gateways are required because each consent record carries its own metadata (timestamp + IP + UA + version).

## 8. Secrets management

- All secrets live as **server-only** environment variables on Vercel.
- Naming convention: secrets **never** carry the `NEXT_PUBLIC_` prefix. Anything prefixed `NEXT_PUBLIC_` is fair game for the browser bundle and is treated as public.
- Required server secrets for V1:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY` (only used as a fallback for safe client reads if needed; not used by the server for sensitive operations)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `RESEND_API_KEY`
  - `APP_BASE_URL`
  - `ACCOUNTANT_FALLBACK_EMAIL` (used only if `app_settings.accountant_email` is empty)
- Required public env vars:
  - `NEXT_PUBLIC_APP_BASE_URL` (for client redirects)
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (only if direct anon client reads are introduced; not needed if the server mediates everything).
- Rotation: webhook secret and Stripe keys are rotated through Stripe dashboard with overlap; Resend API key likewise. Supabase service role rotation requires a coordinated deploy.
- Local dev: `.env.local` is git-ignored; example values live in `.env.example`.

## 9. Row-level security (RLS) summary

See [DB_SCHEMA.md](./DB_SCHEMA.md) for the full table. Headline rules:

- RLS is **enabled** on every table; default policy is deny.
- The `anon` role has no SELECT/INSERT/UPDATE/DELETE on operational tables. Public reads (embed page, completion page) are served by Next.js route handlers using the service role on the server.
- The `authenticated` admin role can SELECT operational tables for dashboard display. **All writes go through server route handlers under the service role** so the state machine remains the single writer. This is enforced procedurally; we do not grant `authenticated` direct UPDATE rights on `bookings.status` or `booking_requests.status`.
- The `service_role` is used only from server code with the service-role key, never shipped to the browser.

## 10. Input validation

- Single source of truth: **zod** schemas in `src/schemas/` (final path subject to confirmation at build time).
- Each schema is consumed both by the client form and the server route handler. The server **always** re-validates.
- Length caps on every free-text field to prevent memory abuse (e.g. `notes` ≤ 1000 chars).
- Email format validation, phone format soft-validation, Italian CF/VAT format validation in the fiscal flow.
- HTML inputs are escaped on render; no `dangerouslySetInnerHTML` outside of trusted, controlled email rendering.

## 11. Rate limiting & abuse

- Public form: rate-limited by IP. A short per-IP token-bucket (e.g. 5 requests / 10 minutes), plus a longer per-event bucket to absorb bursts.
- Completion endpoint: rate-limited by IP and per-token prefix (see §4.5).
- Auth endpoints: standard Supabase rate limits, augmented by a Next.js middleware throttling repeated 401s from the same IP.
- Implementation: an edge-friendly limiter (e.g. Upstash Rate Limit or Vercel's edge KV) — final choice locked in implementation phase.

## 12. CSRF & CORS

- All non-GET state-changing routes are same-origin only and require a `same-site` cookie. Public POST endpoints (request submission) use a short-lived signed token issued by the embed page to mitigate cross-site automated abuse.
- The embed page is intended to be loaded inside a WordPress iframe. The application sets a permissive `Content-Security-Policy: frame-ancestors` only for the WordPress origin(s) we know about (configurable). All other routes set `frame-ancestors 'none'`.
- CORS: not enabled for cross-origin POSTs in V1. The embed page interacts with our API via same-origin requests because the iframe lives on our domain.

## 13. Logging, telemetry, and PII

- Server logs include: request id, route, status, duration, booking id where applicable. They **never** include: completion tokens, Stripe secret data, full fiscal data (CF, VAT, full address), full email bodies.
- Errors are reported with structured payloads. PII fields are scrubbed at the logger layer.
- Client telemetry: minimal. No third-party analytics on the embed page in V1. Internal admin pages may add lightweight analytics; never on guest pages.
- Webhook payloads are stored in `payments.raw_event` (Stripe), which can include card-network metadata but no PAN. Acceptable for V1 given Stripe's PCI scope reduction.

## 14. GDPR posture

- **Data we process**:
  - Requester contact info (name, email, phone).
  - Booking details (people, allergies / intolerances / food needs, special occasion).
  - Consents (terms, privacy, explicit health-data, clauses 1341/1342, image-use) with timestamp, IP, UA, document version.
  - Fiscal data (legal name, CF/VAT, address, SDI/PEC).
  - Payment metadata (Stripe ids, amount).
- **Lawful basis**:
  - Contract performance (art. 6.1.b GDPR) for booking + payment data, including precontractual measures (request).
  - **Explicit consent (art. 9.2.a GDPR)** for health-related data (allergies / intolerances / food needs). The explicit health-data checkbox on the public form and at completion is the audit anchor for this basis.
  - Legitimate interest (art. 6.1.f GDPR) for image use **only** if the representative explicitly opts in via the image-use radio.
  - Legal obligation for fiscal data retention (tax law).
  - V1 does not collect marketing consent because V1 does not send marketing.
- **Privacy notice**: a privacy notice is linked from the embed form and the completion page. The consent checkboxes on **both** the request and the completion form are stamped with timestamp, IP, user-agent, **and document version**. Health-data consent is captured explicitly and separately from the privacy consent.
- **Reuse of legal copy**: the texts under `reference/oldPage/legalContent.ts` and `reference/oldPage/privacyContent.ts` are the canonical source for the legal/privacy copy on the completion page (see [COMPLETION_PAGE_REFERENCE.md](./COMPLETION_PAGE_REFERENCE.md)). The public form short labels reference the full documents via the `*_version` constants.
- **Data subject rights**: V1 does not yet ship a self-service "export my data" UI. Requests are handled out-of-band by admins via the dashboard, with audit logging. Erasure of `paid` bookings is constrained by fiscal retention obligations and is documented as such.
- **Retention**: see [DB_SCHEMA.md](./DB_SCHEMA.md) §6.
- **Sub-processors**: Vercel (hosting), Supabase (DB + Auth), Stripe (payments), Resend (email). All disclosed in the privacy notice.

## 15. HTTP security headers

Set globally by Next.js middleware:

- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload` (once domain is confirmed HTTPS-only).
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options`: set per route. Default `DENY`. The embed page uses `Content-Security-Policy: frame-ancestors <wordpress origins>` instead.
- `Referrer-Policy: no-referrer-when-downgrade` globally; `no-referrer` on `/complete/*`.
- `Permissions-Policy`: restricts camera, microphone, geolocation, payment APIs.
- `Content-Security-Policy`: strict default; allows Stripe domains for the Checkout redirect-back flow; allows our own domain for scripts and images.

## 16. Backup & recovery

- Supabase managed Postgres backups are enabled (daily, with point-in-time recovery on the appropriate tier). Frequency and retention to be set per the chosen Supabase plan.
- A documented restore procedure exists: identifying the latest known-good backup, applying it to a recovery project, validating, then cutting over.
- Stripe is the source of truth for payments. If we lose `payments` rows, we re-reconcile from Stripe.

## 17. Dependency hygiene

- `npm audit` (or equivalent) runs in CI.
- Dependabot / Renovate watches for security updates and opens PRs.
- We do not pin to floating major versions for security-critical libraries (Stripe SDK, Supabase client, Resend SDK).

## 18. Pre-launch security checklist

- [ ] All secrets present on Vercel, none in the client bundle.
- [ ] Supabase RLS enabled on every table; manual smoke test from the anon role returns no rows.
- [ ] Admin routes return 302 when unauthenticated.
- [ ] Completion endpoint returns 410 for: malformed, unknown, expired, used, **rotated** tokens.
- [ ] Stripe webhook returns 400 for invalid signatures; 200 for duplicates without side effects.
- [ ] Stripe webhook refuses to mark a booking `paid` if `event.amount != bookings.amount_cents` **or** `event.metadata.booking_revision != bookings.revision`.
- [ ] `editBookingPrePayment` rotates the token, increments `revision`, calls `stripe.checkout.sessions.expire`, and queues the amend variant of E2/E5. The old link returns 410 immediately. A stale webhook for the obsolete session is logged and ignored.
- [ ] `markPaidBookingOperationallyCancelled` sets the marker fields, does not call Stripe, and suppresses the next E9.
- [ ] Public request form: the DB rejects insertion when any of the three consent booleans is `false` (validated by direct SQL probe). Server-side IP / UA / version are recorded.
- [ ] Completion page: `bookings.consents` is populated with all five sub-objects on submission, with server-captured IP/UA, and the matching scalar columns (`legal_accepted_at`, `privacy_accepted_at`, `health_consent_accepted_at`, `image_use_choice`) are set.
- [ ] Rate limits in place on public form, completion endpoint, and admin auth.
- [ ] HTTP security headers set; `frame-ancestors` limited to known WordPress origin(s).
- [ ] Privacy notice published; the legal/privacy texts on the completion page match the source under `reference/oldPage/`.
- [ ] Logs scrub tokens, fiscal data, consent IPs, and secrets.

## 19. Related documents

- [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) — system overview.
- [STATES.md](./STATES.md) — transitions guarded by these rules.
- [DB_SCHEMA.md](./DB_SCHEMA.md) — schema-level enforcement (CHECKs, triggers, RLS).
- [EMAILS.md](./EMAILS.md) — how the completion token is delivered.
- [XML_EXPORT.md](./XML_EXPORT.md) — fiscal data handling boundaries.
- [COMPLETION_PAGE_REFERENCE.md](./COMPLETION_PAGE_REFERENCE.md) — completion-page consent structure.
