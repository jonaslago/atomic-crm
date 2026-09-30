import { SEGMENT_INTERVAL_DAYS, SOON_RATIO } from "./segmentIntervals";

/**
 * Brief 14: X og L har ingen urgency-kadence. De renderes grå (samme
 * som never_visited) men tæller IKKE som "trænger til besøg" nogen
 * steder. Ny status "no_urgency" markerer dem.
 *
 *  - overdue      A/B/C har passeret intervallet          → rød
 *  - soon         A/B/C nærmer sig intervallets slut      → amber
 *  - on_plan      A/B/C er ajour                          → grøn ("Ajour")
 *  - never_visited A/B/C uden besøgshistorik              → grå
 *  - no_urgency   X (uklassificeret) / L (lead)           → grå
 */
export type VisitStatus =
  | "overdue"
  | "soon"
  | "on_plan"
  | "never_visited"
  | "no_urgency";

export interface VisitPriority {
  status: VisitStatus;
  intervalDays: number;
  /** Days since the last visit. Null if there was never one. */
  daysSinceVisit: number | null;
  /**
   * Days past the expected interval. Positive = overdue; zero or negative =
   * on plan. Null when there was never a visit.
   */
  daysOverdue: number | null;
  /**
   * Sort key — bigger = more urgent. Customers without a visit get the
   * highest score so they bubble to the top.
   */
  sortScore: number;
}

/**
 * Runtime overrides for interval settings (brief 11). Loaded from
 * public.lago_settings.visit_intervals via useVisitIntervals(). When not
 * provided, the compile-time defaults from segmentIntervals.ts are used
 * so any code path that hasn't been wired up yet still works.
 */
export interface IntervalsConfig {
  // Kun A/B/C har eksplicit interval. X/L falder tilbage til B's
  // interval via intervalForSegment (brief 13).
  intervalDays: Record<"A" | "B" | "C", number>;
  soonRatio: number;
}

export const DEFAULT_INTERVALS_CONFIG: IntervalsConfig = {
  intervalDays: { ...SEGMENT_INTERVAL_DAYS },
  soonRatio: SOON_RATIO,
};

/**
 * Brief 64 fase 3 (18. sep 2026): shape af én række fra
 * public.customers_with_priority_lago. View'et er nu ÉN og eneste kilde
 * for besøgs-grundstatus. Klientsidens computeVisitPriority er væk.
 *
 * `days_since_visit` bevares som separat kolonne fordi kundelistens
 * "sidst besøgt X dage siden"-tekst læser det direkte.
 */
export interface ServerVisitPriority {
  status: VisitStatus;
  days_overdue: number | null;
  interval_days: number;
  days_since_visit: number | null;
}

/**
 * Adapter: view-række → VisitPriority. Ingen forretningslogik, kun
 * felt-rename + sortScore-udledning. sortScore afspejler samme regel
 * som klientsiden: never_visited øverst (+Inf), no_urgency nederst
 * (-Inf), overdue efter days_overdue. Hvis view og klient nogensinde
 * divergerer på sortScore, er det HER det sker — ikke i view'et,
 * som holder sig til status + days_overdue.
 */
export function priorityFromServer(sv: ServerVisitPriority): VisitPriority {
  let sortScore: number;
  if (sv.status === "never_visited") {
    sortScore = Number.POSITIVE_INFINITY;
  } else if (sv.status === "no_urgency") {
    sortScore = Number.NEGATIVE_INFINITY;
  } else {
    sortScore = sv.days_overdue ?? 0;
  }
  return {
    status: sv.status,
    intervalDays: sv.interval_days,
    daysSinceVisit: sv.days_since_visit,
    daysOverdue: sv.days_overdue,
    sortScore,
  };
}

/**
 * Brief 64 fase 3 (18. sep 2026): eneste adgangspunkt til priority.
 * Server-view'et ejer sandheden. Falder view'et manglende — kun muligt
 * for admin-visning af en kunde uden companies_lago-række — falder vi
 * tilbage til no_urgency så UI'et kan rendere uden at kaste. Sælger-
 * skærme filtrerer disse ud på !inner, så null er en admin-edge.
 */
export function resolveVisitPriority(
  serverSide: ServerVisitPriority | null | undefined,
): VisitPriority {
  if (serverSide) return priorityFromServer(serverSide);
  return {
    status: "no_urgency",
    intervalDays: 0,
    daysSinceVisit: null,
    daysOverdue: null,
    sortScore: Number.NEGATIVE_INFINITY,
  };
}

// Rækkefølge når vi "trænger til besøg"-sorterer: aldrig-besøgt A/B/C
// bubbler øverst (nye der aldrig blev nået), så overdue, så soon, så
// on_plan (ajour), og no_urgency (X/L) synker altid til bunden — de
// tæller ikke som trænger og skal aldrig konkurrere med klassificerede.
const STATUS_ORDER: Record<VisitStatus, number> = {
  never_visited: 0,
  overdue: 1,
  soon: 2,
  on_plan: 3,
  no_urgency: 4,
};

/**
 * Comparator that puts the most urgent customer first:
 * never_visited → overdue (most overdue first) → soon → on_plan.
 *
 * Brief 23 pkt 2: primaer sammenligning er status + sortScore. Ved
 * uafgjort er comparePriority tavs (returnerer 0), og caller kan
 * lægge en sekundaer key oven paa (fx segment → navn) via
 * makeComparePriorityBy. Det holder core-comparator agnostisk overfor
 * det domaenevalg — segment-ordering er en Dagens-beslutning, ikke
 * en priority-model-beslutning.
 */
export function comparePriority(a: VisitPriority, b: VisitPriority): number {
  const groupDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (groupDelta !== 0) return groupDelta;
  // Same status group → more overdue (higher sortScore) first.
  if (b.sortScore !== a.sortScore) {
    return b.sortScore - a.sortScore;
  }
  return 0;
}

/**
 * Segment-rank til sekundaer sortering (brief 23 pkt 2). En A-kunde,
 * der aldrig er besoegt, haster mere end en C-kunde, der aldrig er
 * besoegt — det ved vi allerede, vi bruger det bare ikke.
 * X og L er ikke urgency-baerende, saa de synker til bunden.
 */
export const SEGMENT_URGENCY_RANK: Record<string, number> = {
  A: 0,
  B: 1,
  C: 2,
  X: 3,
  L: 4,
};

/**
 * Brief 36 §1: fuld sammenligning for lister der viser "trænger mest".
 * primær priority → sekundær segment (A→B→C→X→L) → tertiær navn.
 *
 * Uden segment-tiebreak'et returnerer comparePriority 0 for hele
 * feltet af never_visited-kunder (samme sortScore), og Array.sort
 * falder tilbage til forespørgslens rækkefølge — som er alfabetisk.
 * DagensPage havde det ret; TraengerWidget, NeedsVisitTop5 og
 * RingelistenWidget skal vise det samme.
 */
export function comparePriorityThenSegmentThenName<
  T extends {
    priority: VisitPriority;
    segment: string | null | undefined;
    name: string;
  },
>(a: T, b: T): number {
  const p = comparePriority(a.priority, b.priority);
  if (p !== 0) return p;
  const aRank = SEGMENT_URGENCY_RANK[a.segment ?? "X"] ?? 3;
  const bRank = SEGMENT_URGENCY_RANK[b.segment ?? "X"] ?? 3;
  if (aRank !== bRank) return aRank - bRank;
  return a.name.localeCompare(b.name, "da", { sensitivity: "base" });
}

/**
 * Brief 36 §1 (rev. brief 38 §8 · 16. sep 2026): er toppen af listen
 * sorteret på segment+navn-fallback frem for på priority? Så skal UI'et
 * sige det diskret — ellers tror sælgeren, at toppen er en priority-
 * vurdering.
 *
 * Aktiv når mindst halvdelen af **toppens vindue** deler status +
 * sortScore med top-elementet. Vinduet er `windowSize` (default 10)
 * så reglen giver mening på både dashboards' korte topliste og på
 * kundelistens 250-rækkers scroll — hele-listen-tælleren fra brief 36
 * kunne aldrig ramme >50% når listen er lang, og alfaHint blev derfor
 * usynlig på kundelisten (brief 38 §8).
 */
export function isSortTieDominated(
  sorted: ReadonlyArray<{ priority: VisitPriority }>,
  minLength = 4,
  windowSize = 10,
): boolean {
  if (sorted.length < minLength) return false;
  const window = sorted.slice(0, Math.min(windowSize, sorted.length));
  const top = window[0];
  let sameCount = 0;
  for (const c of window) {
    if (
      c.priority.status === top.priority.status &&
      c.priority.sortScore === top.priority.sortScore
    ) {
      sameCount++;
    }
  }
  return sameCount * 2 > window.length;
}
