import type { VisitStatus } from "@/lago/customers/priority";

import type { FeltCustomer } from "./customerData";

/**
 * Brief 14 (addendum 2): én regel for alle grupper — tomt = vis alle,
 * hvert flueben = snævrer ind. Standard = blankt panel = vis alle.
 * Inden for gruppe = OR, på tværs = AND.
 *
 * Grupper i panelet:
 *  - Linser (Mine kunder · Aldrig besøgt · Planlagte)     — OR
 *  - Besøg (Skal besøges · Snart · Ajour · Ingen data)    — OR
 *  - Segment (A · B · C · X)                              — OR
 *  - Vis også (Leads · Inaktive)                          — utvider basen
 */
export type Segment = "A" | "B" | "C" | "X" | "L";
/** Segment-gruppen indeholder ikke L — L styres af "Vis også Leads". */
export type ClassifiedSegment = "A" | "B" | "C" | "X";

export type VisitGroup = "must_visit" | "soon" | "on_plan" | "no_urgency";

export interface FeltFilters {
  // Linse-gruppe (OR)
  onlyMine: boolean;
  neverVisited: boolean;
  planned: boolean;
  /**
   * Dagens-specifik snæver variant af "Planlagte": kun kunder med
   * next_visit_planned == i dag. Kortet skjuler den — panelet
   * renderer chippen kun når `showPlannedToday` er true.
   */
  plannedToday: boolean;
  // Besøg-gruppe (OR) — tom = alle
  visitStatuses: Set<VisitGroup>;
  // Segment-gruppe (OR) — tom = alle A/B/C/X (L via Vis også)
  segments: Set<ClassifiedSegment>;
  // Vis også — utvider base-populationen
  showLeads: boolean;
  showInactive: boolean;
}

export interface FeltFilterCounts {
  onlyMine: number;
  neverVisited: number;
  planned: number;
  plannedToday: number;
  visitStatuses: Record<VisitGroup, number>;
  segments: Record<ClassifiedSegment, number>;
  showLeads: number;
  showInactive: number;
}

export const ALL_CLASSIFIED_SEGMENTS: ClassifiedSegment[] = [
  "A",
  "B",
  "C",
  "X",
];
export const ALL_VISIT_GROUPS: VisitGroup[] = [
  "must_visit",
  "soon",
  "on_plan",
  "no_urgency",
];

/**
 * Brief 23 pkt 1: Dagens skal aabne paa MINE kunder (fanen tæller det
 * samme, siden skal levere det samme). Kort og Soeg er opslagsvaerktoejer
 * — de beholder onlyMine=false. Overload'et gør ansvaret eksplicit i
 * caller (DagensPage: `{onlyMine: true}`), i stedet for en global
 * konstant der forgrener på skærmnavn.
 */
export function defaultFeltFilters(
  opts: { onlyMine?: boolean } = {},
): FeltFilters {
  return {
    onlyMine: opts.onlyMine ?? false,
    neverVisited: false,
    planned: false,
    plannedToday: false,
    visitStatuses: new Set(),
    segments: new Set(),
    showLeads: false,
    showInactive: false,
  };
}

export function isDefaultFeltFilters(f: FeltFilters): boolean {
  return countActiveFeltFilters(f) === 0;
}

/**
 * Brief 23 pkt 1: sammenlign to filter-tilstande. Bruges af "Ryd
 * filtre"-knappen til at afgøre om vi er ved skærmens udgangspunkt
 * (Dagens' onlyMine=true tæller som "ryddet", ikke som aktivt filter).
 */
export function feltFiltersEqual(a: FeltFilters, b: FeltFilters): boolean {
  if (
    a.onlyMine !== b.onlyMine ||
    a.neverVisited !== b.neverVisited ||
    a.planned !== b.planned ||
    a.plannedToday !== b.plannedToday ||
    a.showLeads !== b.showLeads ||
    a.showInactive !== b.showInactive
  )
    return false;
  if (a.visitStatuses.size !== b.visitStatuses.size) return false;
  for (const g of a.visitStatuses) if (!b.visitStatuses.has(g)) return false;
  if (a.segments.size !== b.segments.size) return false;
  for (const s of a.segments) if (!b.segments.has(s)) return false;
  return true;
}

/**
 * Brief 16: bruges som badge på mobil "Filtre"-knap, så sælgeren kan se
 * hvor mange filtre der er aktive uden at åbne bottom-sheet'en.
 * Segment- og besøgs-grupper tælles som ét filter hver (uanset hvor mange
 * checkboxes der er krydset af inden i gruppen).
 */
export function countActiveFeltFilters(f: FeltFilters): number {
  let n = 0;
  if (f.onlyMine) n++;
  if (f.neverVisited) n++;
  if (f.planned) n++;
  if (f.plannedToday) n++;
  if (f.visitStatuses.size > 0) n++;
  if (f.segments.size > 0) n++;
  if (f.showLeads) n++;
  if (f.showInactive) n++;
  return n;
}

export function visitStatusToGroup(status: VisitStatus): VisitGroup {
  if (status === "overdue" || status === "never_visited") return "must_visit";
  if (status === "soon") return "soon";
  if (status === "on_plan") return "on_plan";
  return "no_urgency";
}

// ---- Group-level predicates ---------------------------------------------
// Hver gruppe checkes uafhængigt. Alle skal passere (AND på tværs).

/**
 * Vis også — utvider base-populationen. L-kunder kræver showLeads;
 * inaktive kræver showInactive. Uden dem er de skjulte fra hele fladen.
 */
function passesShowAlso(c: FeltCustomer, f: FeltFilters): boolean {
  const ext = c.extension;
  const seg = (ext?.segment ?? "X") as Segment;
  if (seg === "L" && !f.showLeads) return false;
  if (ext?.is_active === false && !f.showInactive) return false;
  return true;
}

/**
 * Segment-gruppe. L går udenom segment-gaten (styres af showLeads).
 * Tom = alle A/B/C/X passer.
 */
function passesSegment(c: FeltCustomer, f: FeltFilters): boolean {
  const seg = (c.extension?.segment ?? "X") as Segment;
  if (seg === "L") return true;
  if (f.segments.size === 0) return true;
  return f.segments.has(seg as ClassifiedSegment);
}

/** Besøg-gruppe. Tom = alle besøgs-statusser passer. */
function passesVisit(c: FeltCustomer, f: FeltFilters): boolean {
  if (f.visitStatuses.size === 0) return true;
  return f.visitStatuses.has(visitStatusToGroup(c.priority.status));
}

/**
 * Linse-gruppe (OR). Tom = ingen linse-filter. Med mindst én linse
 * krydset skal kunden matche mindst én af de valgte.
 */
function passesLenses(
  c: FeltCustomer,
  f: FeltFilters,
  mySalesId: number | null,
  nowIso: string,
): boolean {
  const anyChecked =
    f.onlyMine || f.neverVisited || f.planned || f.plannedToday;
  if (!anyChecked) return true;
  const ext = c.extension;
  if (
    f.onlyMine &&
    typeof mySalesId === "number" &&
    c.sales_id === mySalesId
  )
    return true;
  if (f.neverVisited && !ext?.last_visit_at) return true;
  const nv = ext?.next_visit_planned ?? null;
  if (f.planned && nv && nv > nowIso) return true;
  if (f.plannedToday && nv && nv.slice(0, 10) === nowIso.slice(0, 10))
    return true;
  return false;
}

export function passesFeltFilters(
  c: FeltCustomer,
  f: FeltFilters,
  mySalesId: number | null,
  nowIso: string,
): boolean {
  return (
    passesShowAlso(c, f) &&
    passesSegment(c, f) &&
    passesVisit(c, f) &&
    passesLenses(c, f, mySalesId, nowIso)
  );
}

/**
 * Kontekst-følsomme counts (addendum 2): hver count viser "hvor mange
 * matcher denne facet, når alle ANDRE grupper er filtreret som nu".
 * Så en count kan skifte når man krydser af i en anden gruppe, men
 * er stabil inden for samme gruppe. Base-grundmængden er den fulde
 * data (samme på kort og Dagens).
 */
export function computeFeltFilterCounts(
  customers: FeltCustomer[],
  filters: FeltFilters,
  mySalesId: number | null,
  nowIso: string,
): FeltFilterCounts {
  const c: FeltFilterCounts = {
    onlyMine: 0,
    neverVisited: 0,
    planned: 0,
    plannedToday: 0,
    visitStatuses: { must_visit: 0, soon: 0, on_plan: 0, no_urgency: 0 },
    segments: { A: 0, B: 0, C: 0, X: 0 },
    showLeads: 0,
    showInactive: 0,
  };
  const todayDate = nowIso.slice(0, 10);
  for (const cu of customers) {
    const ext = cu.extension;
    const seg = (ext?.segment ?? "X") as Segment;

    // Linser: pass alle andre grupper (showAlso, segment, visit)
    if (
      passesShowAlso(cu, filters) &&
      passesSegment(cu, filters) &&
      passesVisit(cu, filters)
    ) {
      if (typeof mySalesId === "number" && cu.sales_id === mySalesId) {
        c.onlyMine++;
      }
      if (!ext?.last_visit_at) c.neverVisited++;
      const nv = ext?.next_visit_planned ?? null;
      if (nv && nv > nowIso) c.planned++;
      if (nv && nv.slice(0, 10) === todayDate) c.plannedToday++;
    }

    // Besøg: pass alle andre grupper (showAlso, segment, lenses)
    if (
      passesShowAlso(cu, filters) &&
      passesSegment(cu, filters) &&
      passesLenses(cu, filters, mySalesId, nowIso)
    ) {
      c.visitStatuses[visitStatusToGroup(cu.priority.status)]++;
    }

    // Segment: pass alle andre grupper (showAlso, visit, lenses).
    // L tælles ikke her — den tælles i showLeads.
    if (
      seg !== "L" &&
      passesShowAlso(cu, filters) &&
      passesVisit(cu, filters) &&
      passesLenses(cu, filters, mySalesId, nowIso)
    ) {
      c.segments[seg as ClassifiedSegment]++;
    }

    // Vis også: tælles UDEN egen gruppes gate — vis hvor mange skjulte
    // kunder der ville komme til hvis toggle blev tændt (givet andre
    // filtre). Segment-gaten ignoreres for L (L er ikke i segment).
    if (
      seg === "L" &&
      passesVisit(cu, filters) &&
      passesLenses(cu, filters, mySalesId, nowIso) &&
      // Inaktive L kræver også showInactive for at komme frem
      (ext?.is_active !== false || filters.showInactive)
    ) {
      c.showLeads++;
    }
    if (
      ext?.is_active === false &&
      passesSegment(cu, filters) &&
      passesVisit(cu, filters) &&
      passesLenses(cu, filters, mySalesId, nowIso) &&
      // Inaktive L kræver også showLeads for at komme frem
      (seg !== "L" || filters.showLeads)
    ) {
      c.showInactive++;
    }
  }
  return c;
}
