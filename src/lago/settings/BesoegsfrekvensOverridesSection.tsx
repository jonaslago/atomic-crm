import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { useVisitIntervals } from "@/lago/settings/useVisitIntervals";
import { useSellerLookup } from "@/lago/settings/useSellerLookup";

/**
 * Brief 65 tillæg A §2 (18. sep 2026) · Kunder med egen besøgsfrekvens
 *
 * Læseflade. Ingen redigering her — ændringer sker paa kundekortet,
 * hvor konteksten er. Sorteret efter afvigelsens størrelse (|egen −
 * standard|) saa "hvem er længst fra standarden" er øverst; det er
 * det, man leder efter naar man samler overrides op til et halvaars-
 * gennemsyn.
 *
 * X/L har ingen standard (segmentet har ikke en kadence), saa "Egen
 * frekvens" er absolut afvigelse og staar øverst automatisk.
 */

interface OverrideRow {
  company_id: number;
  name: string;
  segment: "A" | "B" | "C" | "X" | "L" | null;
  besoegsfrekvens_dage: number;
  besoegsfrekvens_note: string | null;
  besoegsfrekvens_sat_af: number | null;
  besoegsfrekvens_sat: string | null;
}

async function fetchOverrides(): Promise<OverrideRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("companies_lago")
    .select(
      "company_id, segment, besoegsfrekvens_dage, besoegsfrekvens_note, besoegsfrekvens_sat_af, besoegsfrekvens_sat, companies!inner(name)",
    )
    .not("besoegsfrekvens_dage", "is", null);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    company_id: r.company_id,
    name: Array.isArray(r.companies) ? r.companies[0]?.name : r.companies?.name,
    segment: r.segment,
    besoegsfrekvens_dage: r.besoegsfrekvens_dage,
    besoegsfrekvens_note: r.besoegsfrekvens_note,
    besoegsfrekvens_sat_af: r.besoegsfrekvens_sat_af,
    besoegsfrekvens_sat: r.besoegsfrekvens_sat,
  }));
}

function standardForSegment(
  seg: OverrideRow["segment"],
  intervals: { intervalDays: { A: number; B: number; C: number } },
): number | null {
  if (seg === "A" || seg === "B" || seg === "C") return intervals.intervalDays[seg];
  return null; // X/L har ingen kadence som standard
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

export function BesoegsfrekvensOverridesSection() {
  const query = useQuery({
    queryKey: ["lago-besoegsfrekvens-overrides"],
    queryFn: fetchOverrides,
    staleTime: 60_000,
  });
  const intervals = useVisitIntervals();
  const sellers = useSellerLookup();

  const sorted = useMemo(() => {
    const rows = query.data ?? [];
    return [...rows].sort((a, b) => {
      const sa = standardForSegment(a.segment, intervals);
      const sb = standardForSegment(b.segment, intervals);
      // Absolut afvigelse. X/L uden standard = "helt afvigende" → +Inf.
      const da = sa == null ? Number.POSITIVE_INFINITY : Math.abs(a.besoegsfrekvens_dage - sa);
      const db = sb == null ? Number.POSITIVE_INFINITY : Math.abs(b.besoegsfrekvens_dage - sb);
      if (db !== da) return db - da;
      return a.name.localeCompare(b.name, "da");
    });
  }, [query.data, intervals]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Kunder med egen besøgsfrekvens
          {sorted.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[var(--fg-2)]">
              ({sorted.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <p className="text-sm text-[var(--fg-2)]">Henter…</p>
        ) : query.error ? (
          <p className="text-sm text-[var(--st-red-fg)]">
            Kunne ikke hente. Prøv at genindlæse.
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-[var(--fg-2)]">
            Ingen kunder har en egen besøgsfrekvens.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[12px] font-medium uppercase tracking-wide text-[var(--fg-2)]">
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">Segment</th>
                  <th className="py-2 pr-3 text-right">Standard</th>
                  <th className="py-2 pr-3 text-right">Egen</th>
                  <th className="py-2 pr-3">Sat af</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const standard = standardForSegment(r.segment, intervals);
                  const who = sellers.bySalesId(r.besoegsfrekvens_sat_af) ?? "—";
                  const when = formatDate(r.besoegsfrekvens_sat);
                  return (
                    <tr
                      key={r.company_id}
                      className="border-b border-[var(--line)] last:border-b-0"
                    >
                      <td className="py-2 pr-3">
                        <Link
                          to={`/companies/${r.company_id}/show`}
                          className="text-[var(--fg)] no-underline hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-[var(--fg-2)]">
                        {r.segment ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg-2)]">
                        {standard != null ? `${standard} dage` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                        {r.besoegsfrekvens_dage} dage
                      </td>
                      <td className="py-2 pr-3 text-[var(--fg-2)]">
                        {who}
                        {when && (
                          <span className="text-[var(--fg-3)]">, {when}</span>
                        )}
                      </td>
                      <td className="py-2 text-[var(--fg-2)] italic">
                        {r.besoegsfrekvens_note
                          ? `»${r.besoegsfrekvens_note}«`
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
