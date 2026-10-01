import type { RoleLayout } from "./widgetTypes";

/**
 * Rolle → widget-id-liste, i visningsrækkefølge (Domain-brief 18 §2).
 *
 * Trin 1 (dette): flytter de tre eksisterende zoner ind som widgets.
 * Trin 2 udvider sælger-listen med Min uge og Min status.
 * Trin 3 udfylder kontor-listen.
 * Ledelse er IKKE i v1.0 — layoutet står tomt indtil videre.
 * Admin får kontor-listen + import-siden (som allerede findes under
 * /indstillinger, ikke i dashboardet).
 */
export const ROLE_LAYOUTS: RoleLayout = {
  // Brief 34 §1 + brief 87 §4 (28. sep 2026): sælgerens fem sektioner.
  // Rækkefølge i hovedspalte + skinne (DashboardGrid deler i to 8/4
  // kolonner, mainIds = ids.slice(0, 3), railIds = ids.slice(3)):
  //   Hovedspalte
  //     1. Dagens besøg                     (min_dag, wide)
  //     2. Kunder der skal besøges          (traenger, narrow)
  //     3. Salg og ordrer                   (salg_og_ordrer, wide) ← ny
  //   Skinne
  //     4. Åbne opgaver                     (mine_opgaver, narrow)
  //     5. Dagens tal                       (min_uge_status, wide)
  saelger: [
    "min_dag",
    "traenger",
    "salg_og_ordrer",
    "mine_opgaver",
    "min_uge_status",
  ],

  // Kontor-sættet (brief 90 §6, 28. sep 2026):
  //   0. taellerraekke        Fire arbejdsbunker øverst (link + tal)
  //   1. ordrekommentarer     Sælgernes beskeder (brief 89)
  //   2. kan_sendes           Ordrer klar til afsendelse
  //   3. opfoelgninger_kontor Åbne opgaver — sælgeren-egne + kontor-kø
  //   4. datahuller           Kunder med manglende data
  //   5. seneste_registreringer Feed fra feltet
  //
  // "forslag_rettelser" er droppet fra kontor i brief 90 § — den hører
  // hjemme på indstillinger-siden, ikke på forsiden (Jonas 28. sep).
  // Ringelisten (brief 83) er stadig ude. DashboardGrid bruger to-
  // beholder-model også for kontor: 4 widgets i hovedspalten, 1 i
  // skinnen. Det løser brief 82 §1's 600 px ingenting-problem.
  // §31b (1. okt 2026): kontor gets both "Mine opgaver" and
  // "Kontorets opgaver". Mine = tildelt mig. Kontorets = tildelt
  // kontoret, men ikke mig. Two widgets, same component, different query.
  kontor: [
    "taellerraekke",
    "ordrekommentarer",
    "kan_sendes",
    "mine_opgaver",
    "opfoelgninger_kontor",
    "seneste_registreringer",
    "datahuller",
  ],

  // Ledelses-sæt. Brief 86 (28. sep 2026): Ole skal se besøgs-
  // dækningen først, salgsudvikling, bevægelse, kapacitet og til sidst
  // datakvalitet i bunden. Ledelsens_tal (Sælgernes uge) er UDE — den
  // er sælger-gruppens dagligt tal, og Ole skal ikke sammenligne fem
  // sælgeres ugetal på forsiden hver morgen. Han skal kunne se om
  // kartoteket dækkes, om salget vokser, hvilke kunder der er i
  // bevægelse, om kapaciteten passer, og hvad der er registreret.
  // Widget-nøgle omdøbt fra "daekningsgraden" → "besoegsdaekning" 28.
  // sep — "dækningsgrad" betyder dækningsbidrag i regnskabssprog.
  // Brief 90 §5 (28. sep 2026): mine_opgaver hører i hver eneste
  // rolles layout — også Oles. Ligger sidst så det ikke forstyrrer
  // ledelses-tallene; Ole opretter typisk ingen opgaver, så widget'en
  // står tom mest af tiden. Princippet: enhver, der kan modtage noget,
  // skal kunne lukke det.
  // §97 (1. okt 2026): Ole's three questions — are the salespeople out,
  // and what's in the order book? Besøg pr. person replaces Sælgernes
  // uge. Ordre-bunker + aldersfordeling are new. Tasks, follow-ups and
  // order comments are NOT statistics — they don't belong in an overview.
  ledelse: [
    "besoeg_pr_person",
    "ordre_bunker",
    "ordre_alder",
    "besoegsdaekning",
    "salgsudvikling",
    "bevaegelse",
    "kapacitets_tjek",
    "datakvalitet",
    "mine_opgaver",
  ],

  // Admin: kontor-widgets + ledelsens_tal (brief 44-eftersyn ·
  // 16. sep 2026). Admin (Jonas) har ikke kunde-ansvar via
  // companies.sales_id, så sælger-widgets returnerede fire tomme
  // kasser hver dag — det ligner et system i stykker mere end et
  // system uden data. Vil admin se en sælgers flade, sker det via
  // impersonation (brief 27).
  //
  // Brief 76 tillæg A opfølgning (23. sep 2026): mine_opgaver er
  // undtagelsen. Jonas har 8 åbne opgaver tildelt sig — de er ikke
  // hans primære arbejde, men de er hans egne løfter, og han kunne
  // ikke se dem nogen steder. Ligger nederst efter ledelsens_tal.
  // Tom tilstand siger "Ingen åbne", ikke tom kasse.
  // Brief 83 (24. sep 2026): "ringelisten" fjernet også her — samme
  // beslutning som for kontor. Ringelisten er nu tilgængelig som
  // "Ringeliste"-radio i kundelistens venstre-skinne.
  // Brief 90 §6 (28. sep 2026): admin har kontorets rækkefølge + sine
  // egne administrative widgets nederst (ledelsens_tal + mine_opgaver).
  // Forslag_rettelser er ude fra forsiden — hører på indstillinger.
  admin: [
    "taellerraekke",
    "ordrekommentarer",
    "kan_sendes",
    "opfoelgninger_kontor",
    "seneste_registreringer",
    "datahuller",
    "ledelsens_tal",
    "mine_opgaver",
  ],
};
