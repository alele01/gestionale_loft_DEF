# Cooker Loft V1

Gestionale prenotazioni Cooker Loft V1. Le fonti di verità del prodotto
vivono sotto [`docs/`](./docs); lo stato corrente del lavoro e la roadmap
condensata sono in [`docs/CURRENT_PHASE.md`](./docs/CURRENT_PHASE.md). Il
piano di verifica operativa è in
[`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md).

Stato attuale (vedi [`docs/CURRENT_PHASE.md`](./docs/CURRENT_PHASE.md) per il dettaglio):

- Static UI mockup completed and validated.
- Supabase Foundation completed.
- Real Supabase project created (`cooker-loft-v1`).
- Initial database migration applied.
- RLS baseline implemented.
- Generated Supabase TypeScript types available in
  [`src/server/supabase/database.types.ts`](./src/server/supabase/database.types.ts).
- Mock UI is still partially decoupled from the real DB.

Per lo **schema tecnico del database** la fonte di verità è il database
reale Supabase + [`supabase/migrations/*`](./supabase/migrations) +
[`src/server/supabase/database.types.ts`](./src/server/supabase/database.types.ts).
Non usare i documenti sotto [`docs/archive/`](./docs/archive) come SoT.

## Avvio rapido

```bash
pnpm install

# Copia il template di env e popola .env.local con i valori reali (vedi sotto).
cp .env.example .env.local

# Verifica che Supabase RLS neghi anon su tutte le tabelle operational.
pnpm rls:check

pnpm dev
```

L'app parte su `http://localhost:3000` e reindirizza a `/admin/dashboard`.

## Script disponibili

```bash
pnpm dev          # dev server Next.js
pnpm build        # build di produzione
pnpm start        # serve la build
pnpm typecheck    # tsc --noEmit su tutto il repo
pnpm lint         # next lint
pnpm rls:check    # smoke check: il role anon di Supabase deve restituire 0 righe su ogni operational table
```

## Setup locale (env)

`.env.local` è git-ignored. Il template completo è in
[`.env.example`](./.env.example). Vedi [`docs/SECURITY.md`](./docs/SECURITY.md)
§8 per l'inventario completo dei segreti.

Variabili richieste in Phase 0/1:

| Variabile | Sorgente |
|-----------|----------|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API ("publishable") |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API ("service_role", **secret**) |
| `APP_BASE_URL` | `http://localhost:3000` in locale, dominio reale in produzione (Vercel) |

Tutte le env del backend sono server-only. Non è esposta alcuna variabile
`NEXT_PUBLIC_` al bundle del client (Supabase è chiamato solo da server code).

## Database reale (Supabase)

- Progetto: `cooker-loft-v1` (region `eu-west-1`).
- Migrations in [`supabase/migrations/`](./supabase/migrations):
  - `20260520120000_init_schema.sql` — tutte le tabelle V1 (10), indici,
    CHECK, trigger (`prevent_paid_edits`, `prevent_revision_decrement`,
    `enforce_operational_cancel_invariants`, `prevent_fiscal_edits_after_paid`,
    `set_updated_at`), RLS abilitata su ogni tabella, seed `app_settings`.
  - `20260520120100_harden_function_search_path.sql` — fix advisor di sicurezza
    Supabase (`function_search_path_mutable`).
- Type definitions TypeScript generate automaticamente in
  [`src/server/supabase/database.types.ts`](./src/server/supabase/database.types.ts).

Per rigenerare i tipi dopo una nuova migration:

```bash
# via Supabase MCP (preferito)
# oppure via CLI:
supabase gen types typescript --project-id rllxnuolnuaormcfumlc \
  > src/server/supabase/database.types.ts
```

## Struttura server-side

```
src/server/
├── env.ts                        # validazione zod di .env (server-only)
└── supabase/
    ├── admin.ts                  # service-role client (server-only, bypassa RLS)
    ├── database.types.ts         # tipi generati
    └── index.ts                  # barrel pubblico
```

Il client service-role è dichiarato ma **non ancora importato** da
componenti UI: in Phase 4 verrà chiamato esclusivamente dal modulo state
machine (`src/modules/booking-state/`) e dai webhook handler. Vedi
[`docs/SECURITY.md`](./docs/SECURITY.md) §9.

## Mappa delle route (mockup attuale)

### Admin (mock — nessuna auth, nessun DB)

- `/admin/login` — login visuale
- `/admin` → redirect a `/admin/dashboard`
- `/admin/dashboard` — eventi, contatori, ultime richieste
- `/admin/events` — elenco + creazione/modifica eventi
- `/admin/events/[eventId]` — dettaglio evento, embed, tab per stato prenotazione
- `/admin/prenotazioni/[id]` — pagina unica di dettaglio prenotazione
- `/admin/exports` — invio automatico mensile, manuale per periodo, per selezione
- `/admin/settings` — email commercialista, link recensione, versioni documenti

### Public (mock)

- `/embed/[eventSlug]` — modulo pubblico per WordPress (iframe-friendly)
- `/complete/[token]` — pagina di completamento pre-pagamento
- `/payment/success` / `/payment/cancel` — placeholder ritorno Stripe

## Cosa NON è ancora collegato

Hard rule: la UI mock resta operativa. Le fasi successive del task plan
introdurranno gradualmente le integrazioni reali.

- Nessuna auth Supabase wired (Phase 2).
- Nessuna route `/api/*` reale (Phase 4+).
- Nessuna chiamata Stripe (Phase 6) — niente SDK installato, niente webhook.
- Nessuna chiamata Resend (Phase 5) — niente template React Email.
- Nessun modulo XML reale (Phase 7).
- Le pagine mock continuano a leggere/scrivere su uno store React in memoria
  (`src/lib/mock/store.tsx`); azioni come accetta/rifiuta producono solo
  toast e cambi di stato locali.

## Documenti di riferimento

Documenti attivi (SoT):

- [`docs/CURRENT_PHASE.md`](./docs/CURRENT_PHASE.md) — stato corrente, roadmap condensata, prossima fase
- [`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md) — checklist operativa di verifica
- [`docs/PROJECT_BRIEF.md`](./docs/PROJECT_BRIEF.md) — scope V1, stack, flow end-to-end
- [`docs/NON_GOALS.md`](./docs/NON_GOALS.md) — cosa V1 esplicitamente NON fa
- [`docs/STATES.md`](./docs/STATES.md) — state machine prenotazioni + lifecycle eventi
- [`docs/EMAILS.md`](./docs/EMAILS.md) — template transactional Resend
- [`docs/SECURITY.md`](./docs/SECURITY.md) — token, RLS, webhook, secrets
- [`docs/XML_EXPORT.md`](./docs/XML_EXPORT.md) — modulo XML fatture
- [`docs/COMPLETION_PAGE_REFERENCE.md`](./docs/COMPLETION_PAGE_REFERENCE.md) — UX completion page

Documenti storici (solo riferimento, **non SoT**): [`docs/archive/`](./docs/archive)
contiene `TASK_PLAN.old.md`, `DB_SCHEMA.initial.md`, `TEST_PLAN.old.md`.
Per lo schema DB ispezionare il database reale + `supabase/migrations/*` +
`src/server/supabase/database.types.ts`.
