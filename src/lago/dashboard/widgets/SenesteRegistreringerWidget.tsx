import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { ExpandableNote } from "@/lago/ui/ExpandableNote";
import { shortenSalesName } from "@/lago/ui/shortenSalesName";

import { WidgetShell } from "../WidgetShell";

/**
 * Seneste registreringer (Domain-brief 18 §4.4).
 *
 * De sidste 10 besøgs-/aktivitets-registreringer på tværs af
 * distrikter, så kontoret ved hvad der foregår.
 *
 * Vi filtrerer på source = 'crm_native' så VISMA-importerede
 * historiske aktiviteter ikke drukner listen. Sorteret på
 * §24 follow-up: shows only done=true activities (plans excluded).
 * Date = activity_date (the day the user chose), not created_at.
 */

interface RegistreringRow {
  id: number;
  company_id: number;
  activity_date: string;
  activity_type: string | null;
  description: string | null;
  sales_name: string | null;
  created_at: string;
  companies: { id: number; name: string; city: string | null } | null;
}

const CLIP_TO = 5;

async function fetchSenesteRegistreringer(): Promise<RegistreringRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("customer_activities_lago")
    .select(
      "id, company_id, activity_date, activity_type, description, sales_name, created_at, companies:company_id(id, name, city)",
    )
    .eq("source", "crm_native")
    // §24 follow-up: only completed activities. A plan is not a registration.
    .eq("done", true)
    .is("deleted_at", null)
    // Sort by activity_date, not created_at — the date the user chose,
    // not the timestamp of the database INSERT.
    .order("activity_date", { ascending: false })
    .limit(CLIP_TO);
  if (error) throw error;
  return (data as unknown as RegistreringRow[]) ?? [];
}

// §98-4b / §24: activity_date is a date, not a timestamp. No clock time.
const dateFmt = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function SenesteRegistreringerWidget() {
  const query = useQuery({
    queryKey: ["lago-seneste-registreringer"],
    queryFn: fetchSenesteRegistreringer,
    staleTime: 30_000,
  });

  const rows = query.data ?? [];

  return (
    <WidgetShell
      title="Seneste registreringer fra feltet"
      subtitle="Opdateres løbende, efterhånden som sælgerne indberetter"
      isLoading={query.isPending}
      error={query.error as Error | null}
      isEmpty={rows.length === 0}
      emptyState="Ingen registreringer fra sælgerne endnu."
    >
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const c = r.companies;
          const line = (
            <div className="rounded-lg bg-[var(--surface-1)] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1 truncate text-base text-[var(--fg)]">
                  <span className="font-bold">
                    {c?.name ?? "(kunde slettet)"}
                  </span>
                  {r.activity_type && (
                    <Badge
                      variant="outline"
                      className="border-[var(--line-strong)] ml-2 text-[12px] font-normal text-[var(--fg-2)]"
                    >
                      {r.activity_type}
                    </Badge>
                  )}
                </div>
                <div className="tabular-nums text-[13px] font-medium text-[var(--fg-3)]">
                  {dateFmt.format(new Date(r.activity_date + "T12:00:00"))}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--fg-2)]">
                {r.sales_name && (
                  <span title={r.sales_name}>
                    {shortenSalesName(r.sales_name)}
                  </span>
                )}
                {c?.city && <span>· {c.city}</span>}
              </div>
              {r.description && (
                // Brief 43 (16. sep 2026) · rev. brief 90 (29. sep 2026):
                // 3-linjers foldbar med "Vis mere" på klik. Indsatte
                // mails (Peter's Dialog om plakater) fyldte hele feeden
                // med signaturer under den gamle 2-linjes klip; klippet
                // gjaldt UDEN knap, så teksten var altid uendelig.
                // Onclick-håndtering stopper propagation så feed-linkets
                // navigation ikke fyrer når man folder ud.
                <div
                  className="mt-1 text-[13px] italic text-[var(--fg-2)]"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <ExpandableNote text={r.description} clampLines={3} />
                </div>
              )}
            </div>
          );
          return (
            <li key={r.id}>
              {c ? (
                <Link
                  to={`/companies/${c.id}/show`}
                  className="block no-underline"
                >
                  {line}
                </Link>
              ) : (
                line
              )}
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}
