import { useQuery } from "@tanstack/react-query";

import {
  DEFAULT_INTERVALS_CONFIG,
  type IntervalsConfig,
} from "@/lago/customers/priority";

import { fetchVisitIntervals } from "./dataAccess";

const QUERY_KEY = ["lago-visit-intervals"] as const;

/**
 * Reactive access to the current visit-interval configuration. Every
 * felt-surface (Dagens, kundelisten, dashboard badge) calls this hook —
 * they share a single react-query cache so redigering i Settings-siden
 * ripples ud til alle skærme uden ny deploy.
 *
 * Falls back to the compile-time defaults (`DEFAULT_INTERVALS_CONFIG`)
 * while the query is still resolving, so first paint isn't blocked.
 */
export function useVisitIntervals(): IntervalsConfig {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchVisitIntervals,
    staleTime: 60_000,
  });
  return query.data ?? DEFAULT_INTERVALS_CONFIG;
}

export function visitIntervalsQueryKey() {
  return QUERY_KEY;
}
