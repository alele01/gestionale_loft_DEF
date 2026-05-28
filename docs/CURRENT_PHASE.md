# Cooker Loft V1 — Current phase

Questo file è il **punto d'ingresso operativo**: descrive lo stato attuale del
prodotto, dove sta la verità tecnica oggi, e qual è la prossima fase reale.
È pensato per essere corto e mantenuto aggiornato fase per fase.

Per ogni dominio (prodotto, sicurezza, stati, email, completion, XML) la
verità prodotto/UX resta nei rispettivi documenti di `docs/`. Per lo
**schema del database** la fonte di verità è il database reale Supabase
insieme alle migration e ai tipi TypeScript generati — **non** un documento
descrittivo.

---

## Current status

- Static UI mockup completed and validated.
- Supabase Foundation completed.
- Real Supabase project created (`cooker-loft-v1`).
- Initial database migration applied.
- RLS baseline implemented (RLS on, default deny, SELECT-only policy per `authenticated` su tutte le operational table).
- Generated Supabase TypeScript types available in [`src/server/supabase/database.types.ts`](../src/server/supabase/database.types.ts).
- **Core App reale completata**: admin auth con Supabase Auth + gate `admin_users`, middleware Next.js a protezione di `/admin/*`, CRUD eventi reale, embed pubblico reale, dashboard prenotazioni e dettaglio prenotazione reali, completion page reale, settings reali, state machine `src/modules/booking-state/*`.
- **Resend integration completata**: invio reale via Resend dei template E1, E2 (con variante `amendment`), E3, E4, E5 (con variante `amendment`), E8 e E9. Toggle in Impostazioni per E1 ed E8 (off di default). Cron Vercel giornaliero per E9 a `app/api/cron/review/route.ts`. Tabella `email_log` per idempotency + audit. Azione admin "Re-invia email di completamento" sulle prenotazioni `awaiting_completion`/`awaiting_payment`.
- **Stripe Checkout integration completata**: sessione Stripe reale creata server-side da `completeBookingAction` (linguaggio italiano, EUR, automatic payment methods, idempotency key per booking+revision, `expires_at` allineato a `payment_deadline_at` con cap 24h). Webhook `app/api/stripe/webhook/route.ts` con verifica firma + tolleranza 5 minuti, idempotency su `payments.stripe_event_id`, revision check su `metadata.booking_revision`, transizione `awaiting_payment → paid` e invio E6 (recap evento + importo + recap fiscale). Pagine `/payment/success` (con poller per webhook race) e `/payment/cancel` (con self-service "Riprova pagamento" via `recreateCheckoutSession`). Edit pre-payment espelle la session Stripe precedente (best-effort) e azzera `stripe_session_id`. Link reale al Stripe Dashboard sulla detail page admin (auto-detect test/live dal prefisso `cs_test_` / `cs_live_`).
- **XML SDI export completato**: modulo puro `src/modules/xml-export/` (vendor hardcoded ANIDRA, banker's rounding, breakdown IVA inclusa, validator FPR12, builder template-literal strict-ordered, sanitizer BasicLatin+Latin-1). DB: `fiscal_profiles.first_name/last_name`, `app_settings.next_invoice_number`/`current_invoice_year`/`xml_export_last_run_at`/`xml_export_cron_enabled`, bucket privato Storage `xml-exports`, RPC `reserve_invoice_number` con year-reset atomico. Server orchestrator `src/server/xml-export/run.ts` (loader, manifest CSV/JSON, zip via `archiver`, upload Storage, E10 via Resend con signed URL 24h, audit log completo). Server actions per export mensile/periodo/selezione + resend + download signed URL, cron route `/api/cron/xml-export` (Bearer `CRON_SECRET`, kill switch `xml_export_cron_enabled`, schedule `0 2 1 * *`). UI live `/admin/exports` con stat reali, anteprima XML live per singolo booking (`/api/xml-export/preview`), riscarica zip e re-invia email. Test suite: unit (`pnpm test:xml`), generazione fixture (`pnpm xml:fixtures`), validazione XSD ufficiale via `xmllint` (`pnpm xml:validate`). Form completion esteso con `firstName`+`lastName` per privati.
- Superfici ancora mock / fuori scope: cron auto-close eventi, cancellazione post-paid.

---

## Current source of truth

| Dominio | Documento / artefatto |
|---|---|
| Product scope, flusso V1 | [`docs/PROJECT_BRIEF.md`](./PROJECT_BRIEF.md) |
| Non-goals | [`docs/NON_GOALS.md`](./NON_GOALS.md) |
| Booking lifecycle e transizioni | [`docs/STATES.md`](./STATES.md) |
| Security, token, webhook, RLS, segreti | [`docs/SECURITY.md`](./SECURITY.md) |
| Inventario email e trigger | [`docs/EMAILS.md`](./EMAILS.md) |
| Completion page UX e validazioni | [`docs/COMPLETION_PAGE_REFERENCE.md`](./COMPLETION_PAGE_REFERENCE.md) |
| Logica XML / export fiscale | [`docs/XML_EXPORT.md`](./XML_EXPORT.md) |
| Database technical schema | Supabase real database + [`supabase/migrations/*`](../supabase/migrations) + [`src/server/supabase/database.types.ts`](../src/server/supabase/database.types.ts) |

### Important rule

Non usare [`docs/archive/DB_SCHEMA.initial.md`](./archive/DB_SCHEMA.initial.md)
come fonte di verità dello schema attivo. È **solo documentazione storica**
della prima migration. Per la struttura del DB ispezionare:

1. Il database reale (via Supabase MCP / dashboard / SQL).
2. Le migration applicate sotto [`supabase/migrations/`](../supabase/migrations).
3. I tipi generati in [`src/server/supabase/database.types.ts`](../src/server/supabase/database.types.ts).

Stessa regola per [`docs/archive/TASK_PLAN.old.md`](./archive/TASK_PLAN.old.md)
e [`docs/archive/TEST_PLAN.old.md`](./archive/TEST_PLAN.old.md): sono storici,
non roadmap o test plan attivi. La roadmap attiva è qui sotto; il piano di
verifica operativa è in [`docs/QA_CHECKLIST.md`](./QA_CHECKLIST.md).

---

## Roadmap condensata (8 fasi)

Questa è **l'unica roadmap attiva**. Le fasi sono pensate per essere
incrementali: ogni fase porta una superficie di prodotto a "reale" senza
rompere quella già funzionante.

1. **Admin Auth + Events CRUD + Public Embed + Real Events Dashboard** — fase corrente / prossima.
2. **Request Intake + Real Prenotazioni Dashboard** — il form pubblico scrive `booking_requests`; la dashboard mostra richieste reali.
3. **State Machine + Admin Actions** — accetta / rifiuta / lista d'attesa / edit pre-payment / edit pre-acceptance; introduzione di `bookings` reali e del modulo `booking-state`.
4. **Resend + Completion Page** — template transazionali (E1–E5), pagina di completamento reale, validazioni, consensi.
5. **Stripe Checkout + Webhook** — creazione sessione, webhook idempotente, transizione `paid`.
6. **XML Export + Accountant Delivery** — generazione XML FPR12, invio E7 al commercialista, storico.
7. **Review Email + Paid Cancellation + Cron** — E9 post-evento, cancellazione operativa post-paid, cron giornaliero per deadline e auto-close eventi.
8. **Hardening + Deploy** — RLS tightening, CSP/iframe headers, rate limiting, CI, Vercel deploy, runbook.

Vincolo: ad ogni passaggio le superfici già reali restano reali; le superfici non ancora trattate restano mock-bound con label esplicita.

---

## Next implementation phase

**Review Email + Paid Cancellation + Cron (fase 7).**

In sintesi:

- Cron auto-close: `events.status='published'` con `starts_at < now()` → `closed`.
- Cron expire bookings: `awaiting_completion` / `awaiting_payment` oltre la deadline → `expired` + email di notifica.
- Cancellazione operativa post-paid lato admin (è già esposta a UI ma serve UX completa + impatti su E9).
- Hardening QA checklist per i casi edge della XML export prima del go-live (cfr. [`docs/QA_CHECKLIST.md`](./QA_CHECKLIST.md) sezione "XML SDI export").

Acceptance e checks operativi: [`docs/QA_CHECKLIST.md`](./QA_CHECKLIST.md).

---

## Non-goals della prossima fase

- Non implementare auto-close `published → closed` o expire bookings via cron.
- Non implementare cancellazione operativa post-paid.
- Non cambiare schema DB salvo bug bloccante (in tal caso segnalarlo prima).
- Non leggere documenti archiviati come fonte di verità attiva.
