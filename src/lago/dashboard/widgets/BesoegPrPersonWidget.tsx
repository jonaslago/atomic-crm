import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { thisIsoWeek, toIsoDate } from "@/lago/ui/periodRange";

import { WidgetShell } from "../WidgetShell";

/**
 * §97-1 (1. okt 2026): Besog pr. person — replaces "Saelgernes uge".
 *
 * Four columns: afholdt i dag, afholdt denne uge, planlagt denne uge,
 * planlagt senere. ONLY visits (activity_type_code = 1). Rows: all
 * people with customers. Sorted by afholdt denne uge, highest first.
 */

interface PersonRow {
  salesId: number;
  name: string;
  visitedToday: number;
  visitedThisWeek: number;
  plannedThisWeek: number;
  plannedLater: number;
}

async function fetchBesoegPrPerson(): Promise<PersonRow[]> {
  const supabase = getSupabaseClient();
  const today = toIsoDate(new Date());
  const { fromIso: weekStart, toIso: weekEnd } = thisIsoWeek();

  // Sellers with at least one customer
  const sellersRes = await supabase
    .from("sales")
    .select("id, first_name, last_name, companies!inner(id)")
    .not("companies", "is", null);
  if (sellersRes.error) throw sellersRes.error;

  const seen = new Set<number>();
  const sellers: Array<{ id: number; name: string }> = [];
  for (const row of (sellersRes.data ?? []) as Array<{
    id: number;
    first_name: string | null;
    last_name: string | null;
  }>) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const name =
      `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || `#${row.id}`;
    sellers.push({ id: row.id, name });
  }
  if (sellers.length === 0) return [];

  const salesIds = sellers.map((s) => s.id);

  // All visit activities (type_code=1) from this week onwards
  const activitiesRes = await supabase
    .from("customer_activities_lago")
    .select("sales_id, activity_type_code, activity_date, done")
    .in("sales_id", salesIds)
    .is("deleted_at", null)
    .eq("activity_type_code", 1)
    .gte("activity_date", weekStart);
  if (activitiesRes.error) throw activitiesRes.error;

  const map = new Map<number, PersonRow>();
  for (const s of sellers) {
    map.set(s.id, {
      salesId: s.id,
      name: s.name,
      visitedToday: 0,
      visitedThisWeek: 0,
      plannedThisWeek: 0,
      plannedLater: 0,
    });
  }

  for (const a of (activitiesRes.data ?? []) as Array<{
    sales_id: number;
    activity_type_code: number | null;
    activity_date: string;
    done: boolean;
  }>) {
    const row = map.get(a.sales_id);
    if (!row) continue;
    const dateStr = a.activity_date.slice(0, 10);
    const inWeek = dateStr >= weekStart && dateStr <= weekEnd;

    if (a.done && dateStr <= today) {
      // Completed visit on or before today
      if (dateStr === today) row.visitedToday++;
      if (inWeek) row.visitedThisWeek++;
    } else if (!a.done) {
      // Not done = planned
      if (inWeek && dateStr >= today) row.plannedThisWeek++;
      else if (dateStr > weekEnd) row.plannedLater++;
    }
  }

  // Sort by visited this week, highest first
  return Array.from(map.values()).sort(
    (a, b) => b.visitedThisWeek - a.visitedThisWeek,
  );
}

export function BesoegPrPersonWidget() {
  const query = useQuery({
    queryKey: ["lago-besoeg-pr-person"],
    queryFn: fetchBesoegPrPerson,
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  const allZero =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.visitedToday === 0 &&
        r.visitedThisWeek === 0 &&
        r.plannedThisWeek === 0 &&
        r.plannedLater === 0,
    );

  return (
    <WidgetShell
      title="Besøg pr. person"
      subtitle="Kun besøg — sorteret efter afholdt denne uge"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      emptyState="Ingen med kunder endnu."
    >
      {allZero && (
        <p className="mb-3 text-sm text-[var(--fg-2)]">
          Ingen besøg registreret eller planlagt denne uge.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[13px] font-medium text-[var(--fg-2)]">
              <th className="pb-2 pr-3 font-medium">Person</th>
              <th className="pb-2 pr-3 text-right font-medium">I dag</th>
              <th className="pb-2 pr-3 text-right font-medium">Denne uge</th>
              <th className="pb-2 pr-3 text-right font-medium">
                Planlagt denne uge
              </th>
              <th className="pb-2 text-right font-medium">Planlagt senere</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.salesId} className="border-t border-[var(--line)]">
                <td className="py-2 pr-3 text-[var(--fg)]">{r.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.visitedToday}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.visitedThisWeek}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--fg)]">
                  {r.plannedThisWeek}
                </td>
                <td className="py-2 text-right tabular-nums text-[var(--fg)]">
                  {r.plannedLater}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}
