# Cooker Loft V1 — QA checklist operativa

Lista corta, da spuntare manualmente al termine di ogni fase. Non sostituisce
un test plan completo: serve come gate "buon senso" prima di considerare una
fase chiusa.

La fase corrente e i suoi non-goals sono in
[`docs/CURRENT_PHASE.md`](./CURRENT_PHASE.md).

---

## Supabase Foundation baseline

Checklist già completata in Foundation, da rieseguire al bisogno (es. dopo
una nuova migration, dopo modifiche env, prima di un rilascio).

- [x] `pnpm rls:check` ritorna verde: ogni operational table risponde 0 righe al role `anon`.
- [x] `list_tables` (via Supabase MCP) mostra tutte le 10 tabelle con `rls_enabled=true`.
- [x] `get_advisors type=security` (via Supabase MCP) non riporta lint critici.
- [x] `public.app_settings` contiene esattamente una riga con `id=1` e i version string seedati (`terms_version`, `privacy_version`, `health_consent_version`, `image_use_consent_version`, `clauses_1341_1342_version`).
- [x] `.env.local` popolato; nessun secret commesso (`.env*` ignorato in `.gitignore`).
- [x] `pnpm typecheck` e `pnpm build` puliti.
- [x] Nessun riferimento a `SUPABASE_SERVICE_ROLE_KEY` o stringa `supabase` in `.next/static/` dopo `pnpm build`.

---

## Phase: Admin Auth + Events CRUD + Public Embed + Real Events Dashboard

Da spuntare quando la fase corrente viene applicata.

### Admin auth

- [ ] Apertura di `/admin/dashboard` senza sessione → 302 a `/admin/login`.
- [ ] Login con utente Supabase **senza** riga in `admin_users` → form mostra "accesso non autorizzato"; nessuna sessione attiva (cookie ripuliti).
- [ ] Login con utente Supabase + riga `admin_users` (`role='admin'`) → redirect a `/admin/dashboard`, sessione persistente tra refresh.
- [ ] Logout → 302 a `/admin/login`, sessione invalidata, tentativo successivo su `/admin/*` torna alla redirect.
- [ ] Nessuna pagina pubblica (`/embed/[slug]`, `/payment/*`, `/`) richiede auth.

### Events CRUD

- [ ] `/admin/events` mostra eventi reali letti dal DB, ordinati per `starts_at desc`.
- [ ] "Nuovo evento" + form valido → riga in `events` con `status='draft'`, `created_by` = id admin loggato, slug univoco, `currency='EUR'`, `vat_rate_bps=2200`; audit_log riga con `action='event.create'`.
- [ ] Spunta "Pubblica subito" sul form di creazione → riga con `status='published'`.
- [ ] Modifica evento `draft` riuscita (titolo, data, capienza, prezzo).
- [ ] Tentativo di modifica evento `published` rifiutato dal server con messaggio chiaro all'utente (anche entrando dall'URL `/admin/events/[id]/edit` diretto).
- [ ] "Pubblica" su evento `draft` → `status='published'`, audit_log riga con `action='event.publish'`, `from_state='draft'`, `to_state='published'`.
- [ ] "Archivia" su evento `draft` o `published` → `status='archived'`, audit_log riga con `action='event.archive'`; evento sparisce dalle liste filtrate "non-archived".
- [ ] Prezzo mostrato sempre come "IVA inclusa" nella UI admin.
- [ ] Embed URL/iframe block nel detail evento punta a `${APP_BASE_URL}/embed/<slug>`.

### Public embed

- [ ] `/embed/<slug-published>` renderizza i dati reali dell'evento (titolo, data, prezzo IVA inclusa, capienza residua se mostrata).
- [ ] `/embed/<slug-draft>` → 404 (o pagina "non disponibile").
- [ ] `/embed/<slug-archived>` → 404.
- [ ] `/embed/<slug-closed>` → 404 (anche se il cron di auto-close non è ancora attivo, un evento manualmente marcato `closed` deve essere bloccato).
- [ ] `/embed/<slug-inesistente>` → 404.

### Dashboard

- [ ] `/admin/dashboard` mostra eventi reali; eventuali conteggi prenotazioni hanno label visibile (es. "Dati mock — Phase 2").

### Build / lint / regressioni

- [ ] `pnpm typecheck` pulito.
- [ ] `pnpm lint` pulito.
- [ ] `pnpm build` pulito.
- [ ] `pnpm rls:check` ancora verde (zero regressioni Foundation).
- [ ] `grep` su `.next/static/` non trova `SUPABASE_SERVICE_ROLE_KEY` né leak della service-role key.
- [ ] Pagine mock rimanenti (`/admin/prenotazioni/*`, `/admin/exports`, `/admin/settings`, `/complete/[token]`, `/payment/*`) continuano a renderizzare senza eccezioni in console.

### Verifica DB post-test (via Supabase MCP)

- [ ] `select id, slug, status, created_by from public.events;` mostra le righe attese.
- [ ] `select entity_type, action, from_state, to_state, actor_type from public.audit_log order by created_at desc limit 20;` mostra le righe per ogni create/update/publish/archive eseguita.
- [ ] `select id, email, role from public.admin_users;` contiene almeno l'admin di test.

---

## Phase: Core App reale (intake + state machine + completion + settings)

Da spuntare a chiusura della fase corrente. Tutte le superfici sono reali
contro Supabase; email reali, Stripe reale, XML e cron restano fuori scope:
i side-effect (email E1–E5, sessione Stripe) sono **placeholder loggati in
`audit_log`** (`email.scheduled`, `stripe.skipped`).

### Public intake (`/embed/[slug]`)

- [ ] `/embed/<slug-published>` mostra dati reali (titolo, data, prezzo IVA inclusa, max persone disponibili).
- [ ] Submit di una richiesta valida → riga in `public.booking_requests` con `status='pending'`, `event_id` corretto, `people`, `requester_*`, `dietary_notes`, `special_occasion`, `notes` salvati.
- [ ] Consensi terms / privacy / health: in `consents_jsonb` la struttura `{terms, privacy, health}` ha `accepted=true`, `version=<da app_settings>`, `accepted_at` timestamp.
- [ ] `ip_address` e `user_agent` valorizzati server-side (non dal client).
- [ ] `audit_log` riceve `request.created` (entity_type `booking_request`, actor_type `system`/`representative`).
- [ ] `audit_log` riceve due righe `email.scheduled` (E1 al richiedente, E8 al venue) come placeholder.
- [ ] Submit con consenso terms/privacy/health mancante → form bloccato lato server, nessuna riga creata.
- [ ] Submit su evento `draft` / `closed` / `archived` → richiesta rifiutata con messaggio chiaro.

### State machine (admin actions su `/admin/prenotazioni/[id]`)

- [ ] Accept di una `pending`: `booking_requests.status='accepted'`, creata `bookings` riga con `status='awaiting_completion'`, `amount_cents = people * event.price_cents`, `completion_token_hash` SHA-256 valorizzato in DB (mai plaintext), `completion_deadline_at` impostato dalle `app_settings.completion_window_hours`.
- [ ] Audit: righe `request.accepted` + `booking.created` con `actor_type='admin'` e `actor_id` admin loggato.
- [ ] `email.scheduled` con `email_id='E2'` loggata in `audit_log`.
- [ ] Reject di una `pending`: `booking_requests.status='rejected'`, `decision_reason` salvato, audit `request.rejected`, `email.scheduled` `E3`.
- [ ] Waitlist di una `pending`: `booking_requests.status='waitlisted'`, audit `request.waitlisted`, `email.scheduled` `E4`.
- [ ] Promote da waitlist: stessa logica di accept, audit `request.accepted_from_waitlist` + `booking.created`, `email.scheduled` `E5`.
- [ ] Edit pre-acceptance (pending): aggiorna `booking_requests` (`people`, `dietary_notes`, `special_occasion`), audit `request.updated_pre_acceptance`; nessuna booking creata.
- [ ] Edit pre-payment (booking `awaiting_completion`/`awaiting_payment`): `bookings.revision` incrementata, `amount_cents` ricalcolato se cambia `people`, **completion token ruotato** se `people` cambia (nuovo `completion_token_hash`, `completion_token_used_at` nullo), `email.scheduled` `E2` ri-loggato.
- [ ] Delete pre-payment: se booking esisteva → `bookings.status='void'` + `voided_at` valorizzato, `booking_requests.status='cancelled'`, audit `booking.voided` + `request.cancelled`. Se solo request → `booking_requests.status='cancelled'`, audit `request.cancelled`.
- [ ] Capacity guard: tentare di accettare quando la capienza è saturata → server rifiuta, nessuna `bookings` creata, nessun audit di accept.

### Completion senza Stripe (`/complete/[token]`)

- [ ] `GET /complete/<token-valido>` mostra form con dati evento + persone correnti.
- [ ] `GET /complete/<token-scaduto>` o `<token-usato>` o `<token-inesistente>` → vista "link non valido" con email di contatto venue.
- [ ] Submit form privato (CF italiano) valido → `bookings.status='awaiting_payment'`, `completion_token_used_at` valorizzato, `payment_deadline_at` impostato, `stripe_session_id` inizia con `placeholder_`.
- [ ] Submit form azienda (P.IVA + SDI 7 char o PEC) valido → upsert in `fiscal_profiles` (kind=`company`, `legal_name`, address, vat_number, sdi/pec, invoice_note).
- [ ] `consents_jsonb` su `bookings`: `terms`, `privacy`, `health`, `clauses_1341_1342` con `value=true`, `image_use` con `value` in `accept`/`decline`, tutti con `version` da `app_settings`, `accepted_at` timestamp.
- [ ] `ip_address` e `user_agent` valorizzati server-side.
- [ ] Audit: riga `booking.completed` con `from_state='awaiting_completion'`, `to_state='awaiting_payment'`, `actor_type='representative'`. Riga `stripe.skipped` loggata con il placeholder session id.
- [ ] Submit → redirect a `/payment/pending` con messaggio placeholder.
- [ ] Submit con consenso mancante o validazione fiscale fallita (CAP, CF, P.IVA, SDI) → errori inline, nessuna mutazione DB.

### Settings reali (`/admin/settings`)

- [ ] La pagina mostra i valori reali di `public.app_settings` (`accountant_email`, `review_url`, `review_email_enabled`, le 5 version string, le finestre tempi in sola lettura).
- [ ] Salvataggio di un nuovo `accountant_email` valido → riga `app_settings` aggiornata, cache settings invalidata, toast "Impostazioni salvate".
- [ ] Salvataggio con email invalida → errore inline, nessuna mutazione DB.
- [ ] Toggle `review_email_enabled` persiste in DB.
- [ ] Modifica delle 5 version string persiste in DB; il submit pubblico successivo registra in `consents_jsonb` le nuove versioni.

### Mock decommission

- [ ] `rg "@/lib/mock" app/` mostra **solo** `app/admin/exports/` e `app/payment/cancel/` (fuori scope di questa fase).
- [ ] `rg "mockCurrentAdmin|mockEvents|mockAdmins" app/` non trova match nelle pagine reali.
- [ ] `/admin/dashboard`, `/admin/events*`, `/admin/prenotazioni/[id]`, `/admin/settings`, `/admin/login`, `/embed/[slug]`, `/complete/[token]`, `/payment/pending` non importano il mock store.

### Build / lint / regressioni

- [ ] `pnpm typecheck` pulito.
- [ ] `pnpm lint` pulito.
- [ ] `pnpm build` pulito.
- [ ] `pnpm rls:check` ancora verde.
- [ ] `grep -r SUPABASE_SERVICE_ROLE_KEY .next/static/` non trova match.

### Verifica DB / audit post-smoke (via Supabase MCP)

- [ ] `select status, count(*) from public.booking_requests group by 1;` riflette le azioni effettuate.
- [ ] `select status, revision, completion_token_hash is not null as has_hash from public.bookings;` mostra i token sempre hashati e revisioni coerenti con gli edit fatti.
- [ ] `select action, count(*) from public.audit_log group by 1 order by 2 desc;` contiene almeno: `request.created`, `request.accepted`, `request.rejected`, `request.waitlisted`, `booking.created`, `booking.edited_pre_payment`, `booking.completed`, `side_effect.email.E2`, `side_effect.stripe.skipped`.
- [ ] `select action, metadata->>'email_id', metadata->>'status' from public.audit_log where action like 'side_effect.email.%' order by created_at desc limit 10;` mostra gli id email attesi (E1, E2, E3, E4, E5, E8) con `status='sent'` o `status='failed'`.
- [ ] `select stripe_session_id from public.bookings where stripe_session_id is not null;` mostra solo valori con prefisso `placeholder_`.

---

## Phase: Resend integration

Spuntare quando la fase Resend è applicata. Pre-requisiti: `.env.local`
contiene `RESEND_API_KEY` (prefisso `re_`), `RESEND_FROM_EMAIL` con dominio
verificato in Resend, `RESEND_REPLY_TO_EMAIL` (opzionale), `CRON_SECRET`.

### Configurazione

- [ ] Dominio mittente verificato in Resend (DKIM, SPF, DMARC).
- [ ] `RESEND_API_KEY` valido (parte con `re_`).
- [ ] `RESEND_FROM_EMAIL` configurato come `Cooker Loft <noreply@dominio.verificato>`.
- [ ] In Vercel, `CRON_SECRET` impostato a 16+ caratteri casuali; `vercel.json` referenzia `/api/cron/review`.

### Smoke test end-to-end (in `Europe/Rome`)

- [ ] Toggle E1 ed E8 in Impostazioni: il salvataggio scrive `app_settings.requester_receipt_email_enabled` e `admin_new_request_email_enabled`.
- [ ] Embed submit → con E1 on: arriva email "Abbiamo ricevuto la tua richiesta" al richiedente. Con E1 off: niente E1.
- [ ] Embed submit → con E8 on: arriva email "Nuova richiesta" a ogni admin in `admin_users`. Con E8 off: niente E8.
- [ ] Accetta richiesta diretta → arriva E2 con link `/complete/<token>` cliccabile. Subject contiene "Richiesta accettata".
- [ ] Rifiuta richiesta → arriva E3 con copy neutra; la nota interna NON compare nel corpo.
- [ ] Metti in lista d'attesa → arriva E4 senza link di pagamento.
- [ ] Promuovi da lista d'attesa → arriva E5 con link di completamento. Subject contiene "posto disponibile".
- [ ] Modifica prenotazione (cambia numero persone) → su origin='direct' arriva E2 in variante `amendment` con nuovo link e copy "Il link precedente non è più valido"; il link vecchio porta a `/complete/[token]` con errore di lookup. Su origin='waitlist' arriva E5 amendment.
- [ ] Azione "Re-invia email di completamento" su prenotazione `awaiting_completion`: arriva nuovo invio (stessa email E2/E5, mode `initial`, stesso token); idempotency key timestamped.
- [ ] "Mostra link di completamento" e bottone Copia: il link mostrato corrisponde a quello dell'ultima email.

### Cron E9

- [ ] `GET /api/cron/review` senza header `Authorization` in produzione → 401.
- [ ] `GET /api/cron/review` con `Authorization: Bearer ${CRON_SECRET}` → 200 con `{ candidates: 0, sent: 0 }` finché non ci sono booking `paid`.
- [ ] Con `app_settings.review_url IS NULL` → la risposta contiene `reason: "review_url_null"`; nessuna email parte.
- [ ] Con `app_settings.review_email_enabled = false` → `reason: "review_email_disabled"`; nessuna email parte.
- [ ] (Quando Stripe è attivo) Booking `paid` con evento finito da >12h e `review_email_sent_at IS NULL` → E9 inviata, `bookings.review_email_sent_at` viene popolato.

### Verifica DB / audit

- [ ] `select status, count(*) from public.email_log group by 1;` mostra principalmente `sent`; gli eventuali `failed` hanno `error_message` non null.
- [ ] `select idempotency_key, email_id, status from public.email_log order by created_at desc limit 10;` riflette le azioni manuali smoke.
- [ ] Idempotency: invocare due volte la stessa transizione (es. accettare → resend manuale con stessa rev) NON genera duplicati con la stessa `idempotency_key`. La "Re-invia" admin usa una key timestamped quindi produce un nuovo row volutamente.
- [ ] `select metadata->>'completion_link_token' is not null as has_token from public.audit_log where action='booking.completion_link_issued' order by created_at desc limit 5;` mostra il token plaintext registrato (admin-only via RLS).
- [ ] `select action, metadata->>'status' from public.audit_log where action like 'side_effect.email.%' order by created_at desc limit 10;` mostra l'esito reale (`sent` / `failed`) e non più `placeholder: true`.

### Build / lint / regressioni Resend

- [ ] `pnpm typecheck` pulito.
- [ ] `pnpm lint` pulito.
- [ ] `pnpm build` pulito.
- [ ] `pnpm rls:check` ancora verde (la nuova `email_log` ha solo SELECT per `authenticated`; nessun INSERT/UPDATE/DELETE per role non-service).
- [ ] `grep -r RESEND_API_KEY .next/static/` non trova match.

---

## Phase: Stripe Checkout integration

Spuntare quando la fase Stripe è applicata. Pre-requisiti: account Stripe in
modalità test, `.env.local` con `STRIPE_SECRET_KEY=sk_test_…`, Stripe CLI
installato e autenticato (`stripe login`), forwarder attivo:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copiare il `whsec_…` stampato dal CLI in `STRIPE_WEBHOOK_SECRET`.

### Configurazione

- [ ] `STRIPE_SECRET_KEY` inizia con `sk_test_` in dev (mai `sk_live_` in `.env.local`).
- [ ] `STRIPE_WEBHOOK_SECRET` inizia con `whsec_` e proviene dalla sessione corrente di `stripe listen` (cambia ad ogni riavvio del CLI).
- [ ] In Vercel produzione, `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` configurati nel pannello (mai committati). Il webhook secret di produzione è quello permanente del dashboard Stripe (Developers → Webhooks → endpoint produzione).
- [ ] Su Stripe Dashboard (test e poi live): in "Settings → Payment methods" abilitati SOLO i metodi consentiti dal codice (`payment_method_types` in `src/server/stripe/checkout.ts`): `card` (include automaticamente Apple Pay / Google Pay sui device compatibili), `paypal`, `satispay`. Disabilitare tutto il resto per evitare che il default account possa contraddire la whitelist hard-coded.
- [ ] Per cambiare i metodi accettati: (1) modificare l'array `PAYMENT_METHOD_TYPES` in `src/server/stripe/checkout.ts`; (2) abilitare/disabilitare lo stesso elenco nel Stripe Dashboard. Un metodo nell'array ma disabilitato nel dashboard fa fallire la creazione della sessione, by design.
- [ ] L'endpoint webhook permanente in produzione punta a `https://<host>/api/stripe/webhook` e ascolta i 6 eventi gestiti: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`.

### Smoke test end-to-end (Stripe CLI attivo, in `Europe/Rome`)

- [ ] **Happy path (carta 4242 4242 4242 4242, qualsiasi CVC/scadenza futura, qualsiasi CAP)**: completion submit redirige direttamente a `checkout.stripe.com`. Dopo "Pay" → arriva su `/payment/success`. Entro pochi secondi la card mostra "Pagamento confermato"; admin detail page mostra `paid_at` valorizzato e link a `dashboard.stripe.com/test/checkout/sessions/<id>`.
- [ ] **Carta rifiutata `4000 0000 0000 0995` (always declined)**: Stripe mostra "Pagamento rifiutato"; cliccando "Torna" si arriva su `/payment/cancel`. La booking resta `awaiting_payment`, `paid_at` resta NULL.
- [ ] **3DS richiesto `4000 0027 6000 3184` (3DS2 frictionless / required)**: il flow di challenge si apre nello iframe Stripe; al successo → `/payment/success` → flip a `paid` come al solito.
- [ ] **Race webhook**: tornando su `/payment/success` prima che il webhook sia consumato (basta `stripe listen` con leggero delay), la pagina mostra "Pagamento in elaborazione" con spinner; entro 30s diventa "Pagamento confermato" senza interventi manuali.
- [ ] **Email E6**: dopo `paid` arriva una sola email "Pagamento ricevuto" con recap evento, importo, nome legale, città; arriva anche la receipt automatica di Stripe (sender stripe.com). E6 NON contiene CF/PIVA né indirizzo completo.
- [ ] **Email Stripe automatica**: la receipt di Stripe arriva alla stessa email del referente (configurata via `payment_intent_data.receipt_email`).

### Idempotency e replay

- [ ] **Replay dello stesso evento Stripe**: `stripe events resend <evt_id>` → la seconda risposta è `{ ok: true, deduplicated: true }`; `payments.status` resta `processed`; non parte una seconda E6. Verifica via:

  ```sql
  select status, count(*) from public.payments
  where stripe_event_id = '<evt_id>' group by 1;  -- expected: 1 row, processed.
  ```

- [ ] **Doppio click sul submit del completion form**: il secondo invio NON crea una seconda checkout session su Stripe (idempotency key `checkout:{bookingId}:rev{n}` collassa sul medesimo `cs_...`).
- [ ] **`stripe trigger checkout.session.completed`**: l'evento sintetico viene ricevuto, manca un `bookingId` valido → audit_log scrive `side_effect.stripe.webhook_ignored` con `reason: no_booking_reference` e nessun `payments` row viene scritto.

### Revision mismatch + amount mismatch

- [ ] Accetta una richiesta, completa fino a `awaiting_payment`. NON pagare. Da admin → "Modifica prima del pagamento" → cambia il numero di persone → conferma. La booking torna a `awaiting_completion`, il vecchio `cs_...` viene `expire`-ato su Stripe (verifica su Dashboard: status `expired`).
- [ ] Forza un pagamento sulla **vecchia** checkout session (riapri il URL salvato prima dell'edit). Stripe accetta il pagamento (la session era ancora "open" al momento dell'edit, è stata expire-ata dopo). Verifica:
  - `payments.status = ignored`.
  - `audit_log` contiene `side_effect.stripe.revision_mismatch` con `expected_revision != current_revision`.
  - La booking NON transita a `paid`.
  - NESSUNA E6 viene inviata.

### Self-service "Riprova pagamento" (`/payment/cancel`)

- [ ] Completa una booking, su Stripe clicca "Indietro" prima di pagare → arriva su `/payment/cancel`. La pagina mostra "Pagamento non completato".
- [ ] Cliccando "Riprova il pagamento" → redirect a una nuova `cs_test_...` valida; la booking resta `awaiting_payment`, `revision` invariata. `audit_log` ha `side_effect.stripe.session_recreated`.
- [ ] Scaduta una session manualmente da Dashboard Stripe → ritornando su `/payment/cancel` con `session_id=<expired>` → "Riprova pagamento" genera comunque una nuova session valida (il check `isUsable` rileva l'expiry e non riusa la vecchia).
- [ ] Se la booking è già `paid` quando si visita `/payment/cancel?session_id=<id>` → la pagina mostra "Pagamento già confermato"; nessun bottone di retry.

### Edit pre-payment con session attiva

- [ ] Caso `awaiting_payment` → "Modifica prima del pagamento": la session Stripe precedente risulta `expired` su Dashboard; `audit_log` ha `side_effect.stripe.session_expired` con `ok: true`. Il referente riceve E2/E5 amendment con il nuovo link.
- [ ] Caso `awaiting_completion` (nessuna session esistente): l'edit NON tenta di expire e non scrive il side-effect `session_expired`.
- [ ] Caso edit di soli `dietary_notes`/`special_occasion` (senza cambio persone): nessuna rotazione token, nessuna expire-session, nessuna E2/E5 amendment.

### Sicurezza webhook

- [ ] `POST /api/stripe/webhook` senza header `Stripe-Signature` → 400 `{ error: "invalid_signature", reason: "missing_signature_header" }`.
- [ ] `POST /api/stripe/webhook` con signature errata (manomessa) → 400 con `reason` non-vuoto. Stripe ripartirà col retry; il sistema NON deve transitare a `paid`.
- [ ] `POST /api/stripe/webhook` con body di un evento valido ma timestamp >5min nel passato (Stripe CLI flag `--latency`) → 400 (replay attack difesa).
- [ ] In produzione, la route `/api/stripe/webhook` risponde `200 OK` ad eventi processati o ignorati, e SOLO `400` per signature failure (Stripe documenta che 4xx fa retry; usiamo 400 solo per misconfig).

### Verifica DB / audit

- [ ] `select status, stripe_event_type, count(*) from public.payments group by 1, 2;` mostra principalmente `processed` per `checkout.session.completed`; eventuali `ignored` correlati a revision mismatch o `payment_status != paid`.
- [ ] `select action, metadata->>'stripe_event_id' from public.audit_log where action like 'side_effect.stripe.%' order by created_at desc limit 20;` mostra la sequenza degli eventi reali (received → checkout_created / session_recreated / webhook_received / session_expired / revision_mismatch / webhook_ignored).
- [ ] `select stripe_event_id, count(*) from public.payments group by 1 having count(*) > 1;` ritorna 0 righe (unique constraint funzionante).
- [ ] Nessuna riga su `audit_log` con `action = 'booking.paid'` e `actor_type != 'webhook'` (solo il webhook scrive `paid`).

### Build / lint / regressioni Stripe

- [ ] `pnpm typecheck` pulito.
- [ ] `pnpm lint` pulito.
- [ ] `pnpm build` pulito (route `/api/stripe/webhook` listata come `nodejs` runtime).
- [ ] `pnpm rls:check` ancora verde (la tabella `payments` resta scrivibile solo dal service-role).
- [ ] `grep -r STRIPE_SECRET_KEY .next/static/` non trova match.

---

## Phase: XML SDI export

Spuntare quando la fase XML export è applicata. Pre-requisiti:

- `xmllint` installato (`brew install libxml2` su macOS, `apt-get install libxml2-utils` su Linux). Il binario è già preinstallato su macOS.
- `reference/xml/Schema_VFPR12.xsd` (+ `xmldsig-core-schema.xsd`) presenti localmente. Sono ignorati da git, scaricati una tantum dallo sviluppatore.
- Account `fatturacheck.it` accessibile via browser (no API).
- `app_settings.accountant_email` valorizzato con la casella reale del commercialista.
- `app_settings.next_invoice_number` e `app_settings.current_invoice_year` allineati con il commercialista (placeholder seedato).
- Bucket Storage `xml-exports` esistente e privato.
- `RESEND_API_KEY` valido (l'email E10 viaggia su Resend).
- `CRON_SECRET` configurato (per la rotta `/api/cron/xml-export`).

### Pre-flight (una tantum prima del go-live)

- [ ] `pnpm test:xml` verde (unit test su rounding, breakdown, validate, xml-builder).
- [ ] `pnpm xml:fixtures` genera tutti gli XML in `tmp/xml-fixtures/`.
- [ ] `pnpm xml:validate` ritorna `OK` per ogni fixture (validazione XSD ufficiale via `xmllint`).
- [ ] Carica almeno **3 fixture rappresentative** su [fatturacheck.it](https://www.fatturacheck.it/): `company_b2b_with_sdi.xml`, `private_b2c_torino.xml`, `private_b2c_with_long_description.xml`. Esito: verde su tutte.
- [ ] `select next_invoice_number, current_invoice_year from public.app_settings;` mostra i valori concordati col commercialista.

### Form privati vs aziende (precondizione per XML corretto)

- [ ] In `/complete/<token>` con `Tipo cliente = Privato`: appaiono input separati `Nome` (`firstName`) + `Cognome` (`lastName`); NON appare il campo `Denominazione`. Il submit salva entrambi i campi su `fiscal_profiles`.
- [ ] In `/complete/<token>` con `Tipo cliente = Azienda`: appare un singolo `Denominazione/Ragione sociale` (`legalName`); NON appaiono `Nome`/`Cognome`.
- [ ] Submit privato senza `firstName` o senza `lastName` → errore inline, nessuna mutazione su `bookings`.
- [ ] Submit azienda senza `vatNumber` o senza (`sdiCode` `OR` `pecEmail`) → errore inline; in particolare:
  - `sdiCode` lunghezza ≠ 7 → errore.
  - `vatNumber` non 11 cifre → errore.
  - `taxCode` non 16 alfanumerici (privati) → errore.

### Preview XML live (`/admin/exports`)

- [ ] Sezione "Invio per selezione": cliccando il bottone **XML** su una riga si apre l'anteprima XML reale per quel singolo booking (chiamata a `/api/xml-export/preview`).
- [ ] L'anteprima contiene `<Numero>YYYY/PREVIEW</Numero>` (placeholder, mai un progressivo reale) → conferma che la preview NON consuma numerazione.
- [ ] Su un booking senza fiscal profile o non pagato → l'endpoint risponde 404 con messaggio user-friendly (la card mostra il testo dell'errore in rosso).
- [ ] Su un booking ben formato → l'anteprima passa anche `xmllint --schema reference/xml/Schema_VFPR12.xsd` (salva il testo in `tmp/preview.xml` e validalo manualmente).

### Test 1 — Selezione privato (B2C)

1. Crea una richiesta su `/embed/<slug>` come privato.
2. Da admin → accetta.
3. Completa `/complete/<token>` con `kind=private`, CF italiano, indirizzo Torino.
4. Paga via Stripe (carta test `4242 4242 4242 4242`).
5. Su `/admin/exports`: la card "Invio per selezione" mostra la nuova riga. Selezionala → "Invia selezione al commercialista".

Verifica:

- [ ] Toast verde `Export inviato (1 fattura).` (o equivalente).
- [ ] La tabella "Invii passati al commercialista" mostra una nuova riga con `status=Consegnato` e `Fatture=1`.
- [ ] Clic su "Zip": parte download di `cooker-loft-fatture-<periodo>.zip` con dentro 1 XML + `manifest.csv` + `manifest.json`.
- [ ] L'XML estratto valida verde su [fatturacheck.it](https://www.fatturacheck.it/).
- [ ] `CessionarioCommittente/DatiAnagrafici/Anagrafica` contiene `<Cognome>` + `<Nome>`, NON `<Denominazione>`.
- [ ] `CodiceDestinatario` = `0000000`.
- [ ] Email E10 ricevuta al `accountant_email` configurato, con link signed URL valido.

### Test 2 — Selezione azienda con SDI (B2B)

Ripeti Test 1 ma in completion scegli `kind=company`, inserisci P.IVA 11 cifre + SDI 7 alfanumerici.

- [ ] L'XML valida verde su fatturacheck.it.
- [ ] `CessionarioCommittente/DatiAnagrafici/Anagrafica` contiene `<Denominazione>`, NON `<Cognome>`/`<Nome>`.
- [ ] `CodiceDestinatario` = SDI inserito (7 char).
- [ ] `IdFiscaleIVA` valorizzato (`IdPaese=IT`, `IdCodice=<piva>`).

### Test 3 — Azienda con PEC senza SDI

Completion con `kind=company`, P.IVA valida, `sdiCode=""`, `pecEmail` valida.

- [ ] L'XML valida verde su fatturacheck.it.
- [ ] `CodiceDestinatario` = `0000000`.
- [ ] `<PECDestinatario>` presente in `DatiTrasmissione` (oppure PEC in `<Contatti>`, a seconda del builder).

### Test 4 — Due bookings nello stesso mese (numerazione progressiva)

Crea 2 bookings pagati nello stesso mese. Esportali entrambi insieme (selezione doppia o export mensile).

- [ ] Lo zip contiene 2 XML + 1 manifest.
- [ ] I `<Numero>` sono `<anno>/0001` e `<anno>/0002` (o `0003`/`0004` se ci sono già state fatture precedenti). Verifica che il counter avanzi di esattamente +2.
- [ ] `app_settings.next_invoice_number` post-export = pre-export + 2.

### Test 5 — Idempotency / re-export dello stesso periodo

Subito dopo Test 4, rilancia "Esegui adesso" sul mese in corso (o riavvia un export di selezione sulle stesse 2 prenotazioni).

- [ ] Toast `Nessuna nuova prenotazione da esportare.` (status `skipped`).
- [ ] `select count(*) from public.xml_export_items where booking_id in (<id1>, <id2>);` ritorna ancora `2` (le righe NON vengono duplicate).
- [ ] `app_settings.next_invoice_number` invariato (no waste di numerazione).
- [ ] In "Invii passati": al massimo una nuova riga con `status=Generato` o nessuna riga nuova, a seconda della strategia (il piano prevede skip senza nuovo `xml_exports`).

### Test 6 — Prenotazione pagata + cancellata operativamente

Su una booking `paid`, esegui da admin "Cancella dopo pagamento" (segna `cancelled_after_payment_at`). Ri-esegui un export di selezione includendola.

- [ ] L'XML viene generato comunque (la fattura non si annulla automaticamente, va emessa).
- [ ] `manifest.csv`: la riga corrispondente ha colonna `operationallyCancelled=true` e `note` valorizzata se presente.
- [ ] `manifest.json`: stesso flag, idem.

### Test 7 — Cron mensile

Simula la chiamata cron dal terminale:

```bash
curl -i \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "https://<host>/api/cron/xml-export"
```

- [ ] Senza header `Authorization` → 401.
- [ ] Con header valido ma `app_settings.xml_export_cron_enabled=false` → 200 con `reason: "cron_disabled"`, nessun export creato.
- [ ] Con header valido + cron abilitato: l'endpoint calcola i bounds Europe/Rome del mese precedente, esegue `runXmlExport`, e logga su `audit_log` la sequenza completa (`generate_start`, `generate_complete`, `email_success`).
- [ ] Su una seconda chiamata (stesso periodo) ritorna `skipped` o NON ri-genera (idempotency su `xml_export_items.booking_id`).
- [ ] `app_settings.xml_export_last_run_at` aggiornato al timestamp dell'ultima esecuzione.

### Test 8 — Rounding edge case (IVA inclusa)

Crea una booking con `amount_paid_cents=24000` (lordo 240,00 €) e VAT 22%. Esportala.

- [ ] L'XML ha `<ImponibileImporto>196.72</ImponibileImporto>` e `<Imposta>43.28</Imposta>`.
- [ ] Somma esatta: `196.72 + 43.28 = 240.00`.
- [ ] `<ImportoTotaleDocumento>240.00</ImportoTotaleDocumento>`.
- [ ] L'XML valida su fatturacheck.it senza warning sulla somma.

### Test 9 — Year reset

(In ambiente di staging, ribattezzando temporaneamente la data sistema, oppure manualmente con SQL.)

- [ ] Aggiorna `app_settings.current_invoice_year` a un anno passato (es. `2025`) e `next_invoice_number` a un numero alto (es. `87`).
- [ ] Esegui un export con `paid_at` che ricade nell'anno corrente (es. `2026`).
- [ ] L'RPC `reserve_invoice_number(2026)` rileva il cambio anno → resetta a `1`, restituisce `2026/0001`.
- [ ] `app_settings.current_invoice_year = 2026`, `app_settings.next_invoice_number = 2`.
- [ ] L'XML contiene `<Numero>2026/0001</Numero>`.

### Re-invia (resend without regenerate)

- [ ] Su una riga "Inviato" della tabella "Invii passati": clic su "Re-invia". Toast verde. Email E10 ri-consegnata al commercialista con lo **stesso** zip (link signed URL nuovo, contenuto identico).
- [ ] `audit_log` riceve `xmlExportResent` con `actor_id` admin.
- [ ] Nessun nuovo XML/zip generato, `app_settings.next_invoice_number` invariato.

### Sicurezza / regressioni

- [ ] Lo zip in Storage `xml-exports/<year>/<export_id>.zip` NON è accessibile in pubblico (bucket privato). Solo via signed URL.
- [ ] L'endpoint `/api/xml-export/preview` senza sessione admin → 401/redirect.
- [ ] `/api/cron/xml-export` senza `CRON_SECRET` → 401.
- [ ] `pnpm typecheck` pulito.
- [ ] `pnpm lint` pulito.
- [ ] `pnpm build` pulito.
- [ ] `pnpm test:xml` verde.
- [ ] `pnpm rls:check` ancora verde (le nuove `xml_exports`, `xml_export_items` scrivibili solo da service role).

### Verifica DB / audit XML

- [ ] `select status, count(*) from public.xml_exports group by 1;` mostra principalmente `emailed` per le run di successo, eventuali `failed` con `error_message` non null.
- [ ] `select x.period_start, x.period_end, count(i.id) as items from public.xml_exports x left join public.xml_export_items i on i.xml_export_id = x.id group by 1,2 order by x.period_start desc limit 10;` riflette correttamente il numero di fatture per export.
- [ ] `select action, count(*) from public.audit_log where action like 'xml_export.%' group by 1 order by 2 desc;` mostra `xml_export.generate_complete`, `xml_export.email_success`, `xml_export.skipped`, ecc.
- [ ] `select action, metadata->>'export_id' from public.audit_log where action like 'xml_export.%' order by created_at desc limit 20;` mostra la sequenza coerente.
- [ ] `select idempotency_key, status from public.email_log where entity_type='xml_export' order by created_at desc limit 10;` mostra le E10 con `status='sent'` e idempotency key `xml_export_email:<export_id>`.
