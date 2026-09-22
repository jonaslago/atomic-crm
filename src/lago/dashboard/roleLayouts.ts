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
  // Brief 34 §1: sælgerens fire spørgsmål. min_uge + min_status slået
  // sammen visuelt til min_uge_status. Rækkefølge:
  //   1. Hvem skal jeg besøge i dag       (min_dag, wide)
  //   2. Hvem er jeg bagud med            (traenger, narrow)
  //   3. Hvad lovede jeg sidst            (mine_opgaver, narrow)
  //   4. Hvordan ligger jeg denne uge     (min_uge_status, wide)
  saelger: ["min_dag", "traenger", "mine_opgaver", "min_uge_status"],

  // Kontor-sættet (brief 34: samme titel+underlinje-behandling).
  // Brief 46 §3 (16. sep 2026): forslag_rettelser ligger mellem
  // datahuller og seneste_registreringer — samme flow, andet register:
  // datahuller = "vi har intet", forslag = "sælger foreslår noget andet".
  kontor: [
    "ringelisten",
    "opfoelgninger_kontor",
    "datahuller",
    "forslag_rettelser",
    "seneste_registreringer",
  ],

  // Ledelses-sæt. Brief 76 §1 (22. sep 2026): Ole får tre widgets, ikke
  // ét. Rækkefølgen betyder noget — tal, så bevis, så gæld:
  //   1. ledelsens_tal          hans tal pr. sælger (kickoff-krav)
  //   2. seneste_registreringer beviset for at systemet er i brug
  //   3. datahuller             kvaliteten af hans eget kartotek
  // Bevidst udelukket: ringelisten + forslag_rettelser. Det er
  // arbejdslister, og Ole skal ikke arbejde i systemet — han skal
  // kunne se, om det virker.
  ledelse: ["ledelsens_tal", "seneste_registreringer", "datahuller"],

  // Admin: kontor-widgets + ledelsens_tal (brief 44-eftersyn ·
  // 16. sep 2026). Admin (Jonas) har ikke kunde-ansvar via
  // companies.sales_id, så sælger-widgets returnerede fire tomme
  // kasser hver dag — det ligner et system i stykker mere end et
  // system uden data. Vil admin se en sælgers flade, sker det via
  // impersonation (brief 27). Sælger-widgets kan lægges tilbage her
  // hvis en admin senere også bliver tildelt kunder.
  admin: [
    "ringelisten",
    "opfoelgninger_kontor",
    "datahuller",
    "forslag_rettelser",
    "seneste_registreringer",
    "ledelsens_tal",
  ],
};
