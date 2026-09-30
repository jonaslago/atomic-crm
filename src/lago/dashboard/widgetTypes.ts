import type { ComponentType, ReactNode } from "react";
import type { LagoRole } from "@/lago/auth/useCurrentLagoRole";

/**
 * Widget-kontrakten (Domain-brief 18 §2).
 *
 * En widget er en selvstændig lille komponent med eget dataopslag, egen
 * tomme-tilstand og et id. Dashboardet er en liste af id'er.
 *
 * En langsom widget må ikke blokere resten — hver widget bruger sin egen
 * useQuery, tegner sin egen skeleton og løser sine egne fejl. Widgets må
 * ikke kende til hinanden og ikke til rollen.
 */

/** Bredde-erklæring. Grid'et rendrer i @container-baseret 3-kol-layout;
 *  narrow = 1/3, wide = 2/3, full = fuld bredde (kollapser på smal). */
export type WidgetWidth = "narrow" | "wide" | "full";

export interface WidgetMeta {
  /** Kort titel — vises i widget-headeren. Brief 34: sælgerens fire
   *  hedder spørgsmål ("Hvem skal jeg besøge i dag"), ikke emner. */
  title: string;
  /**
   * Brief 34 §1: PÅKRÆVET. Én linje der forklarer, hvad widget'en
   * viser og i hvilken rækkefølge — sortering + filtrering, ikke pynt.
   * "Planlagte aftaler i tidsrækkefølge" / "Kunder over det aftalte
   * besøgsinterval". Vises i --t-meta, vægt 400, farve --fg-2 lige
   * under overskriften. En widget uden forklaring er en widget, ingen
   * tør stole på.
   */
  subtitle: string;
  /** Erklæret bredde i grid'et. */
  width: WidgetWidth;
  /** Valgfri "se alle"-link til den fulde skærm, hvis der findes en. */
  seeAllHref?: string;
  /** Brief 85 §16 (28. sep 2026): valgfri label der overskriver "Se alle"
   *  standard-teksten. "Dagens besøg" bruger fx "Se alle kommende besøg". */
  seeAllLabel?: string;
  /** Valgfri kort-forklaring — vises som tooltip / hjælpetekst. */
  hint?: string;
}

export interface WidgetDefinition extends WidgetMeta {
  /** React-komponenten. Modtager ingen props — den er selvstændig. */
  component: ComponentType;
}

/** Layout pr. rolle: ordnet liste af widget-id'er. */
export type RoleLayout = Record<LagoRole, string[]>;

/** Shell-props som widget-komponenter selv anvender via <WidgetShell>.
 *  Definered her så den er tilgængelig for alle widgets uden cirkulær
 *  import. */
export interface WidgetShellProps {
  title: string;
  /** Brief 34 §1: påkrævet forklaring på hvad widget'en viser + sortering. */
  subtitle: string;
  seeAllHref?: string;
  /** Brief 85 §16: valgfri overskrivning af "Se alle"-label. */
  seeAllLabel?: string;
  /** True → skeleton-tilstand. */
  isLoading?: boolean;
  /** Sat → viser en pæn fejl-tilstand i stedet for indholdet. */
  error?: Error | null;
  /** Brief 55 tillæg A (17. sep 2026): menneskelig fejlbesked som
   *  widget'en kan overskrive standardteksten med. `error.message`
   *  logges til konsollen — brugeren ser kun denne tekst. */
  errorMessage?: string;
  /** True → widget'en er tom (fx nul rækker); vis emptyState hvis givet. */
  isEmpty?: boolean;
  emptyState?: ReactNode;
  children?: ReactNode;
  /** Tilføj Tailwind-klasser til shell-cardet (fx padding-overrides). */
  className?: string;
  /**
   * Brief 34 §2, rev. tillæg A §4: tælling der vises OVENI nummeret
   * fra 768 px og op. "3 planlagte aftaler", "2 kunder overskredet".
   * Under 768 er den skjult (kun nummeret vises).
   */
  count?: {
    /** Fx "3 planlagte aftaler" — komplet tekst inkl. tal og enhed. */
    label: string;
    /** Statusfarve på selve tællingen. Kun rød og gul (grøn er
     *  reserveret til "Ajour" — brief 33). Default = neutral. */
    tone?: "neutral" | "red" | "amber";
  };
  /**
   * Brief 85 §16 tillæg (28. sep 2026): valgfri header-handling
   * (fx "+ Ny opgave" på Åbne opgaver). Renderes over Se alle i
   * top-højre-kolonnen, så primær handling ligger øverst.
   */
  headerExtra?: ReactNode;
  /**
   * Brief 90 opfølgning (29. sep 2026): som default pakker WidgetShell
   * sit indhold i et hvidt Panel-kort på beige — samme regel for alle
   * widgets, uanset om indholdet er en liste, tabel eller tom tilstand.
   * Widgets der selv laver et Panel-wrap indeni sætter noPanel=true for
   * at undgå dobbelt padding.
   */
  noPanel?: boolean;
}
