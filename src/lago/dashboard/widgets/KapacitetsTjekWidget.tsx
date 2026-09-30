import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { WidgetShell } from "../WidgetShell";

/**
 * Kapacitets-tjekket (brief 86 §6 · 28. sep 2026, rev. samme dag).
 *
 * Spørgsmålet er IKKE "har de planlagt nok besøg denne uge". Det er
 * en aktivitetsmåling, og planen svinger fra dag til dag. Spørgsmålet
 * ER: passer segmenteringen — altså behov/år udledt af (kunder ×
 * intervaller) — til de mennesker vi har?
 *
 *   kapacitet/år = saelgere × feltdage_per_uge × besoeg_per_dag ×
 *                  uger_per_aar × (1 − reserve_pct/100)
 *
 * Kickoff-antagelser i lago_settings.visit_capacity (default 2 · 4 · 5 ·
 * 45 · 15 %). Ole kan justere dem i Indstillinger — hele pointen er, at
 * han kan skrive "5 besøg om dagen" og se prisen med det samme, uden
 * en udvikler.
 *
 * Behov/år kommer fra visit_intervals (A=30, B=60, C=75 dage) og
 * kunde-tællingen: kunder × 365 / intervaldage. Uklassificeret indgår
 * ikke — kunder uden segment har ingen kadence-krav.
 *
 * Antagelserne SKAL stå på skærmen — så Ole altid kan se hvad tjekket
 * hviler på uden at åbne Indstillinger.
 */

interface Intervals {
  A: number;
  B: number;
  C: number;
}

interface Capacity {
  saelgere: number;
  feltdage_per_uge: number;
  besoeg_per_dag: number;
  uger_per_aar: number;
  reserve_pct: number;
}

const DEFAULT_INTERVALS: Intervals = { A: 30, B: 60, C: 75 };
const DEFAULT_CAPACITY: Capacity = {
  saelgere: 2,
  feltdage_per_uge: 4,
  besoeg_per_dag: 5,
  uger_per_aar: 45,
  reserve_pct: 15,
};

interface Data {
  intervals: Intervals;
  capacity: Capacity;
  kunder_a: number;
  kunder_b: number;
  kunder_c: number;
  behov_per_aar: number;
  kapacitet_per_aar: number;
}

async function fetchKapacitet(): Promise<Data> {
  const supabase = getSupabaseClient();

  const [intervalsRes, capacityRes, companiesRes] = await Promise.all([
    supabase
      .from("lago_settings")
      .select("value")
      .eq("key", "visit_intervals")
      .maybeSingle(),
    supabase
      .from("lago_settings")
      .select("value")
      .eq("key", "visit_capacity")
      .maybeSingle(),
    supabase
      .from("companies_lago")
      .select("company_id, segment")
      .eq("is_active", true)
      .eq("is_visible_to_sales", true)
      .in("segment", ["A", "B", "C"]),
  ]);

  if (intervalsRes.error) throw intervalsRes.error;
  if (capacityRes.error) throw capacityRes.error;
  if (companiesRes.error) throw companiesRes.error;

  const iv = intervalsRes.data?.value as Partial<Intervals> | undefined;
  const intervals: Intervals = {
    A: iv?.A ?? DEFAULT_INTERVALS.A,
    B: iv?.B ?? DEFAULT_INTERVALS.B,
    C: iv?.C ?? DEFAULT_INTERVALS.C,
  };

  const cv = capacityRes.data?.value as Partial<Capacity> | undefined;
  const capacity: Capacity = {
    saelgere: cv?.saelgere ?? DEFAULT_CAPACITY.saelgere,
    feltdage_per_uge: cv?.feltdage_per_uge ?? DEFAULT_CAPACITY.feltdage_per_uge,
    besoeg_per_dag: cv?.besoeg_per_dag ?? DEFAULT_CAPACITY.besoeg_per_dag,
    uger_per_aar: cv?.uger_per_aar ?? DEFAULT_CAPACITY.uger_per_aar,
    reserve_pct: cv?.reserve_pct ?? DEFAULT_CAPACITY.reserve_pct,
  };

  let kunder_a = 0;
  let kunder_b = 0;
  let kunder_c = 0;
  for (const c of (companiesRes.data ?? []) as Array<{ segment: string }>) {
    if (c.segment === "A") kunder_a++;
    else if (c.segment === "B") kunder_b++;
    else if (c.segment === "C") kunder_c++;
  }

  const behov_per_aar =
    (kunder_a * 365) / intervals.A +
    (kunder_b * 365) / intervals.B +
    (kunder_c * 365) / intervals.C;

  const kapacitet_per_aar =
    capacity.saelgere *
    capacity.feltdage_per_uge *
    capacity.besoeg_per_dag *
    capacity.uger_per_aar *
    (1 - capacity.reserve_pct / 100);

  return {
    intervals,
    capacity,
    kunder_a,
    kunder_b,
    kunder_c,
    behov_per_aar,
    kapacitet_per_aar,
  };
}

const antalFmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

function BalanceLine({
  behov,
  kapacitet,
}: {
  behov: number;
  kapacitet: number;
}) {
  const diff = behov - kapacitet;
  const pct = kapacitet > 0 ? (diff / kapacitet) * 100 : 0;
  if (kapacitet === 0) {
    return <span className="text-[var(--fg-3)]">Kapacitet 0 — antagelser mangler</span>;
  }
  if (diff <= 0) {
    const overskud = Math.abs(diff);
    return (
      <span className="text-[var(--st-green-fg)]">
        Kapaciteten rækker · {antalFmt.format(overskud)} besøg/år i overskud
        ({antalFmt.format(-pct)} %)
      </span>
    );
  }
  const tone =
    pct <= 30 ? "text-[var(--st-amber-fg)]" : "text-[var(--st-red-fg)]";
  return (
    <span className={tone}>
      Behovet overstiger kapaciteten med {antalFmt.format(diff)} besøg/år
      (+{antalFmt.format(pct)} %)
    </span>
  );
}

export function KapacitetsTjekWidget() {
  const query = useQuery({
    queryKey: ["lago-kapacitets-tjek"],
    queryFn: fetchKapacitet,
    staleTime: 60_000,
  });

  const data = query.data;

  return (
    <WidgetShell
      title="Kapacitets-tjekket"
      subtitle="Passer segmenteringen til de mennesker, vi har?"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={!data}
      emptyState="Ingen kunder i A/B/C endnu."
    >
      {data && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 @[560px]:flex-row">
            <div className="flex-1 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-4">
              <div className="text-[13px] font-medium text-[var(--fg-2)]">
                Behov
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums text-[var(--fg)]">
                {antalFmt.format(data.behov_per_aar)}
              </div>
              <div className="mt-1 text-xs text-[var(--fg-3)]">
                besøg/år · A {data.kunder_a} × 365/{data.intervals.A} + B {data.kunder_b} × 365/{data.intervals.B} + C {data.kunder_c} × 365/{data.intervals.C}
              </div>
            </div>
            <div className="flex-1 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-4">
              <div className="text-[13px] font-medium text-[var(--fg-2)]">
                Kapacitet
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums text-[var(--fg)]">
                {antalFmt.format(data.kapacitet_per_aar)}
              </div>
              <div className="mt-1 text-xs text-[var(--fg-3)]">
                besøg/år · {data.capacity.saelgere} sælgere × {data.capacity.feltdage_per_uge} feltdage × {data.capacity.besoeg_per_dag} besøg × {data.capacity.uger_per_aar} uger × (1 − {data.capacity.reserve_pct} %)
              </div>
            </div>
          </div>
          <div className="rounded-md bg-[var(--surface-1)] px-4 py-3 text-sm">
            <BalanceLine
              behov={data.behov_per_aar}
              kapacitet={data.kapacitet_per_aar}
            />
          </div>
          <div className="text-xs text-[var(--fg-3)]">
            Antagelser rettes i Indstillinger → visit_capacity.
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
