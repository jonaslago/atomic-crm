import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "ra-core";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { Icon } from "@/lago/ui/Icon";
import { humanOverdue } from "@/lago/ui/humanDuration";
import { StatusPill, type StatusVariant } from "@/lago/ui/StatusPill";

import { fetchCustomerList } from "../customers/dataAccess";
import {
  comparePriorityThenSegmentThenName,
  resolveVisitPriority,
  type VisitPriority,
} from "../customers/priority";

const TOP_N = 5;

function priorityLabel(
  p: VisitPriority,
  translate: ReturnType<typeof useTranslate>,
): string {
  if (p.status === "never_visited") {
    return translate("lago.customer_list.status.never_visited");
  }
  if (p.status === "overdue") {
    // Brief 43: humaniser lang varighed. Se humanDuration.ts.
    return humanOverdue(p.daysOverdue);
  }
  if (p.status === "soon") {
    return translate("lago.customer_list.status.soon");
  }
  return translate("lago.customer_list.status.on_plan");
}

function priorityVariant(p: VisitPriority): StatusVariant {
  switch (p.status) {
    case "overdue":
    case "never_visited":
      return "red";
    case "soon":
      return "amber";
    case "on_plan":
      return "green";
    default:
      return "grey";
  }
}

/**
 * Dashboard zone: top 5 customers that need a visit — computed the same
 * way as the LagoCustomerList priority sort so the two surfaces agree.
 * Only "mine kunder" are shown when the caller has a sales identity.
 */
export function NeedsVisitTop5() {
  const translate = useTranslate();
  const mySalesId = useViewSalesId();
  const query = useQuery({
    queryKey: ["lago-customer-list", { onlyMine: true, mySalesId }],
    queryFn: () => fetchCustomerList({ mySalesId, onlyMine: true }),
    enabled: mySalesId != null,
  });

  const rows = useMemo(() => {
    if (!query.data) return [];
    return query.data
      .map((r) => ({
        ...r,
        segment: r.extension?.segment ?? null,
        priority: resolveVisitPriority(r.visit_priority),
      }))
      .filter(
        (r) =>
          r.priority.status === "never_visited" ||
          r.priority.status === "overdue" ||
          r.priority.status === "soon",
      )
      // Brief 36 §1: samme tiebreak som DagensPage — segment→navn.
      .sort(comparePriorityThenSegmentThenName)
      .slice(0, TOP_N);
  }, [query.data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <Icon icon={AlertCircle} className="text-muted-foreground" />
          {translate("lago.dashboard.needs_visit")}
        </CardTitle>
        <Link
          to="/companies"
          className="text-muted-foreground text-sm underline-offset-2 hover:underline"
        >
          {translate("lago.dashboard.view_all")}
        </Link>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
            <Icon icon={Loader2} className="animate-spin" /> …
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            {translate("lago.dashboard.empty_needs_visit")}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/companies/${r.id}/show`}
                  className="hover:bg-muted/40 flex items-center gap-3 rounded-md p-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    {r.city && (
                      <div className="text-muted-foreground text-sm">
                        {r.city}
                      </div>
                    )}
                  </div>
                  <StatusPill variant={priorityVariant(r.priority)}>
                    {priorityLabel(r.priority, translate)}
                  </StatusPill>
                  <Icon icon={ChevronRight} className="text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
