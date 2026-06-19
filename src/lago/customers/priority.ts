import {
  intervalForSegment,
  SOON_RATIO,
  type Segment,
} from "./segmentIntervals";

export type VisitStatus = "overdue" | "soon" | "on_plan" | "never_visited";

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeVisitPriority(
  lastVisitISO: string | null | undefined,
  segment: Segment | null | undefined,
  now: Date = new Date(),
): VisitPriority {
  const intervalDays = intervalForSegment(segment);

  if (!lastVisitISO) {
    return {
      status: "never_visited",
      intervalDays,
      daysSinceVisit: null,
      daysOverdue: null,
      // Push never-visited above any numerically-overdue customer.
      sortScore: Number.POSITIVE_INFINITY,
    };
  }

  const last = new Date(lastVisitISO);
  const daysSinceVisit = Math.floor(
    (now.getTime() - last.getTime()) / MS_PER_DAY,
  );
  const daysOverdue = daysSinceVisit - intervalDays;

  let status: VisitStatus;
  if (daysOverdue > 0) {
    status = "overdue";
  } else if (daysSinceVisit >= intervalDays * SOON_RATIO) {
    status = "soon";
  } else {
    status = "on_plan";
  }

  return {
    status,
    intervalDays,
    daysSinceVisit,
    daysOverdue,
    sortScore: daysOverdue,
  };
}

const STATUS_ORDER: Record<VisitStatus, number> = {
  never_visited: 0,
  overdue: 1,
  soon: 2,
  on_plan: 3,
};

/**
 * Comparator that puts the most urgent customer first:
 * never_visited → overdue (most overdue first) → soon → on_plan.
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
