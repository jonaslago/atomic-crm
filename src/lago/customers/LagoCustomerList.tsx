import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Search } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { fetchCustomerList, type CustomerListRow } from "./dataAccess";
import {
  comparePriority,
  computeVisitPriority,
  type VisitPriority,
  type VisitStatus,
} from "./priority";
import { SEGMENT_INTERVAL_DAYS, type Segment } from "./segmentIntervals";

type SortMode = "name" | "priority";

const SEGMENTS: Segment[] = ["A", "B", "C"];

interface EnrichedRow extends CustomerListRow {
  priority: VisitPriority;
}

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

function PriorityBadge({
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
      {label}
    </Badge>
  );
}

function lastVisitFragment(
  priority: VisitPriority,
  translate: ReturnType<typeof useTranslate>,
): string {
  if (priority.status === "never_visited") {
    return translate("lago.customer_list.never_visited");
  }
  return translate("lago.customer_list.last_visit_n_days_ago", {
    n: priority.daysSinceVisit ?? 0,
  });
}

function CustomerRow({
  row,
  emphasisePriority,
}: {
  row: EnrichedRow;
  emphasisePriority: boolean;
}) {
  const translate = useTranslate();
  const { name, city, extension, priority } = row;
  return (
    <Link
      to={`/companies/${row.id}/show`}
      className="block focus-visible:outline-none"
    >
      <Card className="hover:bg-muted/40 active:bg-muted/60 transition-colors">
        <CardContent className="flex items-center gap-3 py-3">
          <div
            className={cn(
              "h-2 w-2 flex-shrink-0 rounded-full",
              statusDotClass(priority.status),
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h3 className="truncate text-base font-semibold">{name}</h3>
              {extension?.segment && (
                <Badge
                  variant="secondary"
                  className="flex-shrink-0 font-normal"
                >
                  {extension.segment}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {city}
                </span>
              )}
              {city && <span aria-hidden>·</span>}
              <span>{lastVisitFragment(priority, translate)}</span>
            </p>
          </div>
          {emphasisePriority && priority.status !== "on_plan" && (
            <div className="flex-shrink-0">
              <PriorityBadge priority={priority} translate={translate} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Browsable LAGO customer list (Domain-brief 2, post-revision).
 * Default behaviour: alphabetical search + browse, enriched per row with
 * segment, last-visit fragment, and a small visit-status dot. Filters and
 * "trænger til besøg"-sort are available but not the frame.
 */
export function LagoCustomerList() {
  const translate = useTranslate();
  const { data: identity } = useGetIdentity();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [activeSegments, setActiveSegments] = useState<Set<Segment>>(new Set());
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  const query = useQuery({
    queryKey: ["lago-customer-list", { onlyMine, mySalesId }],
    queryFn: () => fetchCustomerList({ mySalesId, onlyMine }),
  });

  const rows = useMemo<EnrichedRow[]>(() => {
    if (!query.data) return [];
    const needle = deferredSearch.trim().toLowerCase();
    const enriched: EnrichedRow[] = query.data.map((c) => ({
      ...c,
      priority: computeVisitPriority(
        c.extension?.last_visit_at,
        c.extension?.segment,
      ),
    }));
    const filtered = enriched.filter((r) => {
      if (needle && !r.name.toLowerCase().includes(needle)) return false;
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
    if (sortMode === "priority") {
      return filtered.sort((a, b) => comparePriority(a.priority, b.priority));
    }
    return filtered.sort((a, b) =>
      a.name.localeCompare(b.name, "da", { sensitivity: "base" }),
    );
  }, [query.data, deferredSearch, activeSegments, onlyOverdue, sortMode]);

  const counts = useMemo(() => {
    const c = { overdue: 0, soon: 0, on_plan: 0, never_visited: 0 };
    for (const r of rows) c[r.priority.status]++;
    return c;
  }, [rows]);

  const toggleSegment = (s: Segment) => {
    setActiveSegments((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const emphasisePriority = sortMode === "priority" || onlyOverdue;

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <header className="mb-3">
        <h1 className="text-lg font-semibold">
          {translate("lago.customer_list.title")}
        </h1>
      </header>

      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={translate("lago.customer_list.search_placeholder")}
            className="pl-9"
          />
        </div>
        <Select
          value={sortMode}
          onValueChange={(v) => setSortMode(v as SortMode)}
        >
          <SelectTrigger className="sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">
              {translate("lago.customer_list.sort.name")}
            </SelectItem>
            <SelectItem value="priority">
              {translate("lago.customer_list.sort.priority")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {SEGMENTS.map((s) => {
          const active = activeSegments.has(s);
          return (
            <Button
              key={s}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => toggleSegment(s)}
              className="h-7 px-2"
              title={`Interval: hver ${SEGMENT_INTERVAL_DAYS[s]}. dag`}
            >
              {s}
            </Button>
          );
        })}
        <span className="bg-border mx-1 h-4 w-px" aria-hidden />
        <Button
          size="sm"
          variant={onlyOverdue ? "default" : "outline"}
          onClick={() => setOnlyOverdue((v) => !v)}
          className="h-7 px-2"
        >
          {translate("lago.customer_list.filter_overdue")}
        </Button>
        <Button
          size="sm"
          variant={onlyMine ? "default" : "outline"}
          onClick={() => setOnlyMine((v) => !v)}
          className="h-7 px-2"
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
              <CustomerRow row={row} emphasisePriority={emphasisePriority} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
