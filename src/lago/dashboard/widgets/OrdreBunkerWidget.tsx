import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { WidgetShell } from "../WidgetShell";
import { fetchAllEffectiveLines, type EffectiveLine } from "./openOrdersData";

/**
 * §97-2 rev. (1. okt 2026): Åbne ordrer pr. bunke — ledelsens skærm.
 *
 * Kaskade pr. ORDRE (ikke pr. linje). Samme rækkefølge. Beløb = sum
 * af ordrens linjer. Ingen ordre i to bunker.
 *
 * Bunker:
 *   En Primeur     — alle linjer har status 21
 *   Reservation    — alle linjer har levering 5 (vises under totalen)
 *   Restordre      — mindst én linje er restordre
 *   Afklaret       — har leveringsdato eller MAV (levering=1)
 *   Uafklaret      — hverken dato eller MAV
 *
 * Gebyrlinjer (Vej, Energi) udelukkes.
 * Reservation ud af totalen (muligt salg ≠ åben ordre).
 * En Primeur viser antal i stykker (beløb er 0).
 */

type BucketKey =
  | "uafklaret"
  | "afklaret"
  | "restordre"
  | "reservation"
  | "en_primeur";

const BUCKET_ORDER: BucketKey[] = [
  "uafklaret",
  "afklaret",
  "restordre",
  "en_primeur",
];

const BUCKET_LABELS: Record<BucketKey, string> = {
  uafklaret: "Klar til levering – uden aftale",
  afklaret: "Afklaret levering – med dato eller MAV",
  restordre: "Afventer ankomst af varer",
  reservation: "I reservation",
  en_primeur: "En Primeur",
};

const GEBYR = new Set(["Vej", "Energi"]);

function isGebyr(line: EffectiveLine): boolean {
  return GEBYR.has(line.produktnr ?? "");
}

interface OrderAgg {
  belob: number;
  antal: number;
  hasRestordre: boolean;
  hasDate: boolean;
  hasMav: boolean;
  isEnPrimeur: boolean;
  isReservation: boolean;
  /** True if every non-gebyr line is gebyr (order has no real lines) */
  onlyGebyr: boolean;
}

function classifyOrder(agg: OrderAgg): BucketKey {
  if (agg.onlyGebyr) return "uafklaret"; // should not happen but safe
  if (agg.isEnPrimeur) return "en_primeur";
  if (agg.isReservation) return "reservation";
  if (agg.hasRestordre) return "restordre";
  if (agg.hasDate || agg.hasMav) return "afklaret";
  return "uafklaret";
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

  const { bucketRows, reservationRow, total, epAntal } = useMemo(() => {
    const lines = query.data?.rows ?? [];

    // Aggregate per order
    const orders = new Map<string, OrderAgg>();
    for (const line of lines) {
      if (line.er_par_komponent) continue;
      if (isGebyr(line)) continue;

      const existing = orders.get(line.ordre_nr);
      const statusCode = line.status?.split(" ")[0] ?? null;
      const leveringCode = line.levering?.split(" ")[0] ?? null;

      if (existing) {
        existing.belob += line.ej_faktureret ?? 0;
        existing.antal += line.antal ?? 0;
        if (
          line.lagerstatus_effective === "restordre" ||
          line.lagerstatus_effective === "delvis"
        )
          existing.hasRestordre = true;
        if (line.har_oensket_dato) existing.hasDate = true;
        if (line.mav) existing.hasMav = true;
        // Order-level flags: ALL lines must match
        if (statusCode !== "21") existing.isEnPrimeur = false;
        if (leveringCode !== "5") existing.isReservation = false;
      } else {
        orders.set(line.ordre_nr, {
          belob: line.ej_faktureret ?? 0,
          antal: line.antal ?? 0,
          hasRestordre:
            line.lagerstatus_effective === "restordre" ||
            line.lagerstatus_effective === "delvis",
          hasDate: line.har_oensket_dato === true,
          hasMav: line.mav === true,
          isEnPrimeur: statusCode === "21",
          isReservation: leveringCode === "5",
          onlyGebyr: false,
        });
      }
    }

    // Classify and tally
    const totals = new Map<BucketKey, { orders: number; belob: number }>();
    for (const key of [...BUCKET_ORDER, "reservation" as BucketKey]) {
      totals.set(key, { orders: 0, belob: 0 });
    }
    let epAntalSum = 0;

    for (const agg of orders.values()) {
      const bucket = classifyOrder(agg);
      const t = totals.get(bucket)!;
      t.orders += 1;
      t.belob += agg.belob;
      if (bucket === "en_primeur") epAntalSum += agg.antal;
    }

    const bucketRows = BUCKET_ORDER.map((key) => ({
      key,
      label: BUCKET_LABELS[key],
      ...totals.get(key)!,
    }));

    const reservationRow = {
      key: "reservation" as BucketKey,
      label: BUCKET_LABELS.reservation,
      ...totals.get("reservation")!,
    };

    // Total excludes reservation
    const totalObj = {
      orders: BUCKET_ORDER.reduce((s, k) => s + totals.get(k)!.orders, 0),
      belob: BUCKET_ORDER.reduce((s, k) => s + totals.get(k)!.belob, 0),
    };

    return {
      bucketRows,
      reservationRow,
      total: totalObj,
      epAntal: epAntalSum,
    };
  }, [query.data]);

  return (
    <WidgetShell
      title="Åbne ordrer pr. bunke"
      subtitle="Pr. ordre — hvad venter ordren på"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={bucketRows.length === 0}
      emptyState="Ingen åbne ordrer."
      truncated={query.data?.truncated}
      truncatedRowCount={query.data?.rows.length}
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
            {bucketRows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3 text-[var(--fg)]">{r.label}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.orders}
                </td>
                <td className="py-2 text-right tabular-nums text-[var(--fg)]">
                  {krFmt.format(r.belob)} kr.
                  {r.key === "en_primeur" && r.belob === 0 && epAntal > 0 && (
                    <span className="ml-1 text-[var(--fg-3)]">
                      ({krFmt.format(epAntal)} stk.)
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
            {/* Reservation under totalen, ikke i den */}
            {reservationRow.orders > 0 && (
              <tr className="border-t border-[var(--line)] text-[var(--fg-2)]">
                <td className="py-2 pr-3">{reservationRow.label}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {reservationRow.orders}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {krFmt.format(reservationRow.belob)} kr.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
