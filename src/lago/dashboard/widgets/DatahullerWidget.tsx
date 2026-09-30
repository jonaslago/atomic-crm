import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button as LagoButton } from "@/lago/ui/Button";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { WidgetShell } from "../WidgetShell";

/**
 * Datahuller (Domain-brief 18 §4.3).
 *
 * Én liste med filter — ikke fire widgets. Formål: gøre grundlaget
 * rigtigt så segment, dækning og rute virker.
 *
 * Fire hul-typer:
 *   - uden_ejer      : companies.sales_id IS NULL
 *   - uden_kontakt   : ingen tilknyttet contacts-række
 *   - uden_adresse   : companies.address IS NULL (kan ikke geokodes)
 *   - uden_segment   : companies_lago.segment = 'X'
 *
 * Klik → kundekortet. Formålet er ikke at handle på widget'en men at
 * navigere til det sted problemet kan rettes.
 */

type HullType =
  | "uden_ejer"
  | "uden_kontakt"
  | "uden_adresse"
  | "uden_segment"
  | "uden_distrikt";

const FILTER_LABEL: Record<HullType, string> = {
  // Tillæg 26A §3: "Uden ejer" er ikke et hul — det er en kø.
  // Kunderne mangler ikke data; de mangler en beslutning (VISMA-kode
  // 999 eller historisk 13/2/0 → skal tildeles en sælger).
  uden_ejer: "Skal tildeles en sælger",
  uden_kontakt: "Uden kontakt",
  uden_adresse: "Uden adresse",
  uden_segment: "Uden segment (X)",
  // §32b (30. sep 2026): customers without district — on par with
  // missing seller. VISMA distriktskode 0 maps to NULL.
  uden_distrikt: "Intet distrikt",
};

interface HullRow {
  id: number;
  name: string;
  city: string | null;
  hull_type: HullType;
}

async function fetchDatahuller(): Promise<{
  counts: Record<HullType, number>;
  rowsByType: Record<HullType, HullRow[]>;
}> {
  const supabase = getSupabaseClient();

  // Brief 57 (17. sep 2026): server-side RPC. Erstatter fire separate
  // .select(count:'exact')-queries + hele contacts-tabellen + hele
  // companies-tabellen (~2000+ rows over wire) med ét kald der
  // returnerer 4 tal + op til 20 sample-rows. iPhone-netværk kunne
  // ikke tåle det oprindelige volumen; desktop kunne.
  const { data, error } = await supabase.rpc("dashboard_datahuller_lago");
  if (error) throw error;

  const payload = data as {
    counts: Record<HullType, number>;
    rows: Array<{
      id: number;
      name: string;
      city: string | null;
      hull_type: HullType;
    }>;
  } | null;

  const counts: Record<HullType, number> = payload?.counts ?? {
    uden_ejer: 0,
    uden_kontakt: 0,
    uden_adresse: 0,
    uden_segment: 0,
  };

  const rowsByType: Record<HullType, HullRow[]> = {
    uden_ejer: [],
    uden_kontakt: [],
    uden_adresse: [],
    uden_segment: [],
  };
  for (const r of payload?.rows ?? []) {
    rowsByType[r.hull_type].push({
      id: r.id,
      name: r.name,
      city: r.city,
      hull_type: r.hull_type,
    });
  }

  return { counts, rowsByType };
}

export function DatahullerWidget() {
  const [filter, setFilter] = useState<HullType>("uden_ejer");

  const query = useQuery({
    queryKey: ["lago-datahuller"],
    queryFn: fetchDatahuller,
    staleTime: 5 * 60_000,
  });

  const totalCount = query.data
    ? Object.values(query.data.counts).reduce((a, b) => a + b, 0)
    : 0;

  const activeRows = query.data?.rowsByType[filter] ?? [];
  const clipped = activeRows.slice(0, 5);

  return (
    <WidgetShell
      title="Kunder med manglende data"
      subtitle="Registreringer der er mangelfulde"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={totalCount === 0}
      count={
        totalCount > 0
          ? {
              label: `${totalCount} registreringer`,
              tone: "amber",
            }
          : undefined
      }
      emptyState="Ingen datahuller lige nu — grundlaget er rent."
    >
      {/* Brief 49 §2 (17. sep 2026): filter-chips = LagoButton, ikke
          shadcn med rounded-full. Trykmål 44 px, radius 4 px. */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABEL) as HullType[]).map((t) => {
          const count = query.data?.counts[t] ?? 0;
          const active = filter === t;
          return (
            <LagoButton
              key={t}
              variant={active ? "primary" : "secondary"}
              onClick={() => setFilter(t)}
              disabled={count === 0}
            >
              {FILTER_LABEL[t]}
              <span className="tabular-nums opacity-70">({count})</span>
            </LagoButton>
          );
        })}
      </div>
      <ul className="flex flex-col gap-2">
        {clipped.map((r) => (
          <li key={r.id} className="rounded-lg bg-[var(--surface-1)] px-3 py-2">
            <Link
              to={`/companies/${r.id}/show`}
              className="block text-base font-medium text-[var(--fg)] no-underline hover:underline"
            >
              {r.name}
            </Link>
            {r.city && (
              <span className="text-[13px] text-[var(--fg-2)]">{r.city}</span>
            )}
          </li>
        ))}
      </ul>
      {/* Brief 43-gæld: "Se alle N (vises snart)" fjernet. Enten
          virker linket, eller også står det der ikke. */}
    </WidgetShell>
  );
}
