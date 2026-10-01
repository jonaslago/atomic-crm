import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { WidgetShell } from "../WidgetShell";
import { fetchAllEffectiveLines, type EffectiveLine } from "./openOrdersData";

/**
 * §97-2 (1. okt 2026): Åbne ordrer pr. bunke — ledelsens skærm.
 *
 * Samme seks bunker som kundekortet, samme kilde
 * (open_orders_effective_lago), samme klassificering. Pr. bunke:
 * antal ordrer og beløb. Plus totalrække.
 *
 * Bunkerækkefølge = prioritet fra §32a + §32h.
 */

type BucketKey =
  | "klar"
  | "aftalt_dato"
  | "aftalt_mav"
  | "afventer"
  | "reservation"
  | "en_primeur";

const BUCKET_ORDER: BucketKey[] = [
  "klar",
  "aftalt_dato",
  "aftalt_mav",
  "afventer",
  "reservation",
  "en_primeur",
];

const BUCKET_LABELS: Record<BucketKey, string> = {
  klar: "Klar til levering – uden aftale",
  aftalt_dato: "Aftalt levering – med dato",
  aftalt_mav: "Aftalt levering – med andre varer",
  afventer: "Afventer ankomst af varer",
  reservation: "I reservation",
  en_primeur: "En Primeur",
};

function classifyBucket(line: EffectiveLine): BucketKey {
  const statusCode = line.status?.split(" ")[0] ?? null;
  const leveringCode = line.levering?.split(" ")[0] ?? null;
  if (statusCode === "21") return "en_primeur";
  if (leveringCode === "5") return "reservation";
  if (line.lagerstatus_effective === "restordre") return "afventer";
  if (line.har_oensket_dato) return "aftalt_dato";
  if (line.mav) return "aftalt_mav";
  return "klar";
}

const krFmt = new Intl.NumberFormat("da-DK", {
  style: "decimal",
  maximumFractionDigits: 0,
});

export function OrdreBunkerWidget() {
  const query = useQuery({
    queryKey: ["lago-ordre-effective-all"],
    queryFn: fetchAllEffectiveLines,
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const lines = query.data ?? [];
    const totals = new Map<BucketKey, { orders: Set<string>; belob: number }>();
    for (const key of BUCKET_ORDER) {
      totals.set(key, { orders: new Set(), belob: 0 });
    }
    for (const line of lines) {
      if (line.er_par_komponent) continue;
      const bucket = classifyBucket(line);
      const t = totals.get(bucket)!;
      t.orders.add(line.ordre_nr);
      t.belob += line.ej_faktureret ?? 0;
    }
    return BUCKET_ORDER.map((key) => ({
      key,
      label: BUCKET_LABELS[key],
      orders: totals.get(key)!.orders.size,
      belob: totals.get(key)!.belob,
      // §97-5: En Primeur shows antal in addition to beløb (which is 0)
      antal:
        key === "en_primeur"
          ? lines
              .filter(
                (l) =>
                  !l.er_par_komponent &&
                  (l.status?.split(" ")[0] ?? null) === "21",
              )
              .reduce((s, l) => s + (l.antal ?? 0), 0)
          : null,
    }));
  }, [query.data]);

  const total = useMemo(
    () => ({
      orders: rows.reduce((s, r) => s + r.orders, 0),
      belob: rows.reduce((s, r) => s + r.belob, 0),
    }),
    [rows],
  );

  return (
    <WidgetShell
      title="Åbne ordrer pr. bunke"
      subtitle="Hvad venter ordren på — samme bunker som kundekortet"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      emptyState="Ingen åbne ordrer."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
              <th className="pb-2 pr-3 font-medium">Bunke</th>
              <th className="pb-2 pr-3 text-right font-medium">Ordrer</th>
              <th className="pb-2 text-right font-medium">Beløb</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3 text-[var(--fg)]">{r.label}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.orders}
                </td>
                <td className="py-2 text-right tabular-nums text-[var(--fg)]">
                  {krFmt.format(r.belob)} kr.
                  {r.antal != null && r.belob === 0 && (
                    <span className="ml-1 text-[var(--fg-3)]">
                      ({krFmt.format(r.antal)} stk.)
                    </span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--fg-3)] font-bold">
              <td className="py-2 pr-3 text-[var(--fg)]">I alt</td>
              <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                {total.orders}
              </td>
              <td className="py-2 text-right tabular-nums text-[var(--fg)]">
                {krFmt.format(total.belob)} kr.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
