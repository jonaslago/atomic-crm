import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Users } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { fetchCustomerList, type CustomerListRow } from "./dataAccess";
import {
  comparePriority,
  computeVisitPriority,
  type VisitPriority,
  type VisitStatus,
} from "./priority";
import { SEGMENT_INTERVAL_DAYS, type Segment } from "./segmentIntervals";

interface EnrichedRow extends CustomerListRow {
  priority: VisitPriority;
}

const SEGMENTS: Segment[] = ["A", "B", "C"];

function statusDotClass(status: VisitStatus): string {
  switch (status) {
    case "never_visited":
    case "overdue":
      return "bg-red-500";
    case "soon":
      return "bg-amber-500";
    case "on_plan":
    default:
      return "bg-emerald-500";
  }
}

function statusBadgeClass(status: VisitStatus): string {
  switch (status) {
    case "never_visited":
    case "overdue":
      return "border-red-300 bg-red-50 text-red-700";
    case "soon":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "on_plan":
    default:
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
}

function StatusLine({
  priority,
  translate,
}: {
  priority: VisitPriority;
  translate: ReturnType<typeof useTranslate>;
}) {
  if (priority.status === "never_visited") {
    return (
      <span>
        {translate("lago.customer_list.never_visited")} ·{" "}
        {translate("lago.customer_list.interval_n_days", {
          n: priority.intervalDays,
        })}
      </span>
    );
  }
  const days = priority.daysSinceVisit ?? 0;
  return (
    <span>
      {translate("lago.customer_list.last_visit_n_days_ago", { n: days })} ·{" "}
      {translate("lago.customer_list.interval_n_days", {
        n: priority.intervalDays,
      })}
    </span>
  );
}

function StatusBadge({
  priority,
  translate,
}: {
  priority: VisitPriority;
  translate: ReturnType<typeof useTranslate>;
}) {
  let label: string;
  if (priority.status === "never_visited") {
    label = translate("lago.customer_list.status.never_visited");
  } else if (priority.status === "overdue") {
    label = translate("lago.customer_list.status.overdue_by_n", {
      n: priority.daysOverdue ?? 0,
    });
  } else if (priority.status === "soon") {
    label = translate("lago.customer_list.status.soon");
  } else {
    label = translate("lago.customer_list.status.on_plan");
  }
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", statusBadgeClass(priority.status))}
    >
      <span
        className={cn(
          "mr-1.5 inline-block h-2 w-2 rounded-full",
          statusDotClass(priority.status),
        )}
      />
      {label}
    </Badge>
  );
}

function CustomerRow({ row }: { row: EnrichedRow }) {
  const translate = useTranslate();
  const { name, city, extension, priority } = row;
  return (
    <Link
      to={`/companies/${row.id}/show`}
      className="block focus-visible:outline-none"
    >
      <Card className="hover:bg-muted/40 active:bg-muted/60 transition-colors">
        <CardContent className="flex items-start gap-3 py-3">
          <div
            className={cn(
              "mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full",
              statusDotClass(priority.status),
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate text-base font-semibold">{name}</h3>
              {extension?.segment && (
                <Badge
                  variant="secondary"
                  className="flex-shrink-0 font-normal"
                >
                  {translate("lago.customer.segment")} {extension.segment}
                </Badge>
              )}
            </div>
            {city && (
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <MapPin className="h-3 w-3" /> {city}
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              <StatusLine priority={priority} translate={translate} />
            </p>
            <div className="mt-2">
              <StatusBadge priority={priority} translate={translate} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Mobile-first prioritised customer list (Domain-brief 2). Reads companies
 * + companies_lago, computes a visit-priority per customer from segment +
 * last_visit_at + the segment-interval defaults, and sorts the most
 * urgent rows to the top. Filters are client-side; the dataset for LAGO
 * is small enough that this stays snappy on iPad.
 */
export function LagoCustomerList() {
  const translate = useTranslate();
  const { data: identity } = useGetIdentity();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;

  const [activeSegments, setActiveSegments] = useState<Set<Segment>>(new Set());
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  const query = useQuery({
    queryKey: ["lago-customer-list", { onlyMine, mySalesId }],
    queryFn: () =>
      fetchCustomerList({
        mySalesId,
        onlyMine,
      }),
  });

  const rows = useMemo<EnrichedRow[]>(() => {
    if (!query.data) return [];
    const enriched = query.data.map((c) => ({
      ...c,
      priority: computeVisitPriority(
        c.extension?.last_visit_at,
        c.extension?.segment,
      ),
    }));
    const filtered = enriched.filter((r) => {
      if (activeSegments.size > 0) {
        if (!r.extension?.segment) return false;
        if (!activeSegments.has(r.extension.segment as Segment)) return false;
      }
      if (onlyOverdue) {
        if (
          r.priority.status !== "overdue" &&
          r.priority.status !== "never_visited"
        ) {
          return false;
        }
      }
      return true;
    });
    return filtered.sort((a, b) => comparePriority(a.priority, b.priority));
  }, [query.data, activeSegments, onlyOverdue]);

  const toggleSegment = (s: Segment) => {
    setActiveSegments((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const counts = useMemo(() => {
    const c = {
      overdue: 0,
      soon: 0,
      on_plan: 0,
      never_visited: 0,
    };
    for (const r of rows) c[r.priority.status]++;
    return c;
  }, [rows]);

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <header className="mb-3 flex items-center gap-2">
        <Users className="text-muted-foreground h-5 w-5" />
        <h1 className="text-lg font-semibold">
          {translate("lago.customer_list.title")}
        </h1>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SEGMENTS.map((s) => {
          const active = activeSegments.has(s);
          return (
            <Button
              key={s}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => toggleSegment(s)}
              className="h-8"
            >
              {translate("lago.customer.segment")} {s}
              <span className="text-muted-foreground ml-1.5 text-[10px]">
                {SEGMENT_INTERVAL_DAYS[s]}d
              </span>
            </Button>
          );
        })}
        <Button
          size="sm"
          variant={onlyOverdue ? "default" : "outline"}
          onClick={() => setOnlyOverdue((v) => !v)}
          className="h-8"
        >
          {translate("lago.customer_list.filter_overdue")}
        </Button>
        <Button
          size="sm"
          variant={onlyMine ? "default" : "outline"}
          onClick={() => setOnlyMine((v) => !v)}
          className="h-8"
          disabled={mySalesId == null}
        >
          {translate("lago.customer_list.filter_mine")}
        </Button>
      </div>

      <p className="text-muted-foreground mb-3 text-xs">
        {translate("lago.customer_list.summary", {
          total: rows.length,
          overdue: counts.overdue + counts.never_visited,
          soon: counts.soon,
        })}
      </p>

      {query.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {translate("lago.customer_list.loading")}
        </div>
      ) : query.error ? (
        <p className="text-destructive py-4 text-sm">
          {translate("lago.customer_list.load_failed")}{" "}
          {(query.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-6 text-sm">
          {translate("lago.customer_list.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <CustomerRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
