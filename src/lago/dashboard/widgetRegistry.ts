import { DatahullerWidget } from "./widgets/DatahullerWidget";
import { ForslagRettelserWidget } from "./widgets/ForslagRettelserWidget";
import { LedelsensTalWidget } from "./widgets/LedelsensTalWidget";
import { MinDagWidget } from "./widgets/MinDagWidget";
import { MineOpgaverWidget } from "./widgets/MineOpgaverWidget";
import { MinUgeStatusWidget } from "./widgets/MinUgeStatusWidget";
import { OpfoelgningerKontorWidget } from "./widgets/OpfoelgningerKontorWidget";
import { RingelistenWidget } from "./widgets/RingelistenWidget";
import { SenesteRegistreringerWidget } from "./widgets/SenesteRegistreringerWidget";
import { TraengerWidget } from "./widgets/TraengerWidget";
import type { WidgetDefinition } from "./widgetTypes";

/**
 * Widget-registry (Domain-brief 18 §2, rev. brief 34 §1).
 *
 * Brief 34: sælgerens fire sektioner er OMDØBT til spørgsmål (Stitchs
 * bedste idé) og har alle en påkrævet underlinje der forklarer
 * sorteringen. min_uge + min_status er slået sammen til én composite
 * ("min_uge_status") — BEGGE gamle filer + dataopslag er bevaret så
 * det kan rulles tilbage efter felttesten.
 */
export const WIDGETS: Record<string, WidgetDefinition> = {
  // ------- Sælger-sæt (brief 34: spørgsmål-navne) -------
  min_dag: {
    title: "Hvem skal jeg besøge i dag",
    subtitle: "Planlagte aftaler i tidsrækkefølge",
    width: "wide",
    component: MinDagWidget,
    seeAllHref: "/companies?sort=priority",
  },
  traenger: {
    title: "Hvem er jeg bagud med",
    subtitle: "Kunder over det aftalte besøgsinterval",
    width: "narrow",
    component: TraengerWidget,
    seeAllHref: "/companies?filter=%7B%22priority_status%22%3A%22overdue%22%7D",
  },
  mine_opgaver: {
    title: "Hvad lovede jeg sidst",
    subtitle: "Åbne opfølgninger fra tidligere besøg",
    width: "narrow",
    component: MineOpgaverWidget,
  },
  // Brief 34 §1: min_uge + min_status slås sammen visuelt.
  // Beholder begge underliggende dataopslag i én composite.
  min_uge_status: {
    title: "Hvordan ligger jeg denne uge",
    subtitle: "Ugens samlede aktivitetsopgørelse",
    width: "wide",
    component: MinUgeStatusWidget,
  },

  // ------- Kontor-sæt (brief 34: titel + underlinje) -------
  ringelisten: {
    title: "Ringeliste — udestående overskridelser",
    subtitle:
      "Kunder over frist uden kontakt fra sælger inden for fem hverdage",
    width: "full",
    component: RingelistenWidget,
  },
  opfoelgninger_kontor: {
    title: "Opfølgninger fra sælgerne",
    subtitle: "Udestående opgaver tildelt kontoret",
    width: "wide",
    component: OpfoelgningerKontorWidget,
  },
  datahuller: {
    title: "Kunder med manglende data",
    subtitle: "Registreringer der er mangelfulde",
    width: "narrow",
    component: DatahullerWidget,
  },
  // Brief 46 §3 (16. sep 2026): sælgernes forslag til VISMA-ejede felter
  // — retter kontoret det i VISMA, lukker importen forslaget automatisk.
  forslag_rettelser: {
    title: "Foreslåede rettelser",
    subtitle:
      "Sælgernes forslag til kunde-data — retter du i VISMA, lukker forslaget sig selv",
    width: "full",
    component: ForslagRettelserWidget,
  },
  seneste_registreringer: {
    title: "Seneste registreringer fra feltet",
    subtitle: "Opdateres løbende, efterhånden som sælgerne indberetter",
    width: "wide",
    component: SenesteRegistreringerWidget,
  },

  // ------- Ledelses-sæt (byggede efter brief 42, 16. sep 2026) -------
  ledelsens_tal: {
    title: "Sælgernes uge",
    // Brief 81 §3b (23. sep 2026): den forrige underlinje ("Så jeg kan
    // puffe jer kærligt i ryggen — ikke en rangering") udgår efter
    // Jonas' beslutning. Neutral erstatning der siger hvad widget'en er.
    subtitle: "Ugens aktivitet pr. sælger",
    width: "full",
    component: LedelsensTalWidget,
  },
};

export type WidgetId = keyof typeof WIDGETS;
