import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { WidgetShell } from "../WidgetShell";

/**
 * Kontor-overskrift — kun Ringelisten (brief 90 opfølgning · 29. sep 2026).
 *
 * Første version viste fire tal: Ringelisten, Kan sendes, Åbne opgaver,
 * Ordrekommentarer. Tre af dem stod som fulde widgets lige nedenunder
 * — så tælleren dublede indholdet. Reglen fra Jonas 29. sep: "Tællerækken
 * skal kun vise det, der ikke er på skærmen."
 *
 * Ringelisten er det eneste tilbage, fordi den linker til Kunder-siden
 * (ikke til en widget på samme skærm). Simon åbner kontorets forside,
 * ser en enkelt stor rød tælle-boks, og klikker sig ind i Kunder-listen
 * hvis der er noget at ringe efter.
 */

interface Counts {
  ringeliste: number;
}

async function fetchTaellerraekke(): Promise<Counts> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("dashboard_ringeliste_lago", {
    p_limit: 1,
  });
  if (error) throw error;
  const ringData = data as { total?: number } | null;
  return { ringeliste: ringData?.total ?? 0 };
}

interface CellProps {
  label: string;
  value: number;
  hint: string;
  href?: string;
  tone?: "red" | "amber" | "neutral";
}

function Cell({ label, value, hint, href, tone = "neutral" }: CellProps) {
  const toneCls =
    tone === "red"
      ? "text-[var(--st-red-fg)]"
      : tone === "amber"
        ? "text-[var(--st-amber-fg)]"
        : "text-[var(--fg)]";
  const body = (
    <div className="flex-1 rounded-md border border-[var(--line)] bg-[var(--surface-1)] p-4 hover:bg-[var(--surface-2)]">
      <div className="text-[13px] font-medium text-[var(--fg-2)]">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${toneCls}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-[var(--fg-3)]">{hint}</div>
    </div>
  );
  if (!href) return body;
  return (
    <Link to={href} className="flex-1 no-underline">
      {body}
    </Link>
  );
}

export function TaellerraekkeWidget() {
  const query = useQuery({
    queryKey: ["lago-taellerraekke"],
    queryFn: fetchTaellerraekke,
    staleTime: 60_000,
  });

  const c = query.data ?? { ringeliste: 0 };

  return (
    <WidgetShell
      title="Ringelisten"
      subtitle="Kunder over 14 dage ud over intervallet — kontoret må ringe"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={false}
    >
      <Cell
        label="Kunder på listen"
        value={c.ringeliste}
        hint="Klik for at åbne Kunder med ringeliste-filter"
        href="/companies?filter=%7B%22priority_status%22%3A%22overdue%22%7D"
        tone={c.ringeliste > 0 ? "red" : "neutral"}
      />
    </WidgetShell>
  );
}
