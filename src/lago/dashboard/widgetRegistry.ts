import { BesoegsdaekningWidget } from "./widgets/BesoegsdaekningWidget";
import { BevaegelseWidget } from "./widgets/BevaegelseWidget";
import { DatahullerWidget } from "./widgets/DatahullerWidget";
import { DatakvalitetWidget } from "./widgets/DatakvalitetWidget";
import { ForslagRettelserWidget } from "./widgets/ForslagRettelserWidget";
import { KanSendesWidget } from "./widgets/KanSendesWidget";
import { KapacitetsTjekWidget } from "./widgets/KapacitetsTjekWidget";
import { LedelsensTalWidget } from "./widgets/LedelsensTalWidget";
import { MinDagWidget } from "./widgets/MinDagWidget";
import { MineOpgaverWidget } from "./widgets/MineOpgaverWidget";
import { MinUgeStatusWidget } from "./widgets/MinUgeStatusWidget";
import { OpfoelgningerKontorWidget } from "./widgets/OpfoelgningerKontorWidget";
import { OrdrekommentarerWidget } from "./widgets/OrdrekommentarerWidget";
import { RingelistenWidget } from "./widgets/RingelistenWidget";
import { SalgOgOrdrerWidget } from "./widgets/SalgOgOrdrerWidget";
import { SalgsudviklingWidget } from "./widgets/SalgsudviklingWidget";
import { SenesteRegistreringerWidget } from "./widgets/SenesteRegistreringerWidget";
import { TaellerraekkeWidget } from "./widgets/TaellerraekkeWidget";
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
  // ------- Sælger-sæt (brief 85 §14 · 28. sep 2026: nye kortere navne
  //         der ikke bruger spørgsmål-formen; det var Stitchs bedste
  //         idé, men de fire titler kunne læses kortere) -------
  min_dag: {
    title: "Dagens besøg",
    subtitle: "Planlagte aftaler i tidsrækkefølge",
    width: "wide",
    component: MinDagWidget,
    // Brief 87 tillæg (28. sep 2026): fallback bruges kun i widget-error-
    // state. Widget'en selv sætter en person-scoped variant. Aktivitets-
    // sidens "kommende"-periode viser alt fra i dag og frem.
    seeAllHref: "/aktiviteter?types=aftale&period=kommende",
    seeAllLabel: "Se alle kommende besøg",
  },
  traenger: {
    title: "Kunder der skal besøges",
    subtitle: "Aldrig besøgt før overskredne",
    width: "narrow",
    component: TraengerWidget,
    seeAllHref: "/companies?filter=%7B%22priority_status%22%3A%22overdue%22%7D",
  },
  mine_opgaver: {
    title: "Åbne opgaver",
    subtitle: "Udvalg af dine åbne opfølgninger",
    width: "narrow",
    component: MineOpgaverWidget,
    seeAllHref: "/aktiviteter",
  },
  // Brief 87 §3+§4 (28. sep 2026): salg + åbne ordrer. Fyldes ind i
  // hovedspalten under Kunder der skal besøges. To linjer, ikke fire —
  // "Denne uge" og "Kan leveres uden aftalt dato" venter på brief 88's
  // genimport (dato-opløsning + bekraeftet_lev_dato).
  salg_og_ordrer: {
    title: "Salg og ordrer",
    subtitle: "Måneden mod sidste år · hvad der ligger åbent nu",
    width: "wide",
    component: SalgOgOrdrerWidget,
  },
  // Brief 85 §14 tillæg: kun navnet skifter — indholdet er stadig
  // ugens samlede opgørelse. Underlinjen bevares så titel + underlinje
  // ikke modsiger hinanden på skærmen.
  min_uge_status: {
    title: "Dagens tal",
    subtitle: "Ugens samlede aktivitetsopgørelse",
    width: "wide",
    component: MinUgeStatusWidget,
  },

  // ------- Kontor-sæt (brief 34: titel + underlinje) -------
  // Brief 90 §6 (28. sep 2026): kontor-forsiden får tællerække øverst,
  // Kunder med ordrer der kan sendes som andet widget efter Ordre-
  // kommentarer, og ny rækkefølge på resten. To-beholder-model i grid'et
  // løser 600 px ingenting-problemet (brief 82 §1).
  taellerraekke: {
    title: "Kontorets overblik",
    subtitle: "Fire arbejdsbunker — klik for at åbne den, du starter med",
    width: "full",
    component: TaellerraekkeWidget,
  },
  kan_sendes: {
    title: "Kunder med ordrer, der kan sendes",
    subtitle: "Hele ordren klar · almindelig levering · rangeret på beløb",
    width: "wide",
    component: KanSendesWidget,
  },
  ringelisten: {
    title: "Ringeliste — udestående overskridelser",
    // Brief 90 §1 (28. sep 2026): tærsklen fra 5 til 14 dage. Ejerskabet
    // flytter ikke — kunden bliver hos sin sælger; kontoret må ringe.
    // Reglen skal stå på skærmen, ikke kun i koden.
    subtitle:
      "Kunder, sælgeren ikke har nået inden for 14 dage ud over intervallet. Kontoret må ringe; kunden bliver hos sin sælger.",
    width: "full",
    component: RingelistenWidget,
  },
  // Brief 90 §5 (28. sep 2026): omdøbt fra "Opfølgninger fra sælgerne"
  // fordi Simon også opretter sine egne. Widget'en har nu markDone på
  // hver række (før knækkede kontoret ved den fjerne ende — kunne ikke
  // lukke en opgave sælgeren havde sendt til dem) og viser oprindelsen
  // pr. række: "Fra Peter, 24. sep" hvis markeren står i teksten,
  // "Egen" hvis assign matcher aktøren, "Ikke tildelt" ellers.
  opfoelgninger_kontor: {
    title: "Åbne opgaver",
    subtitle:
      "Udestående opgaver — sendt fra sælgerne eller oprettet af kontoret",
    width: "wide",
    component: OpfoelgningerKontorWidget,
  },
  // Brief 89 (28. sep 2026): kontorets liste over ordrekommentarer.
  // Send nu øverst — det er dem der haster. To handlinger pr. række:
  // Udført (status=udfoert) og Luk med begrundelse (status=afvist).
  ordrekommentarer: {
    title: "Ordrekommentarer",
    subtitle: "Sælgernes beskeder om åbne ordrer · Send nu øverst",
    width: "full",
    component: OrdrekommentarerWidget,
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

  // ------- Ledelses-sæt (brief 86, 28. sep 2026: Ole ser besøgs-
  //         dækningen først, ikke sælgernes uge. Widget-nøglen omdøbt
  //         samme dag fra "daekningsgraden" — se BesoegsdaekningWidget
  //         for hvorfor "dækningsgrad" var forkert ord) -------
  besoegsdaekning: {
    title: "Besøgsdækning",
    subtitle: "Alle aktive kunder fordelt på segment og besøgsstatus",
    width: "full",
    component: BesoegsdaekningWidget,
  },
  salgsudvikling: {
    title: "Salgsudvikling",
    subtitle: "År til dato mod sidste år · pr. distrikt",
    width: "full",
    component: SalgsudviklingWidget,
    seeAllHref: "/salgsudvikling",
    seeAllLabel: "Åbn Salgsudvikling",
  },
  bevaegelse: {
    title: "Kunder i bevægelse",
    subtitle: "År til dato mod sidste år · rangeret på kroner",
    width: "full",
    component: BevaegelseWidget,
    seeAllHref: "/salgsudvikling",
    seeAllLabel: "Åbn Salgsudvikling",
  },
  kapacitets_tjek: {
    title: "Kapacitets-tjekket",
    subtitle: "Passer segmenteringen til de mennesker, vi har?",
    width: "full",
    component: KapacitetsTjekWidget,
  },
  datakvalitet: {
    title: "Datakvalitet",
    subtitle: "Kunder med huller i kartoteket",
    width: "full",
    component: DatakvalitetWidget,
  },
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
