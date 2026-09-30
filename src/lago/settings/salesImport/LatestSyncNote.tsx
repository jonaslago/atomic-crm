import { useQuery } from "@tanstack/react-query";

import { SYNC_RUNS_KEY } from "@/lago/settings/SyncRunsSection";

import { fetchLatestSyncRuns } from "./syncRunsAccess";

/**
 * Brief 62 §1 · viser den seneste sync-note for et givet datasæt
 * ordret under en import-kvittering. Monospace, --fg-2, dæmpet.
 *
 * Deler cache med SyncRunsSection så en import-mutation der invaliderer
 * SYNC_RUNS_KEY opdaterer begge på én gang.
 */

export function LatestSyncNote({ datasaet }: { datasaet: string }) {
  const query = useQuery({
    queryKey: SYNC_RUNS_KEY,
    queryFn: () => fetchLatestSyncRuns(5),
    staleTime: 30_000,
  });
  const run = (query.data ?? []).find((r) => r.datasaet === datasaet);
  if (!run) return null;
  const note = run.note?.trim() ? run.note : "(ingen note)";
  return (
    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[13px] text-[var(--fg-2)]">
      {note}
    </pre>
  );
}
