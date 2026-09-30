# Mønster-eftersyn 16. sep 2026

Fem fejltyper vi har ramt gentagne gange i dag. Ingen ændringer i denne fil — kun kartotek, prioriteret efter om en sælger rammer det i felttesten (torsdag/fredag).

Prioritetsniveauer:
- **🔴 Rammer sælger direkte i felttesten** — retter før fredag
- **🟡 Rammer sælger sjældent eller kun i kant-tilfælde** — kan vente
- **⚪ Rammer kun admin / måler / senere sti** — efter felttest

---

## 1. Fejlbeskeder der skjuler fejlen

Kendt reglen: `err.message` viser sjældent den ægte fejl. `[object Object]` for PostgrestError, "Edge Function returned a non-2xx status code" for FunctionsHttpError, stille redirect for auth-fejl. `readErrorMessage()` og `readEdgeFunctionError()` findes nu — de er kun brugt de steder vi eksplicit har rettet.

- **⚪ `src/components/atomic-crm/providers/supabase/dataProvider.ts`** — fire steder: salesCreate (117), salesUpdate (145), updatePassword (170), mergeContacts (213). Alle kaster generiske "Failed to X"-strenge. Task #200. Admin-flows, ikke sælger. Efter felttest.
- **⚪ `src/lago/customers/LagoCustomerShow.tsx:183`** — `upsertLagoExtension` mutation har ingen onError. Fejl vises ikke til brugeren. Ubrugt lige nu fordi CrmFieldsCard er skjult (brief 37 §6). Skal rettes før den slås til igen.
- **🟡 `src/lago/ai/useForslagFraNote.ts:110`** — alle fejl-typer (network, invalid, timeout) kollapses til `status: "error", reason: "network"`. Soft-fail per design (AI må ikke blokere Gem-besøg), men den logger heller ingen `console.error` med `readEdgeFunctionError(error)`, så vi kan ikke debugge hvorfor AI-kald fejler i felten. Sælger ser bare "kunne ikke hente forslag" og går videre — ikke felttest-blokerende, men vi taber diagnostikken.
- **⚪ `src/lago/dashboard/widgets/MineOpgaverWidget.tsx:92`** — `markDone`-mutation har `onSuccess` men INGEN `onError`. Hvis DB'en afviser update'et, ser sælgeren opgaven blive tilbage uden forklaring. Se også kategori 3.

---

## 2. PostgREST-indlejring uden fremmednøgle

Kendt fra tre ramte fejl: `tasks→sales` (brief 27 tillæg A), `impersonation_log_lago→sales` (samme), `customer_activities_lago→companies_lago` (brief 35 §6 hotfix). Reglen er nu i `lago/DIVERGENCE.md` under "PostgREST embed rule".

- **Ingen aktuelle steder ramt.** Alle nuværende `companies_lago!inner`-embeds går gennem `companies` (`extension:companies_lago!inner(...)` inde i `companies!inner(...)`) eller starter i `companies_lago` selv. Verificeret ved grep i src/lago + src/components/atomic-crm.
- **Fremadrettet risiko:** hver ny query der indlejrer `companies_lago`, `sales`, `impersonation_log_lago` eller `tasks` fra en tabel der ikke ejer FK'en. Reglen står i DIVERGENCE.md; hvis den ikke læses ved næste PR, rammer vi den igen.

---

## 3. Mutationer uden kvittering

Kendt fra brief 40 tillæg B: `QuickTaskForm` og `QuickNoteForm` tømte et felt og kaldte det feedback. Rettet.

- **🔴 `src/lago/dashboard/widgets/MineOpgaverWidget.tsx:92`** — `markDone`-mutation. Klik på "Markér som færdig" invaliderer bare query — ingen toast, ingen fortryd. Fejl er stumme (se kategori 1). En sælger på Hjem trykker Markér, tasken forsvinder, men han får ingen bekræftelse på hvad der skete. Findes på "Hvad lovede jeg sidst"-widget'et — rammer sælgeren i felttesten. **Bør rettes før fredag.**
- **⚪ `src/lago/customers/LagoCustomerShow.tsx:183`** — se kategori 1. Bruges ikke pt.
- **Ingen andre fund.** Alle mutations i `src/lago/registrer/mutations.ts`, `src/lago/settings/*`, `src/lago/impersonation/session.ts` har både `onSuccess`-toast og `onError`-toast.

---

## 4. `enabled`-betingelser der opregner hvor data bruges

Kendt fra brief 40: `RegistrerModal`'s `enabled: open && (tab === "opgave" || tab === "note")` var brief 40's rodårsag. Rettet til `enabled: open`.

- **🟡 `src/lago/felt/SoegPage.tsx:89-101`** — tre useQuery'er med `enabled: scope === "customers"`, `scope === "contacts"`, `scope === "notes"`. Samme mønster som brief 40's fejl: hver query er gate'd på hvor scope er lige nu, ikke på hvornår data'en skal bruges. Hvis en fjerde scope tilføjes eller en tabs-liste udvides, tabes data'et. Ikke ramt endnu — men mønsterset. Refaktor til `enabled: deferredQ.trim().length >= 2` uafhængigt af scope kunne være renere, men det ændrer performance-model (fetcher alle tre scopes samtidig). Kræver design-beslutning, ikke bare rettelse.
- **Ingen andre fund** med samme "opregn steder"-mønster. De øvrige `enabled`-checks (`salesId != null`, `!!vismaCustomerNo`, `isAdmin`) er af "data er ikke nødvendig endnu"-typen, som er den rigtige form.

---

## 5. Tomme tilstande der ikke findes

Kendt fra brief 42: `ROLE_LAYOUTS.ledelse = []` — Ole ville have set en blank skærm. Rettet med LedelsensTalWidget.

- **⚪ `src/lago/dashboard/widgets/MinUgeWidget.tsx`** — MinUge-widget er ikke længere i `ROLE_LAYOUTS` (erstattet af `min_uge_status` composite i brief 34), men filen består. Ingen brugere rammer den. Kan slettes efter felttest.
- **⚪ `src/lago/dashboard/widgets/MinStatusWidget.tsx`** — samme historie. Bevaret som rollback-mulighed.
- **🟡 `src/components/atomic-crm/dashboard/DashboardStepper.tsx`** — vises af LagoDashboard når `!totalContact` eller `!hasAnyNotes`. Er totalContact === 0 i prod nu? Skulle ikke ske (1164 kunder importeret), men hvis nogen ryder contacts-tabellen ryger man i step 1. Ikke realistisk under felttest.
- **🟡 Widgets uden `emptyState`:** MinDagWidget, TraengerWidget, MineOpgaverWidget har alle explicit `emptyState`. RingelistenWidget har `emptyState="Ingen overskredne uden plan (5+ dage over) lige nu — sælgerne holder trit."`. LedelsensTalWidget har `emptyState="Ingen sælgere med login endnu — invitationerne skal først sendes."`. Alle dashboard-widgets dækket.
- **🟡 Detaljesider uden empty-branche:** CustomerPreview har placeholder. LagoContactShow har `if (isPending || !record) return null` — TOM RETURN. En kontakt uden data viser bare en blank side. Fx hvis contact_id er ugyldig eller RLS blokerer, ser bruger intet. Ikke felttest-blokerende (contact-flow er sekundær), men uheldigt. Bør vises som "Kontakt findes ikke" eller lign.
- **🟡 `LagoCustomerShow` mangler eksplicit "kunden findes ikke"-tekst.** Fejl-branchen har `translate("lago.customer.errors.load_failed")` — dækker fejl. Men hvis Number.isFinite(companyId) === false vises kun `errors.bad_id` — hvad hvis id findes men RLS blokerer? query.error håndteres, men no-error + no-data vises som `loading` for evigt. Kant-tilfælde.

---

## Prioritet før fredag

**🔴 Ret nu (før felttest):**
1. `MineOpgaverWidget.markDone` — tilføj toast + onError (kategori 1 + 3, samme fix)

**🟡 Sæt på liste, ret post-felttest:**
2. `useForslagFraNote.ts` — tilføj `console.error(readEdgeFunctionError(error))` for diagnostik når AI fejler
3. `SoegPage`'s scope-baserede `enabled` — reover-design efter felttest
4. `LagoContactShow` — eksplicit "findes ikke"-tekst

**⚪ Efter felttest / ved lejlighed:**
5. dataProvider-fejl-udpakning (task #200)
6. `LagoCustomerShow.tsx:183` upsertLagoExtension onError — når CrmFieldsCard slås til igen
7. Slet MinUgeWidget + MinStatusWidget filer (dead code)

Ingen af de otte ovennævnte er blevet rørt — kun kartotek, som Jonas bad om.
