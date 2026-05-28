# Cooker Loft V1 — Non-Goals

- **Purpose**: state explicitly what V1 does **not** do, so scope creep, design ambiguity, and "we assumed it was in" surprises are eliminated.
- **Scope**: the items below are out-of-scope for V1. They may return in a later version, or they may never.
- **Out of scope**: anything not listed here is governed by [PROJECT_BRIEF.md](./PROJECT_BRIEF.md).
- **Owner**: Cooker Loft technical lead.
- **Last updated**: 2026-05-20.

---

## How to read this document

For each non-goal we record:

- **What is excluded** (precise, narrow statement).
- **Why it is excluded in V1** (cost, risk, legal complexity, or simply unnecessary for go-live).
- **Deferred to** (V2 candidate, or marked "no current plan").

If anyone proposes building one of these in V1, treat it as a scope change request and refer them back to this document.

---

## 1. No individual participant flow

- **Excluded**: V1 does not collect data from each individual participant of an event. Participants do not receive personal links, do not log in, do not submit personal info, do not pay individually.
- **Why**: the V1 product model is "one representative books for a group". Splitting per-participant data multiplies UI, email, GDPR, and payment complexity without changing what the venue actually needs to operate.
- **Deferred to**: V2 candidate (per-participant allergies, per-participant signed waivers).

## 2. All declarations handled by the booking representative

- **Excluded**: V1 does not collect per-participant declarations (allergies, intolerances, food needs, special occasion, legal consent). The booking representative declares on behalf of the entire group.
- **Why**: aligns with the "one representative" model above, and matches how the venue already operates manually today.
- **Deferred to**: V2 candidate, paired with the per-participant flow.

## 3. No automatic refunds

- **Excluded**: V1 does not issue refunds through Stripe automatically. There is no "refund" button that calls Stripe.
- **Why**: refund policy is still being defined, refunds have legal and accounting implications, and reversing money is a high-blast-radius operation we will not automate before policy is locked.
- **Deferred to**: V2 candidate. In V1, refunds and credit notes are handled manually out-of-band (Stripe dashboard, accountant). The team **can** mark a paid booking as cancelled inside V1 for operational purposes — see [STATES.md](./STATES.md) §6 and [DB_SCHEMA.md](./DB_SCHEMA.md) — but that marker triggers no money movement and no fiscal automation.

## 4. No automatic cancellation / recesso workflow

- **Excluded**: V1 does not implement an automated cancellation, withdrawal (diritto di recesso), or rebooking workflow for guests. There is no "cancel my booking" public page.
- **Why**: Italian distance-selling rules around recesso for event/leisure services require careful legal framing. Building an automated workflow before the legal framing is locked risks shipping the wrong behavior. The volume of cancellations expected in V1 does not justify automation.
- **Deferred to**: V2 candidate, after legal review.

## 5. No automatic SDI submission

- **Excluded**: V1 does **not** submit XML invoices to the Sistema di Interscambio (SDI). The fiscal XML files are generated and **emailed to the accountant**, who handles transmission.
- **Why**: direct SDI transmission requires accredited channels (Web Service / SDICoop / PEC), digital signatures, and a level of fiscal compliance ownership that the venue is not prepared to take on in V1.
- **Deferred to**: no current plan. Most likely path forward is integrating with a service provider that already handles SDI transmission (see next item), rather than building this in-house.

## 6. No Fatture in Cloud integration in V1

- **Excluded**: V1 does not push invoices, customers, or payment data to Fatture in Cloud or any equivalent SaaS (Aruba, Fattura24, etc.).
- **Why**: the accountant flow for V1 is email-based and intentionally minimal. Integration with a third-party fiscal SaaS is a multi-week effort (auth, mapping, error handling, sandbox) and is not required for go-live.
- **Deferred to**: V2 candidate. If chosen, this also becomes the natural place to delegate SDI submission (item 5).

## 7. No advanced reminder campaigns (but one post-event review email is included)

- **Excluded**: V1 does not send drip reminder campaigns ("your event is in 7 days / 1 day"), "you have not completed your booking" nudges, multi-step nurture flows, or any marketing sequence.
- **Included in V1 (operational, not marketing)**: a single, transactional **post-event Google review request email** is sent the day after the event to bookings that are `paid` **and** not operationally cancelled by the team. This is `E9` in [EMAILS.md](./EMAILS.md). It is one email per booking, idempotent, and gated by `app_settings.review_url` being configured.
- **Why**: drip campaigns require cadence rules, unsubscribe handling, and template variants that we do not need for V1. A single post-event review request is operational, low-risk, and directly serves the venue's reputation.
- **Deferred to V2**: any cadence longer than one post-event email (e.g. T-7d / T-1d reminders, no-show recovery, post-review thank-yous).
- **Explicit allowance**: if the venue requests a specific further reminder as a V1 must-have, it can be added, but the default remains the single E9 only.

## 8. No electronic signature

- **Excluded**: V1 does not collect a legally-binding electronic signature for legal/privacy acceptance. The representative ticks checkboxes; the timestamp, IP address, and user-agent of acceptance are logged.
- **Why**: a qualified e-signature requires a certified provider and a level of identity verification we are not implementing in V1. Checkbox + logged metadata is the standard pattern for online consent capture and is acceptable for V1.
- **Deferred to**: no current plan.

## 9. No advanced analytics

- **Excluded**: V1 does not include a BI dashboard, cohort analysis, funnel reporting, or marketing attribution.
- **Why**: V1 operators want to run events, not analyze them. Basic counters (e.g. requests per event, capacity used, paid bookings) are part of the admin UI, but not "analytics".
- **Deferred to**: V2 candidate.

## 10. No public guest accounts

- **Excluded**: guests do not create accounts, do not log in, do not have a "my bookings" page. Authentication exists only for admins.
- **Why**: the guest journey is one-shot (submit request, receive completion link, complete, pay). Accounts add password reset flows, profile pages, and GDPR data-export obligations for a population that does not need them in V1.
- **Deferred to**: no current plan.

## 11. No multi-tenant / multi-venue

- **Excluded**: V1 is built for **one** venue (Cooker Loft). There is no organization/tenant concept, no per-tenant branding, no per-tenant Stripe account.
- **Why**: building multi-tenant correctly (data isolation, billing, branding) is a different product. V1 ships for one venue.
- **Deferred to**: not planned.

## 12. No native mobile app

- **Excluded**: V1 is web-only. There is no iOS or Android app.
- **Why**: the entire flow works well on responsive web. A native app is unjustified at this stage.
- **Deferred to**: not planned.

## 13. No on-site / POS payment

- **Excluded**: V1 only accepts online payments through Stripe Checkout. There is no terminal, no cash-on-arrival flow, no "mark as paid manually" button in the UI.
- **Why**: the "paid" state has fiscal consequences and must remain webhook-only (see [SECURITY.md](./SECURITY.md)). A manual override would create a path for the frontend or admins to fake a paid state, which is explicitly forbidden by the hard rules.
- **Deferred to**: no current plan. If on-site payment is ever needed, it must integrate with the same webhook-driven flow (e.g. Stripe Terminal), not bypass it.

## 14. No discount codes / promotions

- **Excluded**: V1 does not implement coupon codes, promotional pricing, group discounts, or tiered pricing inside the app.
- **Why**: each promotion mechanism is a small project of its own (validation, stacking, fiscal impact on invoice descriptions, abuse).
- **Deferred to**: V2 candidate.

## 15. No waitlist auto-promotion

- **Excluded**: V1 does not automatically promote a waitlisted request to "accepted" when capacity frees up. An admin must explicitly accept from the waitlist.
- **Why**: capacity logic interacts with party size (a 6-person waitlisted request cannot fill a 2-seat opening), and auto-promotion would email guests without a human in the loop. V1 keeps a human gate.
- **Deferred to**: V2 candidate.

## 16. No editing of paid bookings (fiscal data is frozen at payment)

- **Excluded**: once a booking is `paid`, V1 does not allow editing of people count, amount, or fiscal data. The booking is fiscally frozen.
- **Allowed (pre-payment) — IS in V1**: before payment (`awaiting_completion` or `awaiting_payment`), the team **can** edit people / dietary notes / special occasion if the representative requests a variation. Doing so:
  - increments `bookings.revision`,
  - rotates the completion token (the previous link stops working),
  - expires any prior Stripe Checkout session,
  - re-sends the completion email with the new link.
  See [STATES.md](./STATES.md) §5.2 and [SECURITY.md](./SECURITY.md) §6.
- **Allowed (post-payment, operational only)**: the team can mark a paid booking as **operationally cancelled** in V1. This is a marker (`bookings.cancelled_after_payment_at`), not a state transition off `paid`, and does not trigger refund or credit-note automation. It does suppress the post-event review email (E9).
- **Why**: editing post-payment would invalidate the XML export and create reconciliation gaps with the accountant. Pre-payment edits are safe because no fiscal record has been emitted yet.
- **Deferred to V2**: a controlled "amend" flow post-payment with a paper trail (likely paired with credit-note XML).

---

## What V1 **does** include

For clarity, the inverse list:

- Admin authentication and event CRUD.
- Public per-event request form, embeddable on WordPress via iframe, **including the three mandatory consent checkboxes** (terms, privacy, explicit health-data consent).
- Admin review of requests per event with accept / reject / waitlist actions, and acceptance from waitlist.
- Transactional emails for every requester-visible transition: accepted (E2), rejected (E3), waitlisted (E4), accepted from waitlist (E5), payment confirmation (E6), accountant XML (E7), **post-event Google review request (E9)**.
- Representative completion page (UX based on [COMPLETION_PAGE_REFERENCE.md](./COMPLETION_PAGE_REFERENCE.md) and the prior project under `reference/oldPage/`).
- **Pre-payment admin edits** that rotate token + expire Stripe session + re-send completion email.
- Stripe Checkout payment with server-computed amounts. **Prices are always IVA inclusa**.
- Webhook-verified transition to `paid`, with `booking_revision` matching to reject obsolete sessions.
- **Operational paid-cancellation** marker (no refund automation, no SDI/credit-note automation).
- Fiscal XML generation in an isolated module, with periodic email delivery to the accountant. Schema (FPR12) and content shaped against the accountant's sample at `reference/xml/fattura reference.xml`.

See [PROJECT_BRIEF.md](./PROJECT_BRIEF.md) for the full description.
