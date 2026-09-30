import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";

import { Icon } from "@/lago/ui/Icon";
import { IconButton } from "@/lago/ui/IconButton";
import { humanOverdue } from "@/lago/ui/humanDuration";
import { Panel } from "@/lago/ui/Panel";
import { RowGroup } from "@/lago/ui/RowGroup";
import { StatusPill } from "@/lago/ui/StatusPill";

import { fetchCustomerList } from "@/lago/customers/dataAccess";
import {
  comparePriorityThenSegmentThenName,
  isSortTieDominated,
  resolveVisitPriority,
  type VisitPriority,
} from "@/lago/customers/priority";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
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
  // Brief 85 §6 (28. sep 2026): badgen siger TILSTANDEN, ikke omfanget.
  // Linjen under (med et tal) siger omfanget. Tidligere returnerede
  // overdue-grenen humanOverdue(days), som betød at både badge og linje
  // viste samme tal — rødt to gange på hver række.
  if (p.status === "never_visited") {
    return translate("lago.customer_list.status.never_visited");
  }
  if (p.status === "overdue") {
    return "Overskredet";
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
  const mySalesId = useViewSalesId();

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
            phone_number: r.phone_number ?? null,
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
  const alfaHint = isSortTieDominated(clipped);

  const countLabel =
    totalCount > 0
      ? `${totalCount} kunder overskredet`
      : "Ingen overskridelser";
  return (
    <WidgetShell
      title="Kunder der skal besøges"
      subtitle="Aldrig besøgt før overskredne"
      seeAllHref="/companies?filter=%7B%22priority_status%22%3A%22overdue%22%7D"
      isLoading={query.isPending && mySalesId != null}
      error={query.error as Error | null}
      isEmpty={rowsAll.length === 0}
      noPanel
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
            _: "Toppen deler status — inden for gruppen sorteres på segment (A først), derefter navn.",
          })}
        </p>
      )}
      {/* Brief 85 §2 (28. sep 2026): ét Panel med RowGroup indeni —
          én flade med hårfine skillelinjer, ikke en stak paneler.
          Rækkerne har ikke længere egen baggrund. */}
      <Panel>
        <RowGroup>
          {clipped.map((r) => (
            <li key={r.id}>
              <OverdueRow row={r} translate={translate} />
            </li>
          ))}
        </RowGroup>
      </Panel>
      {/* Brief 85 §4 (28. sep 2026): "Se alle overskredne →" fjernet
          fra listens bund — den står allerede i sektionshovedet
          (WidgetShell.seeAllHref). Ét sted, ikke to. */}
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
  const navigate = useNavigate();
  const label = priorityLabel(row.priority, translate);
  return (
    // Brief 85 tillæg #3 (28. sep 2026): ét-linje-layout fra 768 px.
    // Før stod navn+meta i venstre tredjedel, badgen yderst, og
    // knapperne under teksten — rækken blev dobbelt så høj som den
    // behøvede, og midten var tom. Nu: indhold venstre, badge +
    // knapper højre, alt på én linje ≥768 px. Under 768 px stables
    // som før (én kolonne). Tal-linjen (overdue) sluttes til meta så
    // ingen information tabes.
    <article className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
      <div className="min-w-0 md:flex-1">
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
          {row.priority.status === "overdue" &&
            row.priority.daysOverdue != null && (
              <span className="ml-2 inline-flex items-center gap-1 text-[var(--st-red-fg)] font-medium">
                <Icon icon={AlertTriangle} size="sm" />
                {humanOverdue(row.priority.daysOverdue)}
              </span>
            )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:shrink-0">
        <StatusPill variant="red">{label}</StatusPill>
        {/* Brief 85 §3 (28. sep 2026): Planlæg (primær, 48px trykmål,
            uden flex-1 — knappen fylder kun sin egen bredde). Ring
            (sekundær, kun når telefonnummer findes, 44px). Udskyd i ⋯.
            Man kan ikke registrere et besøg, man ikke har været på —
            derfor er Planlæg primær her. */}
        <Button
          onClick={() => setPlanOpen(true)}
          className="min-h-12 gap-1.5 bg-[var(--ink)] font-medium text-white hover:bg-[var(--ink)]/90"
        >
          Planlæg
        </Button>
        {row.phone_number && (
          <Button
            asChild
            variant="ghost"
            className="min-h-11 shrink-0 bg-[var(--surface-3)] font-medium text-[var(--fg)] hover:bg-[var(--surface-3)]/80"
          >
            <a href={`tel:${row.phone_number}`}>Ring</a>
          </Button>
        )}
        {/* Brief 87 tillæg audit-svar #1 (28. sep 2026): samme regel som
            MineOpgaverWidget — på ≥1024 px vises menu-punkterne som
            ikonknapper i stedet for at være gemt bag "…". CheckCircle2
            er samme symbol som Registrér-knappen bruger andre steder,
            ChevronRight er produktkonventionen for "åbn denne kunde"
            (kundelistens mobilkort ender med præcis det ikon).
            Under 1024 px beholdes menuen — iPhone og iPad har ikke
            plads til to knapper i træk. "Alligevel" er droppet fra
            teksten — det er bare "Registrér besøg". */}
        <div className="hidden lg:flex items-center gap-2">
          <IconButton
            icon={CheckCircle2}
            aria-label="Registrér besøg"
            title="Registrér besøg"
            onClick={() => setRegOpen(true)}
          />
          <IconButton
            icon={ChevronRight}
            aria-label="Åbn kunde"
            title="Åbn kunde"
            onClick={() => navigate(`/companies/${row.id}/show`)}
          />
        </div>
        <div className="lg:hidden">
          <RowActionsMenu
            // Brief 36: Udskyd skjult indtil FS-20-dialogen er koblet.
            actions={[
              {
                label: "Registrér besøg",
                onSelect: () => setRegOpen(true),
              },
              {
                label: "Åbn kunde",
                onSelect: () => navigate(`/companies/${row.id}/show`),
              },
            ]}
          />
        </div>
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
