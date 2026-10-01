import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { WidgetShell } from "../WidgetShell";
import { fetchAllEffectiveLines } from "./openOrdersData";

/**
 * §97-3 rev. (1. okt 2026): Aldersfordeling — åbne ordrer.
 *
 * Kolonner: 0–7d, 8–14, 15–30, 31–60, 60+, Total, Reservation, EP.
 * Alder = current_date − ordre_dato.
 *
 * Same population as OrdreBunkerWidget:
 *   - Gebyrlinjer (Vej, Energi) excluded
 *   - Par-komponenter excluded
 *   - Reservation shown separately, NOT in total
 *   - En Primeur shown separately (0 kr. + antal stk.)
 *   - Total = age buckets only (not reservation, not EP)
 */

function ageDays(ordreDato: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(ordreDato + "T00:00:00");
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

const krFmt = new Intl.NumberFormat("da-DK", {
  style: "decimal",
  maximumFractionDigits: 0,
});

const GEBYR = new Set(["Vej", "Energi"]);

export function OrdreAlderWidget() {
  const query = useQuery({
    queryKey: ["lago-ordre-effective-all"],
    queryFn: fetchAllEffectiveLines,
    staleTime: 60_000,
  });

  const result = useMemo(() => {
    const lines = query.data ?? [];
    if (lines.length === 0) return null;
    const ages = [0, 0, 0, 0, 0]; // 0-7, 8-14, 15-30, 31-60, 60+
    let reservation = 0;
    let epBelob = 0;
    let epAntal = 0;

    for (const line of lines) {
      if (line.er_par_komponent) continue;
      if (GEBYR.has(line.produktnr ?? "")) continue;

      const statusCode = line.status?.split(" ")[0] ?? null;
      const leveringCode = line.levering?.split(" ")[0] ?? null;
      const belob = line.ej_faktureret ?? 0;

      if (statusCode === "21") {
        epBelob += belob;
        epAntal += line.antal ?? 0;
        continue;
      }

      if (leveringCode === "5") {
        reservation += belob;
        continue;
      }

      const days = ageDays(line.ordre_dato);
      if (days <= 7) ages[0] += belob;
      else if (days <= 14) ages[1] += belob;
      else if (days <= 30) ages[2] += belob;
      else if (days <= 60) ages[3] += belob;
      else ages[4] += belob;
    }

    const buckets = [
      { label: "0–7 dage", belob: ages[0] },
      { label: "8–14 dage", belob: ages[1] },
      { label: "15–30 dage", belob: ages[2] },
      { label: "31–60 dage", belob: ages[3] },
      { label: "60+ dage", belob: ages[4] },
    ];

    // Total = age buckets only. Reservation and EP are separate.
    const total = ages[0] + ages[1] + ages[2] + ages[3] + ages[4];

    return { buckets, reservation, total, epBelob, epAntal };
  }, [query.data]);

  return (
    <WidgetShell
      title="Aldersfordeling — åbne ordrer"
      subtitle="Alder fra ordredato"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={!result}
      emptyState="Ingen åbne ordrer."
    >
      {result && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
                {result.buckets.map((b) => (
                  <th
                    key={b.label}
                    className="pb-2 pr-3 text-right font-medium"
                  >
                    {b.label}
                  </th>
                ))}
                <th className="pb-2 pr-3 text-right font-bold">Total</th>
                <th className="pb-2 pr-3 text-right font-medium">
                  Reservation
                </th>
                <th className="pb-2 text-right font-medium">En Primeur</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--line)]">
                {result.buckets.map((b) => (
                  <td
                    key={b.label}
                    className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]"
                  >
                    {krFmt.format(b.belob)} kr.
                  </td>
                ))}
                <td className="py-2 pr-3 text-right tabular-nums font-bold text-[var(--fg)]">
                  {krFmt.format(result.total)} kr.
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg-2)]">
                  {krFmt.format(result.reservation)} kr.
                </td>
                <td className="py-2 text-right tabular-nums text-[var(--fg-2)]">
                  {krFmt.format(result.epBelob)} kr.
                  {result.epAntal > 0 && (
                    <span className="ml-1 text-[var(--fg-3)]">
                      ({krFmt.format(result.epAntal)} stk.)
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </WidgetShell>
  );
}
