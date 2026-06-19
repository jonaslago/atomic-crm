// Single source of truth for "how often should we visit each customer".
// Jonas tunes the numbers here; everywhere else in the LAGO code reads
// from this module via SEGMENT_INTERVAL_DAYS / SOON_RATIO.
//
// (When we later promote this to a DB-backed setting that Jonas can edit
// in-app, the same constants will be the fall-back defaults.)

export type Segment = "A" | "B" | "C";

/**
 * Expected days between visits per segment.
 * - A = high-touch wine/spirit retailers, every ~2 weeks
 * - B = mid-frequency, every ~4 weeks
 * - C = low-touch, every ~8 weeks
 */
export const SEGMENT_INTERVAL_DAYS: Record<Segment, number> = {
  A: 14,
  B: 28,
  C: 56,
};

/** Default interval used when a customer has no segment yet. */
export const DEFAULT_INTERVAL_DAYS = SEGMENT_INTERVAL_DAYS.B;

/**
 * Once a customer is within (1 - SOON_RATIO) of the interval ending
 * (e.g. with SOON_RATIO=0.85, the last 15 % of the interval), the status
 * flips from "på plan" (green) to "snart" (yellow).
 */
export const SOON_RATIO = 0.85;

export function intervalForSegment(
  segment: Segment | null | undefined,
): number {
  if (segment === "A" || segment === "B" || segment === "C") {
    return SEGMENT_INTERVAL_DAYS[segment];
  }
  return DEFAULT_INTERVAL_DAYS;
}
