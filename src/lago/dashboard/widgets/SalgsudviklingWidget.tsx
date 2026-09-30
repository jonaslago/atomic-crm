import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { WidgetShell } from "../WidgetShell";

/**
 * Salgsudvikling — år til dato mod sidste år, pr. distrikt (brief 86 §4 ·
 * 28. sep 2026). Ligger over Salgsudviklings-siden med dens fire kort;
 * den fulde side har brug for filtre, den her har brug for ét tal Ole
 * kan læse på fem sekunder.
 *
 * Kilde: v_sales_district_periods (brief 19 · 2. sep 2026). GROUPING SETS
 * giver os både grand total (grouping_id = 3) og distrikt-subtotaler
 * (grouping_id = 1). Vi filtrerer på disse to og lader kundetype-cellerne
 * (grouping_id = 0) ligge — de er for detaljerede til forsiden.
 *
 * Vækst-pct farves grøn/rød med samme tokens som resten af CRM. Kroner
 * afrundes til tusinder for læselighed — ledelsen behøver ikke øre.
 */

interface DistrictRow {
  distrikt: string | null;
  kundetype: string | null;
  grouping_id: number;
  aatd: string | number;
  aatd_sidste_aar: string | number;
  aatd_vaekst_kr: string | number;
  aatd_vaekst_pct: string | number | null;
}

async function fetchSalgsudvikling(): Promise<DistrictRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("v_sales_district_periods")
    .select(
      "distrikt, kundetype, grouping_id, aatd, aatd_sidste_aar, aatd_vaekst_kr, aatd_vaekst_pct",
    )
    .in("grouping_id", [1, 3]);
  if (error) throw error;
  return (data ?? []) as DistrictRow[];
}

const kroneFmt = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});

const pctFmt = new Intl.NumberFormat("da-DK", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "string" ? Number(v) : v;
}

function VaekstCell({ pct }: { pct: number | null }) {
  if (pct === null || Number.isNaN(pct)) {
    return <span className="text-[var(--fg-3)]">–</span>;
  }
  const cls =
    pct > 0
      ? "text-[var(--st-green-fg)]"
      : pct < 0
        ? "text-[var(--st-red-fg)]"
        : "text-[var(--fg)]";
  return <span className={cls}>{pctFmt.format(pct / 100)}</span>;
}

// Rækkefølgen på forsiden: total først, så distrikterne alfabetisk.
// Klients ordning matcher Salgsudviklings-siden hvor Øst/Vest/HQ står.
const DISTRICT_ORDER = ["Øst", "Vest", "HQ"] as const;

export function SalgsudviklingWidget() {
  const query = useQuery({
    queryKey: ["lago-salgsudvikling-forside"],
    queryFn: fetchSalgsudvikling,
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  const total = rows.find((r) => r.grouping_id === 3) ?? null;
  const districts = rows
    .filter((r) => r.grouping_id === 1 && r.distrikt !== null)
    .sort((a, b) => {
      const ai = DISTRICT_ORDER.indexOf(a.distrikt as (typeof DISTRICT_ORDER)[number]);
      const bi = DISTRICT_ORDER.indexOf(b.distrikt as (typeof DISTRICT_ORDER)[number]);
      const aIndex = ai === -1 ? 999 : ai;
      const bIndex = bi === -1 ? 999 : bi;
      return aIndex - bIndex;
    });

  return (
    <WidgetShell
      title="Salgsudvikling"
      subtitle="År til dato mod sidste år · pr. distrikt"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={!total && districts.length === 0}
      emptyState="Ingen salgs­tal endnu."
      seeAllHref="/salgsudvikling"
      seeAllLabel="Åbn Salgsudvikling"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
              <th className="pb-2 pr-3 font-medium">Distrikt</th>
              <th className="pb-2 pr-3 text-right font-medium">År til dato</th>
              <th className="pb-2 pr-3 text-right font-medium">Sidste år</th>
              <th className="pb-2 pr-3 text-right font-medium">Ændring kr</th>
              <th className="pb-2 text-right font-medium">Ændring %</th>
            </tr>
          </thead>
          <tbody>
            {total && (
              <tr className="border-t border-[var(--line)] font-medium">
                <td className="py-2 pr-3 text-[var(--fg)]">I alt</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {kroneFmt.format(toNum(total.aatd))}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg-2)]">
                  {kroneFmt.format(toNum(total.aatd_sidste_aar))}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {kroneFmt.format(toNum(total.aatd_vaekst_kr))}
                </td>
                <td className="py-2 text-right tabular-nums">
                  <VaekstCell
                    pct={
                      total.aatd_vaekst_pct === null
                        ? null
                        : toNum(total.aatd_vaekst_pct)
                    }
                  />
                </td>
              </tr>
            )}
            {districts.map((r) => (
              <tr
                key={r.distrikt}
                className="border-t border-[var(--line)]"
              >
                <td className="py-2 pr-3 text-[var(--fg)]">{r.distrikt}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {kroneFmt.format(toNum(r.aatd))}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg-2)]">
                  {kroneFmt.format(toNum(r.aatd_sidste_aar))}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {kroneFmt.format(toNum(r.aatd_vaekst_kr))}
                </td>
                <td className="py-2 text-right tabular-nums">
                  <VaekstCell
                    pct={
                      r.aatd_vaekst_pct === null
                        ? null
                        : toNum(r.aatd_vaekst_pct)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
