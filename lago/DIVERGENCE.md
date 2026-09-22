# Upstream divergence log

Single source of truth for every place this fork knowingly differs from
`marmelab/atomic-crm`. Each entry must explain **why** the divergence is
unavoidable and **what to re-check** when pulling a fresh upstream.

## Stewardship rules

1. All LAGO customisation should go through `<CRM>` props,
   extension points, or new files under `src/lago/...` (runtime) and
   `lago/...` (docs/config). Modifying any file under
   `src/components/atomic-crm/`, `src/components/admin/`, or
   `src/components/ui/` requires an entry here.
2. Before pulling upstream changes:
   - `git fetch upstream`
   - `git merge-tree $(git merge-base HEAD upstream/main) HEAD upstream/main`
     (or `git merge --no-commit --no-ff upstream/main`, then `git merge --abort`)
   - If conflicts appear in any divergence entry's file: review that
     entry, decide whether the divergence is still needed, and update.
3. Remove an entry as soon as the divergence is reverted.

## PostgREST embed rule (16. sep 2026)

PostgREST kan kun indlejre tabel B fra tabel A hvis der er en
foreign key én af vejene. `companies_lago` har ingen direkte FK til
`customer_activities_lago`, `impersonation_log_lago` eller `tasks` —
kun til `companies`. Skriv derfor aldrig `.select("..., companies_lago!inner(...)")`
direkte fra en tabel der ikke er `companies`; gå gennem `companies`:

    .from("customer_activities_lago")
    .select("id, company_id, companies!inner(id, name, extension:companies_lago!inner(segment, is_active))")
    .eq("companies.companies_lago.is_active", true)

Fejlen ligner et rettigheds- eller cacheproblem — den ekstakte tekst
er "Could not find a relationship between '<a>' and '<b>' in the
schema cache." Det er aldrig cachen; det er FK'en der mangler.

Fanget tre gange: `tasks`→`sales` (brief 27 tillæg A), 
`impersonation_log_lago`→`sales` (samme brief), og
`customer_activities_lago`→`companies_lago` (brief 35 §6 hotfix).
Reglen står nu her.

## Tailwind arbitrary values skal verificeres i browseren (17. sep 2026)

En vilkårlig Tailwind-værdi (`[...]`-syntaks) tæller ikke som bygget
før `getComputedStyle` siger det rigtige — ikke fordi klassen står i
markup. Tailwind fejler tavst: klassen ryger med i output, men CSS-en
er tom hvis værdien er ugyldig.

**Fejlmønstre fanget indtil nu:**

- `text-[var(--t-body)]` — læses som **farve**, ikke `font-size`. Skal
  være `text-[length:var(--t-body)]` når værdien er en længde (brief 49 §1).
  Kostede hele typeskalaen i to døgn før nogen målte.
- `[@media(hover:hover)and(pointer:fine)]:min-h-8` — mangler `_` for
  whitespace i arbitrary variants. Skal være
  `[@media(hover:hover)_and_(pointer:fine)]:min-h-8`. Uden underscore
  bliver betingelsen ugyldig CSS (mangler luft omkring `and`) og der
  genereres INGEN regel. Fanget i brief 58 tillæg B — 32/44 px-reglen
  virkede ikke selvom klassen stod i markup.

**Regel:** en vilkårlig værdi under `[...]` skal efterprøves med
`getComputedStyle(element).getPropertyValue('...')` mod den forventede
værdi. Klassen i markup er ikke bevis for at reglen er anvendt.
Tjek både at reglen produceres OG at den vinder specificitets-kampen
(en anden klasse kan overskrive).

## PostgREST server-side row-limit (22. sep 2026)

PostgREST har et server-side max-rows loft (default 1000). En
forespørgsel med `?limit=2000` eller `.limit(5000)` returnerer op til
1000 rækker **tavst** — ingen fejl, ingen advarsel. Content-Range-headeren
siger `0-999/1403`, men body er stille truncated.

Samme tavshed på supabase-js: `supabase.from(...).select(..., { count: 'exact' }).range(0, 4999)` overtrumfer ikke serverens loft.

**Fanget to gange:**

- **17. sep 2026** — kundelisten på 1.164 rækker med "Vis inaktive"
  slået til blev afkortet uden `range()`-paging. Symptom: liste-widget
  viste kun ~1.000 kunder selvom count sagde 1.164.
- **21. sep 2026 (brief 73 tillæg A)** — `customer_activities_lago`
  med 1.403 rækker blev grupperet på 995 + 5 = 1.000. De 403 rækker
  "manglede" og lignede en tredje source-værdi (NULL-bucket). Fandtes
  ikke — samme `visma_import`-bucket, bare uden for limit.

**Regel:** når en forespørgsel kan returnere > 1000 rækker, brug
Range-paging (`Range: 0-999`, `1000-1999`, ...) og sum-tjek klient-side
mod `count(*)` (fra Content-Range-headeren) FØR du aggregerer eller
rapporterer tal. Uenighed mellem total og sum af hentede rækker er
ALTID limit der lyver — aldrig data der er "spredt et sted ekstra".

I supabase-js: brug `range(from, to)` i løkker af 1000, ikke én
kald med `.limit(N)`. Uden Range-paging vil resultatet være
`count > body.length` med `body.length` altid ≤ 1000.

## Current divergences

### `src/App.tsx`

- **Type:** documented configuration point (not a true divergence).
- **Why:** Upstream's own jsdoc tells consumers to customise the app by
  passing props to `<CRM>`. We pass `disableTelemetry` and
  `i18nProvider={lagoI18nProvider}`.
- **Re-check on upstream merge:** if upstream adds new mandatory `<CRM>`
  props, mirror them here.

### `src/components/atomic-crm/root/CRM.tsx`

- **Type:** additive extension points — added optional `companyShow?: ComponentType`, `companyList?: ComponentType`, `contactShow?: ComponentType` and `contactList?: ComponentType` props to `CRMProps`, plumbed through to both `DesktopAdmin` and `MobileAdmin` so they override the default `companies` / `contacts` Resource show/list components when provided.
- **Why:** Domain-briefs 1 + 2 + 4 (kerne-kundebillede, prioritised customer list, and the light LAGO-tur on contacts) need fully LAGO-shaped components, and upstream's `<CRM>` exposed no per-resource override hooks. The changes are small and backwards-compatible (default behaviour unchanged when props are omitted); we mirror the same prop pattern for both resources.
- **Re-check on upstream merge:** if upstream itself adds `companyShow` / `companyList` / `contactShow` / `contactList` props with different semantics, reconcile. If upstream refactors the `<Resource name="companies" ...>` or `<Resource name="contacts" ...>` registration, re-thread the props. Consider upstreaming these hooks as a PR.

### `src/index.css`

- **Type:** targeted edit — three localised changes.
  - `@import "@fontsource-variable/inter";` removed.
  - `@import "./lago/theme/tokens.css";` and `@import "./lago/theme/bridge.css";` added directly after the Tailwind + tw-animate imports.
  - `@theme inline`'s `--font-sans` changed from `"Inter Variable", ...` to `var(--f-ui)` so Tailwind's `.font-sans` utility resolves to Helvetica Neue.
  - The hardcoded `body { font-family: "Inter Variable", ... }` block near the end of the file removed (bridge.css now owns body font).
- **Why:** LAGO's design system v2 (Domain-brief 17) requires Helvetica Neue as the sole family, zero webfont downloads, and remapping of Shadcn's color/radius/ring variables to LAGO tokens. `src/index.css` is the only entry point for global styles and Tailwind's `@theme inline` in this setup — the imports and the `--font-sans` value cannot be added from anywhere else. All actual token values and Shadcn-to-LAGO mappings live in `src/lago/theme/tokens.css` and `src/lago/theme/bridge.css`; this file only wires them in. Upstream's own `:root {}` oklch block is left intact and overridden via bridge's `:root:root` (specificity 0,0,2 vs 0,0,1). **The `.dark {}` block in `src/index.css` is deliberately not remapped in bridge** — LAGO has not decided on a dark theme yet (Domain-brief 17 explicitly defers this). If `<html class="dark">` gets set anywhere by accident, the app will render with Atomic's dark oklch palette, which will look wrong. When we do build a dark theme, add a `.dark:root` (or use `light-dark()` on each token) block to bridge.
- **Re-check on upstream merge:** if upstream changes the font family, removes `@theme inline`'s `--font-sans`, or restructures the top-of-file imports, re-thread the three edits. If upstream drops the `:root {}` oklch block entirely, the `:root:root` specificity hack in `bridge.css` becomes unnecessary and can be simplified to `:root`.

### `src/components/atomic-crm/login/LoginPage.tsx`

- **Type:** additive — én ekstra `useEffect` der læser `error` / `error_code` / `error_description` fra `location.search`, oversætter kendte Supabase-fejlkoder til dansk, notify'er brugeren og renser URL'en. Følger samme mønster som filens eksisterende `passwordRecoveryEmailSent`-effekt.
- **Why:** Auth-callback-interceptor'en (index.html + public/auth-callback.html) sender Supabase-fejl videre til `#/login?error=…&error_description=…` — typisk `otp_expired` når et recovery-link er brugt eller udløbet. Uden håndtering på login-siden kastede routeren params væk, brugeren så en tom login-skærm og prøvede det samme link igen. Kendte koder oversættes til dansk ("Linket er brugt eller udløbet. Bed om et nyt adgangskode-link."), ukendte falder tilbage til det rå `error_description` så en ny fejl-type ikke også bliver stille.
- **Re-check on upstream merge:** hvis upstream selv tilføjer error-håndtering på login-siden (fx via ra-supabase-core), fjern dobbelt-notifikationen. Hvis upstream ændrer `useNotify`-API'et eller tilføjer flere query-parametre, revurder cleanup-listen (`error`, `error_code`, `error_description`).

### `public/auth-callback.html`

- **Type:** targeted edit — én linje ændret.
  - `window.location.href = \`./#/auth-callback?...\`` → `\`./#/set-password?...\``.
- **Why:** Upstream-filen omdirigerer til hash-ruten `#/auth-callback`, som blev registreret i upstream's egen router-opsætning. CRM.tsx i denne fork registrerer kun `signup`, `confirmation-required`, `set-password`, `forgot-password`, `oauth-consent` som public routes. Ra-core's `<Admin authCallbackPage>` monterer `AuthCallback`-komponenten et andet sted end hash-ruten, så `#/auth-callback` matches ikke — routeren falder tilbage til login, og recovery-flowet (Supabase password-reset) kunne aldrig sætte adgangskoden. Vi peger derfor direkte på `#/set-password`, som SetPasswordPage håndterer via `useSupabaseAccessToken`. Rene tokens-flow, ingen mellemliggende callback-side.
- **Re-check on upstream merge:** hvis upstream tilføjer en `#/auth-callback` hash-route eller ændrer SetPasswordPage's kontrakt, revurder. Recovery-flowet er per definition password-reset — hvis nyt magic-link flow tilføjes (fx OAuth), skal auth-callback.html forgrene på `type`-parameteren i stedet for at hardcode `set-password`.

### `index.html`

- **Type:** targeted edit — three localised changes at the root HTML shell.
  - `<html lang="en">` → `<html lang="da">` (screen readers + browser hyphenation now treat content as Danish, which it is).
  - `<meta name="theme-color" content="#000000">` → `#F7F7F6` (iOS status-bar colour when the PWA is on the home screen — matches `--canvas`; the previous pitch-black looked wrong under the neutral flade in the field).
  - Loader spinner colours (visible before the JS bundle loads): `background: #fafafa` → `#F7F7F6` (three occurrences) and `.loader { color: #283593 }` → `#00A99B` (Atomic's indigo → LAGO's `--a` teal).
- **Why:** The loader is the *first* thing a user sees every time the app opens, so it must sit inside the design system. `index.html` is loaded before any CSS bundle, so `var(--canvas)` / `var(--a)` from `tokens.css` are not in scope — hex values are duplicated in-file with a comment pointing back to the token names for future upkeep. `lang` and `theme-color` are HTML shell attributes with no other entry point.
- **Re-check on upstream merge:** if upstream restyles the loader, restructures the shell (viewport meta, PWA meta tags), or changes `lang`, re-thread the three edits. Keep the loader hex in sync with `--a` and `--canvas` if those tokens ever shift.

### `supabase/config.toml`

- **Type:** additive — new `[functions.ai-adapter]` block appended after
  upstream's per-function configs.
- **Why:** Per-function `verify_jwt` is the only place this can be configured.
  Adding a new block is additive (no merge conflict unless upstream itself
  ships an `ai-adapter` function, which they will not).
- **Re-check on upstream merge:** if upstream adds more per-function blocks
  near the end of the file, ensure our `[functions.ai-adapter]` block stays
  intact and after them.

### `src/components/ui/dialog.tsx` and `src/components/ui/sheet.tsx`

- **Type:** targeted edit — one-line change per file.
  - `<span className="sr-only">Close</span>` → `<span className="sr-only">Luk</span>`
- **Why:** Shadcn's Dialog/Sheet primitives hardcode the close-button's
  screen-reader label as "Close". LAGO's UI is Danish (see
  `<html lang="da">`); screen readers should say "Luk", not "Close". No
  runtime translation hook is exposed by the primitives, and wrapping
  the entire Dialog/Sheet just to override two sr-only spans would be
  overkill for a one-word change. Brief 20 pkt 7 explicitly listed this
  as an English-string leak.
- **Re-check on upstream merge:** if upstream refactors the close-button
  markup or introduces an i18n hook for it, either re-apply the
  one-liner or switch to the hook and remove this entry.

### `public.tasks` — added FK `tasks_sales_id_fkey`

- **Type:** additive constraint on an Atomic-kernetabel. Added by migration `20260916000000_lago_26A_fields_and_tasks_fk.sql`.
  - `ALTER TABLE public.tasks ADD CONSTRAINT tasks_sales_id_fkey FOREIGN KEY (sales_id) REFERENCES public.sales(id) ON DELETE SET NULL;`
- **Why:** PostgREST-embedding requires a foreign key to resolve `tasks?select=*,sales(...)`. Kontor-dashboardets "Opfølgninger tildelt kontoret" (Simon får rollen 16. sep) fejlede med *"Could not find a relationship between 'tasks' and 'sales' in the schema cache"*. Constraint er additiv og bagud-kompatibel (upstream tasks kunne allerede have en sales_id-værdi der matcher en sales-række).
- **Re-check on upstream merge:** if upstream adds its own FK on `tasks.sales_id`, drop LAGOs (constraints kolliderer på navn eller definition). Ellers uændret.

### `src/components/atomic-crm/sales/SalesEdit.tsx`

- **Type:** targeted edit — én import + én toolbar-linje.
  - Added `import { ResendInviteButton } from "@/lago/settings/ResendInviteButton";`
  - `EditToolbar` renders `<ResendInviteButton />` alongside `<CancelButton />` and `<SaveButton />`.
- **Why:** Domain-brief 24 splits user creation from access grant. Nyoprettede brugere får ingen invitationsmail (default `send_invite: false` i `users` edge function). Adgang gives eksplicit senere via denne knap — så magic-linket ikke er udløbet når brugeren skal bruge det. Kunne have været bygget som separat LAGO-sales-flade, men det er én linje ændring for at give admin en klar knap i den flade der allerede er.
- **Re-check on upstream merge:** if upstream restyles the toolbar, adds its own resend button, or restructures the SalesEdit form layout, reconcile. The `ResendInviteButton` component lives in `src/lago/settings/` — that part is unaffected by upstream.

### `src/components/atomic-crm/companies/CompanyInputs.tsx`

- **Type:** targeted edit — replaced `<ReferenceInput source="sales_id">` with an explanation block.
- **Why:** Domain-brief 24 makes `companies.sales_id` a *derived* field — set by `derive_sales_id_from_visma()` from `companies_lago.visma_sales_code` on every VISMA customer import. Manual editing would drift the CRM out of sync with VISMA's master data. The block reads: *"Ejerskab styres i VISMA. Ret sælger-koden på kunden i VISMA; importen skriver den her ved næste kørsel."*
- **Re-check on upstream merge:** if upstream restyles the form or adds a required sales_id field, reconcile. The mapping table (`sales_code_map_lago`) and derive function live in LAGO's own schema files.

### `src/components/atomic-crm/providers/supabase/dataProvider.ts`

- **Type:** targeted edit — six `throw new Error("Failed to …")` sites replaced with `await readEdgeFunctionError(err)` from `@/lago/ui/errorMessage`. Sites: `signUp`, `salesCreate`, `salesUpdate`, `updatePassword`, `mergeContacts`, `uploadToBucket`.
- **Why:** #200 — supabase-js pakker Edge Function-fejl som `FunctionsHttpError` med body'en gemt på `error.context` (Response). Uden udpakning ser sælgeren *"Failed to update account manager"* i stedet for `"email already exists"` eller `"user not found"`. Fejlen har bidt fire gange (tasks→sales, impersonation_log_lago→sales, customer_activities_lago→companies_lago, kunde_aendringsforslag_lago→sales) — hver gang tavst, hver gang kostet timer. Beskederne er samtidig oversat til dansk fallback.
- **Re-check on upstream merge:** if upstream adds new Edge Function-call sites in dataProvider.ts, wrap their `throw` with the same helper. If upstream introduces its own error-unpacking helper, switch to it and remove this entry.

### `src/components/atomic-crm/companies/GridList.tsx`

- **Type:** targeted edit — `LoadingGridList` skeleton width.
  - `<div className="flex flex-wrap w-[1008px] gap-1">` (fixed 1008 px)
    → `<div className="w-full gap-2 grid" style={{gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))"}}>`
  - Skeleton child no longer has hardcoded `w-[194px]` (grid handles it).
- **Why:** The old skeleton was 1008 px wide inside a 375 px iPhone
  viewport → 633 px of horizontal overflow while the list loads. Ours
  matches the loaded grid's responsive layout so nothing shifts and
  nothing overflows during loading. The design system audit (Brief 20
  pkt 12) caught this via `documentElement.scrollWidth` measurement.
- **Re-check on upstream merge:** if upstream restyles the skeleton or
  the grid layout, keep the responsive skeleton in sync with the
  loaded state.

