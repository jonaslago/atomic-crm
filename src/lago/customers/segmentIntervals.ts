// Single source of truth for "how often should we visit each customer".
// Jonas tunes the numbers here; everywhere else in the LAGO code reads
// from this module via SEGMENT_INTERVAL_DAYS / SOON_RATIO.
//
// Brief 13 udvidede segmentet fra {A,B,C} til {A,B,C,X,L}:
//   - A/B/C er stadig de reguleret besøgte segmenter
//   - X = uklassificeret (default for importerede kunder)
//   - L = lead
// X og L har ikke egne intervaller — de behandles som "default"
// (samme som B). Sælger klassificerer til A/B/C i CRM, hvorefter
// intervallet træder i kraft.

export type Segment = "A" | "B" | "C" | "X" | "L";

/**
 * Expected days between visits per classificeret segment.
 * - A = high-touch wine/spirit retailers, every ~2 weeks
 * - B = mid-frequency, every ~4 weeks
 * - C = low-touch, every ~8 weeks
 */
export const SEGMENT_INTERVAL_DAYS: Record<"A" | "B" | "C", number> = {
  A: 14,
  B: 28,
  C: 56,
};

/** Default interval used when a customer has no segment yet, or is
 *  marked as X (uklassificeret) or L (lead). */
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
  // X (uklassificeret), L (lead), null: fall back to the default interval.
  return DEFAULT_INTERVAL_DAYS;
}
