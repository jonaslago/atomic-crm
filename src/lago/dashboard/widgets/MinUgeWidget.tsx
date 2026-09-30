import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";

import { WidgetShell } from "../WidgetShell";

/**
 * Min uge (Domain-brief 18 §3.2, rev 10. sep 2026).
 *
 * Resten af ugen (næste 7 dage fra og med i morgen), grupperet pr. dag.
 * Kun antal og navne — ikke fuld anatomi. Formålet er at kunne se
 * fremad, ikke at arbejde i widget'en. Klik på et navn → kundekortet.
 *
 * Samme scope som Min dag: filter på plan-tildelt sælger
 * (next_visit_planned_by = mig).
 */

interface WeekRow {
  company_id: number;
  next_visit_planned: string;
  companies: { id: number; name: string };
}

async function fetchWeekVisits(mySalesId: number): Promise<WeekRow[]> {
  const supabase = getSupabaseClient();
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(tomorrow);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data, error } = await supabase
    .from("companies_lago")
    .select("company_id, next_visit_planned, companies!inner(id, name)")
    .gte("next_visit_planned", tomorrow.toISOString())
    .lt("next_visit_planned", weekEnd.toISOString())
    .eq("next_visit_planned_by", mySalesId)
    // Brief 26 §2 (rev. 16. sep 2026): distrikt-synlig OG aktiv.
    .eq("is_visible_to_sales", true)
    .eq("is_active", true)
    .order("next_visit_planned", { ascending: true });
  if (error) throw error;
  return (data as unknown as WeekRow[]) ?? [];
}

const dayFmt = new Intl.DateTimeFormat("da-DK", { weekday: "long" });
const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
});

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function dayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.getTime() === tomorrow.getTime();
  const weekday = dayFmt.format(d);
  const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  if (isTomorrow) return `I morgen (${label.toLowerCase()})`;
  return `${label} ${dateFmt.format(d)}`;
}

export function MinUgeWidget() {
  const mySalesId = useViewSalesId();

  const query = useQuery({
    queryKey: ["lago-dashboard-min-uge", mySalesId],
    queryFn: () => fetchWeekVisits(mySalesId!),
    enabled: mySalesId != null,
    staleTime: 60_000,
  });

  const rows = query.data ?? [];

  // Gruppér pr. dato-nøgle (YYYY-MM-DD)
  const grouped = new Map<string, WeekRow[]>();
  for (const r of rows) {
    const key = dayKey(r.next_visit_planned);
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }
  const orderedDates = Array.from(grouped.keys()).sort();

  return (
    <WidgetShell
      title="Min uge"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      emptyState="Ingen planlagte besøg de næste 7 dage."
    >
      <ul className="divide-y divide-[var(--line)]">
        {orderedDates.map((date) => {
          const list = grouped.get(date)!;
          return (
            <li key={date} className="py-2 first:pt-0 last:pb-0">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <div className="text-sm font-bold text-[var(--fg)]">
                  {dayLabel(date)}
                </div>
                <div className="text-muted-foreground text-xs font-bold tabular-nums">
                  {list.length} besøg
                </div>
              </div>
              <ul className="text-muted-foreground space-y-0.5 text-sm">
                {list.map((r) => (
                  <li key={r.company_id}>
                    <Link
                      to={`/companies/${r.companies.id}/show`}
                      className="text-[var(--fg)] no-underline hover:underline"
                    >
                      {r.companies.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}
