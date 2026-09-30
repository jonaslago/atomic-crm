import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/lago/ui/Icon";

import { fetchLatestSyncRuns } from "./salesImport/syncRunsAccess";

/**
 * Brief 62 §2 · "Seneste importkørsler" — fem rækker, ingen filtrering.
 *
 * Spørgsmålet er næsten altid "hvad skete der sidste gang" eller
 * "hvornår begyndte det her" — den slags kræver ikke længere et
 * databaseopslag.
 *
 * Noten vises ORDRET (§1's regel også her). Er noten tom, står
 * "(ingen note)" så man ved, at der ikke er skjult noget.
 */

export const SYNC_RUNS_KEY = ["lago-sync-runs-latest"] as const;

const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function SyncRunsSection() {
  const query = useQuery({
    queryKey: SYNC_RUNS_KEY,
    queryFn: () => fetchLatestSyncRuns(5),
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seneste importkørsler</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="flex items-center gap-2 text-sm text-[var(--fg-2)]">
            <Icon icon={Loader2} size="sm" className="animate-spin" />
            Henter…
          </div>
        ) : query.error ? (
          <p className="text-sm text-[var(--fg-2)]">
            Kunne ikke hente importkørsler. Prøv at genindlæse.
          </p>
        ) : (query.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--fg-2)]">
            Ingen importkørsler endnu.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {(query.data ?? []).map((r) => (
              <li key={r.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="tabular-nums text-[var(--fg-3)]">
                    #{r.id}
                  </span>
                  <span className="tabular-nums text-[var(--fg-2)]">
                    {dateFmt.format(new Date(r.koert_at))}
                  </span>
                  <span className="font-medium text-[var(--fg)]">
                    {r.datasaet}
                  </span>
                  {r.er_testdata && (
                    <span className="rounded-sm bg-[var(--surface-3)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--fg-3)] uppercase tracking-wide">
                      testdata
                    </span>
                  )}
                </div>
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[13px] text-[var(--fg-2)]">
                  {r.note?.trim() ? r.note : "(ingen note)"}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
