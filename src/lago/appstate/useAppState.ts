import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { fetchAppState, isMaintenanceActive, type AppState } from "./dataAccess";

/**
 * Brief 57 §5 · driftstilstands-poller.
 *
 * Tjekkes ved opstart og derefter hvert 30. sekund — ikke kun ved
 * sideskift. En sælger, der står med appen åben i en dør, skal ikke
 * gemme ind i en halv migration.
 *
 * Fail-open (dataAccess.ts): fejler læsningen returneres et default-
 * state med vedligehold=false. En kortvarig netværksfejl må ikke låse
 * hele salgsstyrken ude.
 */

export const APP_STATE_KEY = ["lago-app-state"] as const;

const POLL_MS = 30_000;

export function useAppState(): {
  state: AppState;
  isMaintenance: boolean;
} {
  const query = useQuery({
    queryKey: APP_STATE_KEY,
    queryFn: fetchAppState,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    // Første indlæsning: kort staleTime så en admin's UPDATE ses hurtigt
    // af sælgeren uden at vente på næste poll-cyklus.
    staleTime: 5_000,
  });

  const qc = useQueryClient();

  // Brief 57 §2: `slutter` afgør. Når den er passeret, skal skærmen
  // lukke op af sig selv — uden en poll. Vi sætter en time-out præcis
  // ved slutter-tidspunktet der invaliderer query'en og trækker frisk
  // state. Poll'en bagefter fanger evt. forlængelse.
  useEffect(() => {
    if (!query.data?.slutter) return;
    const ms = new Date(query.data.slutter).getTime() - Date.now();
    if (ms <= 0 || ms > 24 * 60 * 60_000) return;
    const t = window.setTimeout(() => {
      qc.invalidateQueries({ queryKey: APP_STATE_KEY });
    }, ms + 500);
    return () => window.clearTimeout(t);
  }, [query.data?.slutter, qc]);

  const state = query.data ?? {
    id: 1,
    vedligehold: false,
    besked: null,
    slutter: null,
    slaaet_til_af: null,
    slaaet_til: null,
  };

  return { state, isMaintenance: isMaintenanceActive(state) };
}
