import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { WidgetShell } from "../WidgetShell";

/**
 * Besøgsdækning pr. segment × status (brief 86 §3+§12 · 28. sep 2026,
 * omdøbt samme dag efter brief 90-runde).
 *
 * "Dækningsgraden" er droppet fordi det betyder dækningsbidrag i procent
 * — et regnskabsbegreb. En direktør læser overskriften som indtjening,
 * og brief 88 bygger den rigtige dækningsbidrag-visning: kollision
 * uundgåelig. "Besøgsdækning" er felt-salgets ord for det samme; SC-6
 * i story-mappet bruger det allerede.
 *
 * Første widget på ledelsens skærm. Ole åbner CRM og ser med det samme
 * hvor mange kunder der er ajour, trænger snart, og er overskredet —
 * fordelt på segment A/B/C og uklassificeret.
 *
 * Kilde: RPC coverage_by_segment_status(). Live — genberegnes hver gang
 * widget'en hentes, så tallene stemmer med kundelistens venstreskinne
 * hele dagen (snapshottet i coverage_snapshot_lago er kun til historik).
 *
 * Uklassificeret er kunder uden segment A/B/C (dvs. NULL eller X).
 * De 91 uklassificerede kunder har intet visit_priority-record og
 * havner derfor kun i i_alt, ikke i status-kolonnerne — samme opførsel
 * som venstreskinnen viser dem: uden urgency.
 *
 * Overskredet-tallet står i rødt (--st-red-fg) når > 0. Ellers samme
 * neutrale ton som resten. Sum-linjen fremhæves med tykkere border-top.
 */

interface CoverageRow {
  segment: string;
  ajour: number;
  traenger: number;
  overskredet: number;
  uden_besoegspligt: number;
  i_alt: number;
}

async function fetchCoverage(): Promise<CoverageRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("coverage_by_segment_status");
  if (error) throw error;
  return (data ?? []) as CoverageRow[];
}

export function BesoegsdaekningWidget() {
  const query = useQuery({
    queryKey: ["lago-besoegsdaekning"],
    queryFn: fetchCoverage,
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      ajour: acc.ajour + r.ajour,
      traenger: acc.traenger + r.traenger,
      overskredet: acc.overskredet + r.overskredet,
      uden_besoegspligt: acc.uden_besoegspligt + r.uden_besoegspligt,
      i_alt: acc.i_alt + r.i_alt,
    }),
    { ajour: 0, traenger: 0, overskredet: 0, uden_besoegspligt: 0, i_alt: 0 },
  );

  return (
    <WidgetShell
      title="Besøgsdækning"
      subtitle="Alle aktive kunder fordelt på segment og besøgsstatus"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      emptyState="Ingen kunder matcher filteret endnu."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
              <th className="pb-2 pr-3 font-medium">Segment</th>
              <th className="pb-2 pr-3 text-right font-medium">Ajour</th>
              <th className="pb-2 pr-3 text-right font-medium">
                Trænger snart
              </th>
              <th className="pb-2 pr-3 text-right font-medium">Overskredet</th>
              <th className="pb-2 pr-3 text-right font-medium">
                Uden besøgspligt
              </th>
              <th className="pb-2 text-right font-medium">I alt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.segment} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3 text-[var(--fg)]">{r.segment}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.ajour}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.traenger}
                </td>
                <td
                  className={
                    "py-2 pr-3 text-right tabular-nums " +
                    (r.overskredet > 0
                      ? "text-[var(--st-red-fg)]"
                      : "text-[var(--fg)]")
                  }
                >
                  {r.overskredet}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg-2)]">
                  {r.uden_besoegspligt}
                </td>
                <td className="py-2 text-right tabular-nums text-[var(--fg)]">
                  {r.i_alt}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-[var(--line)] font-medium">
              <td className="py-2 pr-3 text-[var(--fg)]">I alt</td>
              <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                {totals.ajour}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                {totals.traenger}
              </td>
              <td
                className={
                  "py-2 pr-3 text-right tabular-nums " +
                  (totals.overskredet > 0
                    ? "text-[var(--st-red-fg)]"
                    : "text-[var(--fg)]")
                }
              >
                {totals.overskredet}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg-2)]">
                {totals.uden_besoegspligt}
              </td>
              <td className="py-2 text-right tabular-nums text-[var(--fg)]">
                {totals.i_alt}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
