# DEPLOY — Cooker Loft V1 su Vercel

Guida operativa al go-live in produzione. Aggiornata alla fase
"Production deploy" (Stripe sandbox + dominio Vercel di default).

## 0. Prerequisiti

- Account Vercel collegato al repository Git.
- Account Supabase con il project `cooker-loft-v1` esistente (lo
  stesso usato in dev — separeremo dopo se servirà).
- Account Stripe in modalità **TEST** (sandbox). Lo switch a LIVE
  richiede solo la sostituzione di 2 env vars, niente redeploy.
- Account Resend con dominio email verificato (DKIM/SPF/DMARC OK).
- `CRON_SECRET` generato localmente: `openssl rand -hex 32`.

## 1. Pre-flight locale

Prima di pushare:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:xml
pnpm test:lib
pnpm rls:check
pnpm build
```

Tutti i comandi devono finire `exit 0`. Se `rls:check` fallisce,
NON deployare: significa che la tabella anon-reachable leakerebbe in
produzione.

## 2. Import del progetto su Vercel

1. Dashboard Vercel → **Add New → Project** → seleziona il repo.
2. Framework preset: **Next.js** (autodetected).
3. Build & Output settings: **lascia i default**.
4. Root directory: `./` (default).
5. Node version: `22.x` (LTS corrente, già pinned via `package.json` → `engines.node`). Evita major open-ended (`>=20`) per non subire upgrade automatici sulla prossima major Node.
6. Skip "Deploy" alla prima schermata: vogliamo prima le env.

## 3. Environment variables (scope: Production)

Vercel → Project → **Settings → Environment Variables**. Tutte le
variabili sono `Production` only (in `Preview`/`Development` Vercel
userà i fallback locali / .env.local).

### Supabase

```
SUPABASE_URL                = https://<project>.supabase.co
SUPABASE_ANON_KEY           = <chiave anon dal dashboard Supabase>
SUPABASE_SERVICE_ROLE_KEY   = <chiave service_role dal dashboard Supabase>
```

Sono server-only: NON usare il prefisso `NEXT_PUBLIC_` e NON committarle
mai. `SERVICE_ROLE_KEY` bypassa RLS — trattala come la password root
del DB.

### Stripe (TEST mode)

```
STRIPE_SECRET_KEY      = sk_test_...
STRIPE_WEBHOOK_SECRET  = whsec_...     # vedi §5 — generato DOPO il primo deploy
```

Quando passerai a LIVE: cambia solo queste due variabili (con `sk_live_`
e il `whsec_` del webhook permanente di produzione live).

### Resend

```
RESEND_API_KEY        = re_...                                                  # https://resend.com/api-keys
RESEND_FROM_EMAIL     = Cooker Loft <noreply@mail.cookergirl.com>               # dominio verificato
RESEND_REPLY_TO_EMAIL = hello@cookergirl.com                                    # opzionale
```

Il dominio (`mail.cookergirl.com`) deve avere DKIM + SPF + DMARC
verificati nel pannello Resend prima del primo invio reale.

### App

```
APP_BASE_URL              = https://<project>.vercel.app
ACCOUNTANT_FALLBACK_EMAIL = commercialista@example.com
VENUE_CONTACT_EMAIL       = hello@cookergirl.com
```

`APP_BASE_URL` deve corrispondere ESATTAMENTE all'host che Vercel
assegna al progetto (lo vedi nel dashboard sotto "Domains"). Quando in
futuro aggiungerai un dominio custom, aggiorna questa variabile e
ridistribuisci.

### Cron

```
CRON_SECRET = <openssl rand -hex 32>
```

Vercel Cron invia automaticamente `Authorization: Bearer ${CRON_SECRET}`
a tutti gli endpoint dichiarati in `vercel.json` quando l'env è settata.
Se non la setti, i cron endpoint rifiuteranno tutto in produzione.

## 4. Primo deploy

1. Premi "Deploy" da Vercel.
2. Attendi il completamento della build. Eventuali errori sono
   riconducibili a env mancanti — lo schema zod in `src/server/env.ts`
   spiega quale.
3. Apri l'URL `https://<project>.vercel.app/`. Deve renderizzare la
   landing senza errori.

## 5. Configurazione Stripe Dashboard (TEST)

### 5.1 Payment methods

Dashboard Stripe (TEST) → **Settings → Payment methods**.

Lascia abilitati SOLO i metodi che vogliamo offrire ai clienti:

- `card` (Visa/Mastercard/Amex) — include automaticamente **Apple Pay**
  e **Google Pay** sui device che li supportano.
- `paypal`
- `satispay` (verifica la commissione in dashboard; se ritenuta troppo
  alta, disabilita qui e rimuovi `"satispay"` da
  `PAYMENT_METHOD_TYPES` in `src/server/stripe/checkout.ts`).

Disabilita tutto il resto. Un metodo presente nel codice
(`payment_method_types` in `checkout.ts`) ma disabilitato nel
dashboard fa fallire la creazione della sessione, by design.

### 5.2 Webhook endpoint produzione

Dashboard Stripe (TEST) → **Developers → Webhooks → Add endpoint**.

- **Endpoint URL**: `https://<project>.vercel.app/api/stripe/webhook`
- **Events to send**: seleziona ESATTAMENTE i 6 eventi gestiti:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`

Crea l'endpoint, poi clicca **"Reveal signing secret"** e copia il
valore (`whsec_…`). Incollalo in Vercel come `STRIPE_WEBHOOK_SECRET` e
**triggera un re-deploy** (Vercel non hot-reloada le env).

## 6. Configurazione Resend

1. Resend Dashboard → **Domains → Add domain** (es. `mail.cookergirl.com`).
2. Segui il wizard per inserire i record DNS (DKIM TXT, SPF TXT,
   DMARC TXT) sul DNS del dominio principale.
3. Attendi la verifica (di solito < 1h).
4. Domain status deve essere **Verified** prima del primo invio reale.
5. Crea (o riusa) un API key in **API Keys** con scope `Sending access`.

## 7. Smoke test end-to-end in produzione

Ordine consigliato dopo che webhook + email sono configurati:

1. **Embed**: incolla `<iframe src="https://<project>.vercel.app/embed/<slug>" />`
   su una pagina test di `loft.cookergirl.com` (il CSP `frame-ancestors`
   è già impostato per questo origin). Verifica che si carichi.
2. **Submit richiesta** dal form. Deve arrivare l'email **E1**
   "Richiesta ricevuta" all'indirizzo inserito.
3. **Admin**: `https://<project>.vercel.app/admin/login` → login con
   un utente presente in `admin_users`.
4. **Accetta** la richiesta → arriva email **E2** "Richiesta accettata"
   con link `/complete/<token>`.
5. **/complete/[token]** → compila il form, conferma. Si apre la
   Stripe Checkout.
6. Paga con la carta test `4242 4242 4242 4242` (CVC qualsiasi, data
   futura, CAP qualsiasi).
7. Stripe redirige su `/payment/success`. Entro pochi secondi appare
   "Pagamento confermato" e arriva email **E6** "Conferma pagamento".
8. Admin → dashboard mostra `paid_at` valorizzato sulla prenotazione.
9. Apri **Stripe Dashboard → Developers → Events**: il webhook su
   `checkout.session.completed` deve risultare 200 OK.
10. **Cron review** (manuale): `curl -H "Authorization: Bearer
    $CRON_SECRET" https://<project>.vercel.app/api/cron/review` → 200.
11. **Cron xml-export** (manuale): `curl -H "Authorization: Bearer
    $CRON_SECRET" https://<project>.vercel.app/api/cron/xml-export`
    → 200 (con o senza prenotazioni paid del mese precedente).
12. **Admin → Esportazioni XML** → genera un export → verifica su
    fatturacheck.it che il file generato sia valido.

Se tutto passa, taggare la commit:

```bash
git tag v1.0.0-prod-sandbox
git push origin v1.0.0-prod-sandbox
```

## 8. Rate limiting / security note

- Le RLS sono ora "admin-only" su tutte le tabelle operazionali
  (migration `20260528120000_rls_admin_only_select.sql`).
- Tutti i form pubblici hanno rate limit Postgres-backed (migration
  `20260528130000_rate_limit_buckets.sql`). Non serve Upstash / KV
  esterna.
- Webhook Stripe usa `maxDuration = 30` (configurato come Route Segment Config in `app/api/stripe/webhook/route.ts`, non in `vercel.json`: per l'App Router il pattern `functions` di `vercel.json` non matcha `app/api/.../route.ts`)
  per evitare timeout in worst case.
- Header globali: HSTS, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy. `frame-ancestors` ristretto a cookergirl.com per
  `/embed/*`, e `'none'` (anti-clickjacking) per tutto il resto.

## 9. Switch a Stripe LIVE (futuro)

Quando vorremo passare ai pagamenti reali:

1. Crea un nuovo webhook endpoint in **Stripe LIVE** (stessa URL,
   stesso elenco di 6 eventi). Copia il nuovo `whsec_…`.
2. Su Vercel sostituisci:
   - `STRIPE_SECRET_KEY` con la chiave `sk_live_…`
   - `STRIPE_WEBHOOK_SECRET` con il nuovo `whsec_…` LIVE
3. Re-deploy. Codice invariato.
4. PRIMA dello switch: implementare il job di reconciliation Stripe
   (poll periodico delle sessioni "stranded" per detectare webhook
   mancati) — è il prossimo step di sviluppo, oggi non c'è.

## 10. Rollback

Vercel mantiene la lista dei deploy precedenti in
**Deployments → Production**. In caso di problema, clicca
"Promote to Production" su un deploy noto come funzionante. La
rollback è istantanea (atomic alias swap). Il DB resta com'è — eventuali
migration applicate non vengono rollbackate automaticamente, vanno
gestite a mano (idealmente: solo migration forward-compatible).
