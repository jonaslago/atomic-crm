import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, Loader2, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslate } from "ra-core";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import { Icon } from "@/lago/ui/Icon";

interface TodaysVisitRow {
  company_id: number;
  next_visit_planned: string;
  companies?: { id: number; name: string; city?: string | null } | null;
}

async function fetchTodaysVisits(): Promise<TodaysVisitRow[]> {
  const supabase = getSupabaseClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data, error } = await supabase
    .from("companies_lago")
    .select(
      "company_id, next_visit_planned, companies!inner(id, name, city)",
    )
    .gte("next_visit_planned", start.toISOString())
    .lt("next_visit_planned", end.toISOString())
    // Brief 26 §2 (rev. 16. sep 2026): distrikt-synlig OG aktiv.
    .eq("is_visible_to_sales", true)
    .eq("is_active", true)
    .order("next_visit_planned", { ascending: true });
  if (error) throw error;
  return (data as unknown as TodaysVisitRow[]) ?? [];
}

/**
 * Dashboard zone: planned visits for the current day (from
 * companies_lago.next_visit_planned). Empty state when nothing planned —
 * we do not fabricate suggestions here.
 */
export function TodaysVisits() {
  const translate = useTranslate();
  const query = useQuery({
    queryKey: ["lago-todays-visits"],
    queryFn: fetchTodaysVisits,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon icon={CalendarClock} className="text-muted-foreground" />
          {translate("lago.dashboard.todays_visits")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
            <Icon icon={Loader2} className="animate-spin" /> …
          </div>
        ) : !query.data || query.data.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            {translate("lago.dashboard.empty_visits")}
          </p>
        ) : (
          <ul className="space-y-2">
            {query.data.map((r) => {
              const company = r.companies;
              if (!company) return null;
              return (
                <li key={r.company_id}>
                  <Link
                    to={`/companies/${company.id}/show`}
                    className="hover:bg-muted/40 flex items-center gap-3 rounded-md p-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {company.name}
                      </div>
                      {company.city && (
                        <div className="text-muted-foreground flex items-center gap-1 text-sm">
                          <Icon icon={MapPin} size="sm" /> {company.city}
                        </div>
                      )}
                    </div>
                    <Icon icon={ChevronRight} className="text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
