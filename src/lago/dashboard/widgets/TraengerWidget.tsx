import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useGetIdentity, useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";

import { Icon } from "@/lago/ui/Icon";
import { humanOverdue } from "@/lago/ui/humanDuration";
import { StatusPill } from "@/lago/ui/StatusPill";

import { fetchCustomerList } from "@/lago/customers/dataAccess";
import {
  comparePriorityThenSegmentThenName,
  isSortTieDominated,
  resolveVisitPriority,
  type VisitPriority,
} from "@/lago/customers/priority";
import { PlanVisitDialog } from "@/lago/registrer/PlanVisitDialog";
import { RegistrerModal } from "@/lago/registrer/RegistrerModal";

import { RowActionsMenu } from "../RowActionsMenu";
import { WidgetShell } from "../WidgetShell";

/**
 * Hvem er jeg bagud med (Domain-brief 34 §1 + tillæg A §0/§2/§6).
 *
 * Panel-anatomi. Primær = Planlæg (kan ikke registrere et besøg man
 * ikke har været på). Sekundær = Ring. Bag ⋯: Registrér, Udskyd,
 * Åbn kunde.
 *
 * Klippet til 5 øverste, "Se alle N" nederst når der er flere.
 * Tællingen i header får --st-red-fg når der er overskridelser.
 */

const CLIP_TO = 5;

function priorityLabel(
  p: VisitPriority,
  translate: ReturnType<typeof useTranslate>,
): string {
  if (p.status === "never_visited") {
    return translate("lago.customer_list.status.never_visited");
  }
  if (p.status === "overdue") {
    // Brief 43: humaniser lang varighed.
    return humanOverdue(p.daysOverdue);
  }
  if (p.status === "soon") {
    return translate("lago.customer_list.status.soon");
  }
  return translate("lago.customer_list.status.on_plan");
}

interface RowData {
  id: number;
  name: string;
  city: string | null;
  phone_number: string | null;
  segment: string | null;
  visitInterval: number | null;
  priority: VisitPriority;
}

export function TraengerWidget() {
  const translate = useTranslate();
  const { data: identity } = useGetIdentity();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;

  const query = useQuery({
    queryKey: ["lago-traenger-widget", mySalesId],
    queryFn: () => fetchCustomerList({ mySalesId, onlyMine: true }),
    enabled: mySalesId != null,
    staleTime: 60_000,
  });

  const rowsAll: RowData[] = useMemo(() => {
    if (!query.data) return [];
    return (
      query.data
        .map((r) => {
          const priority = resolveVisitPriority(r.visit_priority);
          const seg = r.extension?.segment ?? null;
          // Brief 65 tillæg A §1: interval kommer fra view'et (kan være
          // override eller segment-standard). Ingen segment→interval-
          // udledning i frontend. NULL for X/L uden override.
          const interval =
            seg === "A" || seg === "B" || seg === "C"
              ? priority.intervalDays
              : null;
          return {
            id: r.id,
            name: r.name,
            city: r.city ?? null,
            phone_number: null,
            segment: seg,
            visitInterval: interval,
            priority,
          };
        })
        .filter(
          (r) =>
            r.priority.status === "never_visited" ||
            r.priority.status === "overdue",
        )
        // Brief 36 §1: primær priority → sekundær segment (A→B→C→X→L)
        // → tertiær navn. Uden segment-tiebreak'et returnerer comparator
        // 0 for hele feltet af never_visited, og listen bliver alfabetisk
        // — samme fælde Dagens allerede havde rettet.
        .sort(comparePriorityThenSegmentThenName)
    );
  }, [query.data]);

  const totalCount = rowsAll.length;
  const clipped = rowsAll.slice(0, CLIP_TO);
  const hasMore = totalCount > clipped.length;
  const alfaHint = isSortTieDominated(clipped);

  const countLabel =
    totalCount > 0
      ? `${totalCount} kunder overskredet`
      : "Ingen overskridelser";
  return (
    <WidgetShell
      title="Hvem er jeg bagud med"
      subtitle="Kunder over det aftalte besøgsinterval"
      seeAllHref="/companies?filter=%7B%22priority_status%22%3A%22overdue%22%7D"
      isLoading={query.isPending && mySalesId != null}
      error={query.error as Error | null}
      isEmpty={rowsAll.length === 0}
      count={{
        label: countLabel,
        tone: totalCount > 0 ? "red" : "neutral",
      }}
      emptyState={
        mySalesId == null
          ? "Log ind for at se dine kunder."
          : "Ingen kunder trænger til besøg lige nu."
      }
    >
      {alfaHint && (
        <p className="mb-3 text-[13px] text-[var(--fg-3)]">
          {translate("lago.felt.dagens.sort_tie_hint", {
            _: "Toppen er sorteret på segment og navn — der er endnu ikke registreret nok besøg til at skelne dem.",
          })}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {clipped.map((r) => (
          <li key={r.id}>
            <OverdueRow row={r} translate={translate} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="mt-3 text-right">
          {/* Brief 74 §1 (22. sep 2026): tal fjernet fra label. */}
          <Link
            to="/companies?filter=%7B%22priority_status%22%3A%22overdue%22%7D"
            className="text-[13px] font-medium text-[var(--fg-2)] no-underline hover:underline"
          >
            Se alle overskredne →
          </Link>
        </div>
      )}
    </WidgetShell>
  );
}

function OverdueRow({
  row,
  translate,
}: {
  row: RowData;
  translate: ReturnType<typeof useTranslate>;
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const label = priorityLabel(row.priority, translate);
  return (
    <article className="flex flex-col gap-3 rounded-lg bg-[var(--surface-1)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/companies/${row.id}/show`}
            className="block truncate text-base font-bold text-[var(--fg)] no-underline hover:underline"
          >
            {row.name}
          </Link>
          <div className="text-sm text-[var(--fg-2)]">
            {row.city ?? "—"}
            {row.segment && ` · Segment ${row.segment}`}
            {row.visitInterval && ` · hver ${row.visitInterval}. dag`}
          </div>
        </div>
        <StatusPill variant="red">{label}</StatusPill>
      </div>
      {(row.priority.daysOverdue != null ||
        row.priority.status === "never_visited") && (
        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--st-red-fg)]">
          <Icon icon={AlertTriangle} size="sm" />
          {row.priority.status === "never_visited"
            ? "Aldrig besøgt"
            : humanOverdue(row.priority.daysOverdue)}
        </div>
      )}
      <div className="flex items-center gap-2">
        {/* Primær: Planlæg. Man kan ikke registrere et besøg, man ikke
            har været på — så Planlæg får den plads der er tilovers. */}
        <Button
          onClick={() => setPlanOpen(true)}
          className="min-h-11 flex-1 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
        >
          Planlæg
        </Button>
        <RowActionsMenu
          // Brief 36: Udskyd skjult indtil FS-20-dialogen er koblet.
          // En placeholder-alert er værre end ingen knap i felten.
          actions={[
            {
              label: "Registrér besøg alligevel",
              onSelect: () => setRegOpen(true),
            },
            {
              label: "Åbn kunde",
              onSelect: () => {
                window.location.hash = `/companies/${row.id}/show`;
              },
            },
          ]}
        />
      </div>
      <PlanVisitDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        companyId={row.id}
        companyName={row.name}
        segment={row.segment as "A" | "B" | "C" | "X" | "L" | null}
      />
      <RegistrerModal
        open={regOpen}
        onOpenChange={setRegOpen}
        companyId={row.id}
        companyName={row.name}
      />
    </article>
  );
}
