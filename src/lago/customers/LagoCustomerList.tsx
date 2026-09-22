import { useDeferredValue, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { shortenSalesName } from "@/lago/ui/shortenSalesName";
import { Icon } from "@/lago/ui/Icon";

import { useHasSideRail } from "@/lago/layout/useHasSideRail";

import { useSellerLookup } from "@/lago/settings/useSellerLookup";
import { LagoPullToRefresh } from "@/lago/ui/PullToRefresh";
import { useVisitIntervals } from "@/lago/settings/useVisitIntervals";
import { useBrancher } from "@/lago/settings/useBrancher";
import {
  CheckboxRow,
  FilterGroup,
  RadioRow,
  ToggleRow,
} from "@/lago/ui/FilterPrimitives";

import { humanDaysSince, humanOverdue } from "@/lago/ui/humanDuration";
import { fetchCustomerListWithCount, type CustomerListRow } from "./dataAccess";
import { CustomerPreview } from "./list/CustomerPreview";
import {
  comparePriorityThenSegmentThenName,
  resolveVisitPriority,
  type VisitPriority,
  type VisitStatus,
} from "./priority";
import type { Segment } from "./segmentIntervals";

type SortMode = "name" | "priority" | "last_visit";
// Brief 48 §E (16. sep 2026): fire besøgsstatusser matcher Stitchs
// venstre-skinne (Alle · Overskredet · Trænger snart · Ajour). Overskredet
// dækker både overdue og never_visited — begge rødt i sidebar-tallet.
type VisitStatusFilter = "any" | "overdue" | "soon" | "on_plan";

// Brief 65 tillæg A §1 (18. sep 2026): segment-tooltip siger IKKE
// intervallet. Intervallet er nu en pr-kunde-værdi (kan overstyres),
// og skal ikke afledes af segment noget sted uden for Indstillinger.
const SEGMENT_HINT: Record<Segment, string> = {
  A: "Segment A",
  B: "Segment B",
  C: "Segment C",
  X: "Uklassificeret",
  L: "Lead",
};
// Brief 55 §2 (17. sep 2026): paginering fjernet — alle rækker hentes
// og renderes. Konstanterne (og PaginationBar nedenfor) blev slettet
// samtidig så der ikke er død kode at forfalde.

interface EnrichedRow extends CustomerListRow {
  priority: VisitPriority;
}

function statusDotClass(status: VisitStatus): string {
  // Brief 33 §4: prikker peger på status-tokens, ikke hardkodede
  // Tailwind-nuancer. Så en ændring i tokens.css slår igennem her
  // uden at komponenten røres.
  switch (status) {
    case "overdue":
    case "never_visited":
      return "bg-[var(--st-red)]";
    case "soon":
      return "bg-[var(--st-amber)]";
    case "on_plan":
      return "bg-[var(--st-green)]";
    default:
      // no_urgency (X/L) — dæmpet neutral, ingen kadence.
      return "bg-[var(--fg-3)]/40";
  }
}

// Brief 45 §4 (16. sep 2026): PriorityBadge og lastVisitPhrase-helperne
// er ude af listen — dagtallet står nu alene i sin egen kolonne, farvet
// efter status. Formatering ligger i daysCellText/daysCellClass under
// CustomerRow. statusPillVariant kan komme tilbage hvis vi genindfører
// en dedikeret status-kolonne.

interface CustomerRowProps {
  row: EnrichedRow;
  selected: boolean;
  onSelect: (id: number) => void;
  emphasisePriority: boolean;
}

/**
 * Brief 45 §4 (16. sep 2026): tabelrække 44 px, seks kolonner, én linje
 * på laptop. Kolonnerne matcher Stitchs grid: navn (fleksibel) · by ·
 * segment · distrikt · sælger · dagtal (højrestillet). Under 768 px
 * kollapser kolonne 3-5 væk og rækken bliver to linjer (stadig med
 * skillelinje mellem — ikke kort).
 *
 * Klasserne står som literale strenge på hvert brug fordi Tailwind's
 * JIT ikke ser dynamiske concatenations. Header + row skal derfor
 * begge bære "md:grid-cols-[…]" identisk.
 */

/** Brief 45 §2 + Brief 48 §H (16. sep 2026): tre segment-stile.
 *  A fyldt sort · B let grå · C lysere endnu · X/L dæmpet neutralt.
 *  Kadencen er finere end binær "A/resten" og koster ingenting — Stitch
 *  bruger den for at give scannerens øje endnu et hierarki-trin.
 *
 *  Radius 2 px (--r-1) matcher Stitchs `rounded` = 0.125rem —
 *  afrundede rektangler, ikke pillekapsler.
 */
function SegmentPill({ segment }: { segment: "A" | "B" | "C" | "X" | "L" }) {
  const style =
    segment === "A"
      ? "bg-[var(--ink)] text-white font-bold"
      : segment === "B"
        ? "bg-[var(--surface-3)] text-[var(--fg)] font-medium"
        : segment === "C"
          ? "bg-[var(--surface-2)] text-[var(--fg-2)] font-medium"
          : "bg-[var(--surface-1)] text-[var(--fg-3)] font-medium";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-1.5 py-0.5 rounded-[var(--r-1)]",
        "text-[11px] whitespace-nowrap min-w-6",
        style,
      )}
      title={SEGMENT_HINT[segment]}
    >
      {segment}
    </span>
  );
}

function daysCellClass(status: VisitStatus): string {
  switch (status) {
    case "overdue":
    case "never_visited":
      return "text-[var(--st-red-fg)] font-medium";
    case "soon":
      return "text-[var(--st-amber-fg)] font-medium";
    case "on_plan":
      return "text-[var(--fg-2)]";
    default:
      return "text-[var(--fg-3)]";
  }
}

function daysCellText(row: EnrichedRow): string {
  if (row.priority.status === "never_visited") return "aldrig";
  const days = row.priority.daysSinceVisit ?? null;
  // Brief 45 §4: humanisér ≥ 30 dage så scannerens øje ikke skal
  // omregne 400 til "over ét år".
  if (days != null && days >= 30) return humanOverdue(days);
  return humanDaysSince(days);
}

/** Brief 53 §2b (17. sep 2026): 44 px ikonknap ⇅ på smal skærm der
 *  åbner et bundark med de tre sorteringer. Prik når sortMode afviger
 *  fra standard (Navn A-Å) — så man kan se listen ER sorteret
 *  anderledes end man tror. */
function SortMobileTrigger({
  current,
  onSelect,
}: {
  current: SortMode;
  onSelect: (v: SortMode) => void;
}) {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const isDefault = current === "name";
  const label =
    current === "priority"
      ? translate("lago.customer_list.sort.priority")
      : current === "last_visit"
        ? translate("lago.customer_list.sort.last_visit")
        : translate("lago.customer_list.sort.name");
  const options: Array<{ value: SortMode; label: string }> = [
    { value: "name", label: translate("lago.customer_list.sort.name") },
    {
      value: "priority",
      label: translate("lago.customer_list.sort.priority"),
    },
    {
      value: "last_visit",
      label: translate("lago.customer_list.sort.last_visit"),
    },
  ];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Sortering: ${label}`}
        title={`Sortering: ${label}`}
        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-2)] bg-[var(--surface-3)] text-[var(--fg)] transition-colors hover:bg-[var(--surface-3)]/80 md:hidden"
      >
        <Icon icon={ArrowUpDown} size="sm" />
        {!isDefault && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--ink)]"
          />
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="p-0 [&>button.absolute]:hidden">
          <SheetTitle className="border-b border-[var(--line)] px-4 py-3 text-[length:var(--t-body)] font-bold text-[var(--fg)]">
            Sortering
          </SheetTitle>
          <ul className="flex flex-col p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
            {options.map((o) => {
              const active = o.value === current;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--r-2)] px-3 text-left",
                      "text-[length:var(--t-body)] transition-colors",
                      active
                        ? "bg-[var(--surface-3)] font-medium text-[var(--fg)]"
                        : "text-[var(--fg-2)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                    )}
                  >
                    <span>{o.label}</span>
                    {active && (
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full bg-[var(--ink)]"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Brief 50 §1 (17. sep 2026): resumér de aktive filtre til én linje
 *  så filterbjælken kan vise "Segment: A · Distrikt: Øst · Kun mine"
 *  frem for bare ordet "Filtre". */
function summariseActiveFilters({
  selectedSegment,
  selectedVisitStatus,
  selectedDistrikter,
  selectedSalesNames,
  onlyMine,
  showInactive,
  showLeads,
}: {
  selectedSegment: Segment | "all";
  selectedVisitStatus: VisitStatusFilter;
  selectedDistrikter: Set<string>;
  selectedSalesNames: Set<string>;
  onlyMine: boolean;
  showInactive: boolean;
  showLeads: boolean;
}): string {
  const parts: string[] = [];
  parts.push(
    selectedSegment === "all"
      ? "Alle segmenter"
      : `Segment: ${selectedSegment}`,
  );
  if (selectedVisitStatus !== "any") {
    parts.push(
      selectedVisitStatus === "overdue"
        ? "Overskredet"
        : selectedVisitStatus === "soon"
          ? "Trænger snart"
          : "Ajour",
    );
  }
  if (selectedDistrikter.size > 0) {
    parts.push(
      selectedDistrikter.size === 1
        ? `Distrikt: ${[...selectedDistrikter][0]}`
        : `Distrikt: ${selectedDistrikter.size} valgt`,
    );
  }
  if (selectedSalesNames.size > 0) {
    parts.push(
      selectedSalesNames.size === 1
        ? `Sælger: ${[...selectedSalesNames][0]}`
        : `Sælger: ${selectedSalesNames.size} valgt`,
    );
  }
  if (onlyMine) parts.push("Kun mine");
  if (showInactive) parts.push("Inkl. inaktive");
  if (showLeads) parts.push("Inkl. leads");
  return parts.join(" · ");
}

// Brief 54 §3 (17. sep 2026): shortenSalesName er løftet til
// src/lago/ui/ så aktivitetssiden og widgets kan bruge samme regel.

/** Brief 51 §1 (17. sep 2026): besøgsstatus som tekst på metalinjen +
 *  prik før navnet. "Aldrig besøgt" · "9 dage over" · "Trænger snart"
 *  · "Ajour". Farve følger status; tomt for "no_urgency" (X/L).
 *
 *  Erstatter Brief 50 §1's mærkat-form: 159 af 260 kunder havde
 *  samme mærkat ("Aldrig besøgt"), som kostede kundenavnet plads —
 *  et mærkat der står ens på hver anden række er ikke information.
 *  Prikken siger HVAD, teksten siger HVOR MEGET.
 */
function besoegsstatusText(priority: EnrichedRow["priority"]): string | null {
  const s = priority.status;
  if (s === "never_visited") return "Aldrig besøgt";
  if (s === "overdue") return humanOverdue(priority.daysOverdue);
  if (s === "soon") return "Trænger snart";
  if (s === "on_plan") return "Ajour";
  return null;
}

/** Farveklasse til besøgsstatus-teksten i metalinjen. Kun rød og gul
 *  farves — ajour og no_urgency bruger --fg-3 fra parent-linjen. */
function besoegsstatusColorClass(
  priority: EnrichedRow["priority"],
): string | null {
  const s = priority.status;
  if (s === "overdue" || s === "never_visited")
    return "text-[var(--st-red-fg)]";
  if (s === "soon") return "text-[var(--st-amber-fg)]";
  return null;
}

/** Brief 51 §1 + Brief 54 §2a (17. sep 2026): 8 px farvet prik før
 *  navnet. Rød/gul/grøn efter status. Prikken tegnes ALTID — også når
 *  der ingen status er (no_urgency/X/L) — så navnene flugter på tværs
 *  af rækker. Uden status står prikken i --fg-4 (dæmpet grå). En
 *  liste hvor venstrekanten hopper er langsommere at scanne. */
function StatusDot({ priority }: { priority: EnrichedRow["priority"] }) {
  const s = priority.status;
  const colorClass =
    s === "overdue" || s === "never_visited"
      ? "bg-[var(--st-red-fg)]"
      : s === "soon"
        ? "bg-[var(--st-amber-fg)]"
        : s === "on_plan"
          ? "bg-[var(--st-green-fg)]"
          : "bg-[var(--fg-4)]";
  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full", colorClass)}
      aria-hidden
    />
  );
}

function CustomerRow({
  row,
  selected,
  onSelect,
  emphasisePriority: _emphasisePriority,
}: CustomerRowProps) {
  const sellers = useSellerLookup();
  const { name, city, extension, priority } = row;
  const distrikt = extension?.distrikt ?? "—";
  const segment = extension?.segment ?? null;
  const salesFull =
    sellers.byCode(extension?.visma_sales_code) ??
    extension?.visma_sales_name ??
    null;
  const salesLaptop = salesFull ?? "—";
  const salesMobile = shortenSalesName(salesFull);
  const statusText = besoegsstatusText(priority);
  const statusColor = besoegsstatusColorClass(priority);
  return (
    <button
      type="button"
      onClick={() => onSelect(row.id)}
      title={salesFull ?? undefined}
      className="w-full text-left focus-visible:outline-none"
    >
      {/* Brief 51 §1 (17. sep 2026): hvide kort med farvet prik FØR
          navnet (rød/gul/grøn), besøgsstatus som TEKST på metalinjen
          — ikke som mærkat. Mærkatet fyldte for meget og gentog sig
          på 159 af 260 kunder; prikken siger hvad, teksten siger
          hvor meget. */}
      <div
        className={cn(
          "md:hidden flex items-center gap-3 rounded-[var(--r-2)] p-3",
          "bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors",
          selected && "bg-[var(--surface-2)] hover:bg-[var(--surface-2)]",
        )}
      >
        <StatusDot priority={priority} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="min-w-0 truncate text-[length:var(--t-body)] font-semibold text-[var(--fg)]">
              {name}
            </span>
            {segment && <SegmentPill segment={segment} />}
            {row.next_planned_at && (
              <Icon
                icon={CalendarClock}
                size="sm"
                className="shrink-0 text-[var(--ink)]"
                aria-label="Planlagt aftale"
              />
            )}
          </div>
          <p className="mt-1 truncate text-[length:var(--t-meta)] text-[var(--fg-3)]">
            {city && <span>{city}</span>}
            {city && salesMobile && <span aria-hidden> · </span>}
            {salesMobile && <span>{salesMobile}</span>}
            {statusText && (
              <>
                {(city || salesMobile) && <span aria-hidden> · </span>}
                <span className={cn(statusColor ?? undefined)}>
                  {statusText}
                </span>
              </>
            )}
          </p>
        </div>
        <Icon
          icon={ChevronRight}
          size="sm"
          className="shrink-0 text-[var(--fg-3)]"
          aria-hidden
        />
      </div>

      {/* Laptop-tabelrække. 44 px, grid, hover, valgt = --surface-3. */}
      <div
        className={cn(
          "hidden md:grid items-center min-h-11 px-3 gap-2",
          "border-b border-[var(--line)] transition-colors",
          "hover:bg-[var(--surface-2)]",
          selected && "bg-[var(--surface-3)] hover:bg-[var(--surface-3)]",
          "grid-cols-[minmax(160px,1.6fr)_90px_72px_65px_100px_95px]",
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              statusDotClass(priority.status),
            )}
            aria-hidden
          />
          <span className="truncate text-sm font-medium text-[var(--fg)]">
            {name}
          </span>
          {row.next_planned_at && (
            <Icon
              icon={CalendarClock}
              size="sm"
              className="shrink-0 text-[var(--ink)]"
              aria-label="Planlagt aftale"
            />
          )}
        </span>
        <span className="truncate text-sm text-[var(--fg-2)]">
          {city || "—"}
        </span>
        <span className="flex items-center">
          {segment ? (
            <SegmentPill segment={segment} />
          ) : (
            <span className="text-sm text-[var(--fg-3)]">—</span>
          )}
        </span>
        <span className="truncate text-sm text-[var(--fg-2)]">{distrikt}</span>
        <span className="truncate text-sm text-[var(--fg-2)]">
          {salesLaptop}
        </span>
        <span
          className={cn(
            "text-right text-sm whitespace-nowrap tabular-nums",
            daysCellClass(priority.status),
          )}
        >
          {daysCellText(row)}
        </span>
      </div>
    </button>
  );
}

function CustomerRowHeader() {
  // Brief 45 §4: sticky header så kolonne-titlerne aldrig forsvinder når
  // sælgeren scroller ned i 257 rækker. Under 768 px er header skjult —
  // rækkerne står som stakkede kort med skillelinjer, ikke tabel.
  return (
    <div
      className={cn(
        "hidden md:grid sticky top-0 z-10 items-center min-h-11 px-3 gap-2",
        "bg-[var(--surface-1)] border-b border-[var(--line)]",
        "text-[length:var(--t-meta)] uppercase tracking-wider text-[var(--fg-2)] font-medium",
        // Brief 45 §4: samme grid-template som CustomerRow så kolonnerne flugter.
        // Brief 48 §F (16. sep 2026): bredder rettet til Stitchs
        // 160/90/72/65/100/95. Vores 100 px by-kolonne og 74 px segment
        // gav ikke luft nok — uden truncate løb "SEGMENT" ind i
        // "DISTRIKT" og videre. truncate på hver celle sikrer at ingen
        // ord kan slippe ud af sin egen kolonne uanset bredde.
        "grid-cols-[minmax(160px,1.6fr)_90px_72px_65px_100px_95px]",
      )}
    >
      <span className="truncate">Kundenavn</span>
      <span className="truncate">By</span>
      <span className="truncate">Segment</span>
      <span className="truncate">Distrikt</span>
      <span className="truncate">Sælger</span>
      <span className="truncate text-right">Sidste besøg</span>
    </div>
  );
}

/** Brief 48 §E (16. sep 2026): venstre-skinne med tal ved hver mulighed.
 *  Radio for enkeltvalg (segment · besøgsstatus), afkrydsning for
 *  flervalg (distrikt · sælger). Tal er --fg-3, undtagen "Overskredet"
 *  som er --st-red-fg og "Trænger snart" som er --st-amber-fg — de
 *  farver viser problemets størrelse før man klikker. */
interface FilterSidebarProps {
  totalCount: number;
  onlyMine: boolean;
  onOnlyMineChange: (v: boolean) => void;
  onlyMineDisabled: boolean;
  showInactive: boolean;
  onShowInactiveChange: (v: boolean) => void;
  showLeads: boolean;
  onShowLeadsChange: (v: boolean) => void;

  selectedSegment: Segment | "all";
  onSelectSegment: (v: Segment | "all") => void;
  segmentCounts: Record<Segment | "all", number>;

  selectedVisitStatus: VisitStatusFilter;
  onSelectVisitStatus: (v: VisitStatusFilter) => void;
  visitStatusCounts: Record<VisitStatusFilter, number>;

  distrikter: Map<string, number>;
  selectedDistrikter: Set<string>;
  onToggleDistrikt: (d: string) => void;

  sellers: Map<string, number>;
  selectedSalesNames: Set<string>;
  onToggleSalesName: (n: string) => void;

  brancher: Array<{ kode: number; label: string; count: number }>;
  utenBrancheCount: number;
  selectedBrancheKoder: Set<number>;
  onToggleBrancheKode: (k: number) => void;
  brancheNoneSelected: boolean;
  onToggleBrancheNone: () => void;

  hasActiveFilter: boolean;
  onReset: () => void;
}

function FilterSidebar(props: FilterSidebarProps) {
  // Brief 58 tillæg B (17. sep 2026): BRANCHE kappes ved fem for at holde
  // skinnens højde under viewporthøjden ved 1440. De fem er dem med FLEST
  // kunder (ikke alfabetisk), og en valgt branche vises altid — også når
  // den ligger uden for top-5. "Vis alle (N)" ekspanderer resten.
  // Ingen collapse på gruppe-niveau (§2c) — man skal kunne se filtreringen
  // uden at folde ud. Options-collapse under "Vis alle" er OK fordi
  // valgte brancher altid er synlige.
  const [brancheExpanded, setBrancheExpanded] = useState(false);
  const BRANCHE_CAP = 5;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[length:var(--t-body)] font-bold text-[var(--fg)]">
          Filtrering
        </h2>
        <span className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
          {props.totalCount} kunder
        </span>
      </div>
      {/* Brief 58 §2b (17. sep 2026): VISNING-overskrift over toggles.
          De tre er ikke filtre — de ændrer HVILKE kunder der er med,
          hvor filtrene indsnævrer inden for dem. Overskriften siger det. */}
      <FilterGroup label="Visning">
        <ToggleRow
          label="Kun mine kunder"
          checked={props.onlyMine}
          onChange={props.onOnlyMineChange}
          disabled={props.onlyMineDisabled}
        />
        <ToggleRow
          label="Vis inaktive kunder"
          checked={props.showInactive}
          onChange={props.onShowInactiveChange}
        />
        <ToggleRow
          label="Vis leads (segment L)"
          checked={props.showLeads}
          onChange={props.onShowLeadsChange}
        />
      </FilterGroup>
      <FilterGroup label="Segment">
        <RadioRow
          name="segment"
          label="Alle segmenter"
          value="all"
          selected={props.selectedSegment}
          onSelect={(v) => props.onSelectSegment(v as Segment | "all")}
          count={props.segmentCounts.all}
        />
        {(["A", "B", "C", "X"] as const).map((s) => (
          <RadioRow
            key={s}
            name="segment"
            label={`Segment ${s}${s === "X" ? " (Uklassificeret)" : ""}`}
            value={s}
            selected={props.selectedSegment}
            onSelect={(v) => props.onSelectSegment(v as Segment | "all")}
            count={props.segmentCounts[s]}
          />
        ))}
      </FilterGroup>
      <FilterGroup label="Besøgsstatus">
        <RadioRow
          name="visitStatus"
          label="Alle statuser"
          value="any"
          selected={props.selectedVisitStatus}
          onSelect={(v) => props.onSelectVisitStatus(v as VisitStatusFilter)}
          count={props.visitStatusCounts.any}
        />
        <RadioRow
          name="visitStatus"
          label="Overskredet interval"
          value="overdue"
          selected={props.selectedVisitStatus}
          onSelect={(v) => props.onSelectVisitStatus(v as VisitStatusFilter)}
          count={props.visitStatusCounts.overdue}
          countTone="red"
        />
        <RadioRow
          name="visitStatus"
          label="Trænger snart"
          value="soon"
          selected={props.selectedVisitStatus}
          onSelect={(v) => props.onSelectVisitStatus(v as VisitStatusFilter)}
          count={props.visitStatusCounts.soon}
          countTone="amber"
        />
        <RadioRow
          name="visitStatus"
          label="Ajour"
          value="on_plan"
          selected={props.selectedVisitStatus}
          onSelect={(v) => props.onSelectVisitStatus(v as VisitStatusFilter)}
          count={props.visitStatusCounts.on_plan}
        />
      </FilterGroup>
      {props.distrikter.size > 0 && (
        <FilterGroup label="Distrikt">
          {[...props.distrikter.entries()]
            .sort(([a], [b]) => a.localeCompare(b, "da"))
            .map(([name, count]) => (
              <CheckboxRow
                key={name}
                label={name}
                checked={props.selectedDistrikter.has(name)}
                onChange={() => props.onToggleDistrikt(name)}
                count={count}
              />
            ))}
        </FilterGroup>
      )}
      {(props.brancher.length > 0 || props.utenBrancheCount > 0) && (
        <FilterGroup label="Branche">
          {(() => {
            // Top-5 efter count DESC (ikke alfabetisk — de fem MED FLEST
            // kunder). Sortering skifter kun for skæring; den kanoniske
            // aktive→udgåede-sortering fra brancherOptions bevares.
            const byCount = [...props.brancher].sort(
              (a, b) => b.count - a.count,
            );
            const topByCount = new Set(
              byCount.slice(0, BRANCHE_CAP).map((b) => b.kode),
            );
            const visible = brancheExpanded
              ? props.brancher
              : props.brancher.filter(
                  (b) =>
                    topByCount.has(b.kode) ||
                    // Valgte brancher vises altid — også når de ligger
                    // uden for top-5. Ellers forsvinder et aktivt filter
                    // og skinnens filter-tal bliver løgn.
                    props.selectedBrancheKoder.has(b.kode),
                );
            const hidden = props.brancher.length - visible.length;
            return (
              <>
                {visible.map((b) => (
                  <CheckboxRow
                    key={b.kode}
                    label={b.label}
                    checked={props.selectedBrancheKoder.has(b.kode)}
                    onChange={() => props.onToggleBrancheKode(b.kode)}
                    count={b.count}
                  />
                ))}
                {props.utenBrancheCount > 0 && (
                  <CheckboxRow
                    label="Uden branche"
                    checked={props.brancheNoneSelected}
                    onChange={props.onToggleBrancheNone}
                    count={props.utenBrancheCount}
                  />
                )}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => setBrancheExpanded(true)}
                    className="mt-1 self-start text-[length:var(--t-meta)] text-[var(--fg-2)] underline underline-offset-2 hover:text-[var(--fg)]"
                  >
                    Vis alle ({props.brancher.length})
                  </button>
                )}
                {brancheExpanded && props.brancher.length > BRANCHE_CAP && (
                  <button
                    type="button"
                    onClick={() => setBrancheExpanded(false)}
                    className="mt-1 self-start text-[length:var(--t-meta)] text-[var(--fg-2)] underline underline-offset-2 hover:text-[var(--fg)]"
                  >
                    Vis færre
                  </button>
                )}
              </>
            );
          })()}
        </FilterGroup>
      )}
      {props.sellers.size > 0 && (
        <FilterGroup label="Ansvarlig sælger">
          {[...props.sellers.entries()]
            .sort(([a], [b]) => a.localeCompare(b, "da"))
            .map(([name, count]) => (
              <CheckboxRow
                key={name}
                label={name}
                checked={props.selectedSalesNames.has(name)}
                onChange={() => props.onToggleSalesName(name)}
                count={count}
              />
            ))}
        </FilterGroup>
      )}
      {props.hasActiveFilter && (
        <button
          type="button"
          onClick={props.onReset}
          className="mt-2 self-center text-[length:var(--t-sec)] text-[var(--fg-2)] hover:text-[var(--fg)] underline underline-offset-2"
        >
          Nulstil alle filtre
        </button>
      )}
    </div>
  );
}

/**
 * LAGO customer list at scale (Domain-brief 8, refining brief 3b).
 * Landscape: filtered list on the left + fetched preview on the right.
 * Portrait: single-column list; tapping a row opens a bottom-sheet with
 * the same preview surface. Default sort is alphabetical (a normal,
 * browsable list); priority is available as an opt-in sort. All existing
 * Atomic-side filters are preserved and joined by the new distrikt +
 * sælger pickers now that we have real data.
 */
export function LagoCustomerList() {
  const translate = useTranslate();
  const hasSideRail = useHasSideRail();
  const { data: identity } = useGetIdentity();
  const mySalesId = typeof identity?.id === "number" ? identity.id : null;

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  // Brief 53 §2c (17. sep 2026): standardsortering er Navn A-Å.
  // Kundelisten er en OPSLAGSLISTE — man kommer med et navn i hovedet
  // og skal finde det. Trænger-mest er Dagens-listens rolle.
  // Sorteringen står i URL'en (?sort=priority) så et link viser samme
  // rækkefølge som afsenderen så — samme regel som brief 44 §3.
  const [searchParams, setSearchParams] = useSearchParams();
  const sortFromUrl = searchParams.get("sort");
  const sortMode: SortMode =
    sortFromUrl === "priority" || sortFromUrl === "last_visit"
      ? sortFromUrl
      : "name";
  const setSortMode = (v: SortMode) => {
    const next = new URLSearchParams(searchParams);
    if (v === "name") {
      next.delete("sort");
    } else {
      next.set("sort", v);
    }
    setSearchParams(next, { replace: true });
  };
  // Brief 48 §E (16. sep 2026): filtre skifter fra chip-bar til
  // venstre-skinne. Segment og Besøgsstatus er ENKELTVALG (radio),
  // Distrikt og Sælger er FLERVALG (checkbox) — matcher Stitchs
  // filter-mønster. State-typerne skifter tilsvarende.
  // Brief 74 §1 (22. sep 2026): initialiser besøgsstatus-filter fra
  // URL'ens ?filter={"priority_status":"..."}-parameter, så
  // "Se alle overskredne →" fra dashboard-widgets faktisk lander på
  // en filtreret liste. Uden det ignoreredes URL'en tavst, og linket
  // leverede 260 kunder til en, der bad om overskredne.
  const initialVisitStatus = useMemo<VisitStatusFilter>(() => {
    try {
      const raw = searchParams.get("filter");
      if (!raw) return "any";
      const parsed = JSON.parse(raw) as { priority_status?: string };
      const v = parsed?.priority_status;
      if (v === "overdue" || v === "soon" || v === "on_plan") return v;
      return "any";
    } catch {
      return "any";
    }
    // Kun ved mount — ellers ville et brugerklik på "Alle" straks
    // blive overskrevet af den gamle URL. Efter mount ejer state'et
    // filteret; URL'en er kun startpunkt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedSegment, setSelectedSegment] = useState<Segment | "all">(
    "all",
  );
  const [selectedVisitStatus, setSelectedVisitStatus] =
    useState<VisitStatusFilter>(initialVisitStatus);
  const [selectedDistrikter, setSelectedDistrikter] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSalesNames, setSelectedSalesNames] = useState<Set<string>>(
    new Set(),
  );
  // Brief 58 §2b (17. sep 2026): branche-filter — checkbox, flervalg
  // over de forekommende brancher_lago-koder + "Uden branche" som
  // separat option (efter trin A har 928 af 1.165 kunder branche_kode
  // = NULL; deres andel er værd at kunne se og bore ned i).
  const [selectedBrancheKoder, setSelectedBrancheKoder] = useState<Set<number>>(
    new Set(),
  );
  const [brancheNoneSelected, setBrancheNoneSelected] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Brief 13: default kun aktive kunder vises. Toggle for at inkludere
  // inaktive (fx til historik-genfinding).
  const [showInactive, setShowInactive] = useState(false);
  // Brief 14: leads (L) skjules som default. Toggle for at se dem.
  const [showLeads, setShowLeads] = useState(false);
  // Brief 48 §E: filter-blokken over listen (kun ved < 1280 px)
  // starter kollapset så listen er synlig fra første klik.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const intervals = useVisitIntervals();
  const query = useQuery({
    // Brief 26 §2 (rev. 16. sep 2026): showInactive er nu en del af
    // query-key'en så toggle udløser refetch — serveren returnerer nu
    // kun aktive kunder som standard for at holde payloaden nede.
    // Client-side filter (linje ~303) er bevaret som backup.
    queryKey: ["lago-customer-list", { onlyMine, mySalesId, showInactive }],
    queryFn: () =>
      fetchCustomerListWithCount({
        mySalesId,
        onlyMine,
        includeInactive: showInactive,
      }),
  });

  const sellers = useSellerLookup();

  // Brief 55 §2 (17. sep 2026): fetchCustomerList returnerer nu
  // {rows, total, truncated}. Hvis truncated=true fortæller UI det.
  const serverRows = query.data?.rows;
  const serverTotal = query.data?.total ?? 0;
  const serverTruncated = query.data?.truncated ?? false;
  const rows = useMemo<EnrichedRow[]>(() => {
    if (!serverRows) return [];
    const needle = deferredSearch.trim().toLowerCase();
    const enriched: EnrichedRow[] = serverRows.map((c) => ({
      ...c,
      priority: resolveVisitPriority(c.visit_priority),
    }));
    const filtered = enriched.filter((r) => {
      // Brief 13: aktive vises default. showInactive slår gate fra.
      if (!showInactive && r.extension?.is_active === false) return false;
      // Brief 14: leads (L) skjules som default. showLeads slår gate fra.
      if (!showLeads && r.extension?.segment === "L") return false;
      if (needle) {
        const hay =
          `${r.name} ${r.city ?? ""} ${r.extension?.visma_customer_no ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      // Brief 48 §E (16. sep 2026): venstre-skinnens filtre.
      if (selectedSegment !== "all") {
        if (r.extension?.segment !== selectedSegment) return false;
      }
      if (selectedDistrikter.size > 0) {
        if (!r.extension?.distrikt) return false;
        if (!selectedDistrikter.has(r.extension.distrikt)) return false;
      }
      if (selectedSalesNames.size > 0) {
        const resolved =
          sellers.byCode(r.extension?.visma_sales_code) ??
          r.extension?.visma_sales_name ??
          null;
        if (!resolved || !selectedSalesNames.has(resolved)) return false;
      }
      if (selectedVisitStatus !== "any") {
        const s = r.priority.status;
        if (selectedVisitStatus === "overdue") {
          if (s !== "overdue" && s !== "never_visited") return false;
        } else if (selectedVisitStatus === "soon") {
          if (s !== "soon") return false;
        } else if (selectedVisitStatus === "on_plan") {
          if (s !== "on_plan") return false;
        }
      }
      // Brief 58 §2b (17. sep 2026): branche-filter.
      if (selectedBrancheKoder.size > 0 || brancheNoneSelected) {
        const k = r.extension?.branche_kode ?? null;
        const matchesNone = k == null && brancheNoneSelected;
        const matchesKode = k != null && selectedBrancheKoder.has(k);
        if (!matchesNone && !matchesKode) return false;
      }
      return true;
    });
    if (sortMode === "priority") {
      // Brief 37 §4 (16. sep 2026): fuld tiebreak — priority → segment →
      // navn. Uden segment-fallbacket ville hele feltet af never_visited
      // rangere ens, og Array.sort ville lande dem i forespørgselsordenen
      // (alfabetisk). Samme comparator som TraengerWidget og NeedsVisitTop5.
      return filtered
        .map((r) => ({ ...r, segment: r.extension?.segment ?? null }))
        .sort(comparePriorityThenSegmentThenName);
    }
    if (sortMode === "last_visit") {
      return filtered.sort((a, b) => {
        const aT = a.extension?.last_visit_at ?? "";
        const bT = b.extension?.last_visit_at ?? "";
        return bT.localeCompare(aT);
      });
    }
    return filtered.sort((a, b) =>
      a.name.localeCompare(b.name, "da", { sensitivity: "base" }),
    );
  }, [
    serverRows,
    deferredSearch,
    selectedSegment,
    selectedDistrikter,
    selectedSalesNames,
    selectedVisitStatus,
    selectedBrancheKoder,
    brancheNoneSelected,
    sortMode,
    intervals,
    sellers,
    showInactive,
    showLeads,
  ]);

  const counts = useMemo(() => {
    const c = {
      overdue: 0,
      soon: 0,
      on_plan: 0,
      never_visited: 0,
      no_urgency: 0,
    } as Record<VisitStatus, number>;
    for (const r of rows) c[r.priority.status]++;
    return c;
  }, [rows]);

  // Brief 60 §1 (17. sep 2026, rettelse): tal ved hver filter-option er
  // KONTEKST-følsomme. Hver gruppes tal beregnes med alle andre
  // gruppers filtre anvendt, men uden gruppens eget. Vælger man
  // Segment X, viser DISTRIKT nu "HQ 5 · Vest N" — kontakter i segment
  // X pr. distrikt — mens SEGMENT-gruppen selv fortsat viser alle
  // segmenter med deres tal (i andre filtres kontekst). Det gør
  // tallene brugbare igen: "hvis jeg også vælger Vest, får jeg N mere".
  //
  // Rene absolutte tal (fx "Vest 104" mens Segment X er valgt og
  // resultatet er 5) er værre end intet tal — de lyver om, hvad næste
  // klik vil give.
  const baseRows = useMemo<EnrichedRow[]>(() => {
    if (!serverRows) return [];
    return serverRows
      .filter((c) => {
        if (!showInactive && c.extension?.is_active === false) return false;
        if (!showLeads && c.extension?.segment === "L") return false;
        return true;
      })
      .map((c) => ({
        ...c,
        priority: resolveVisitPriority(c.visit_priority),
      }));
  }, [serverRows, showInactive, showLeads, intervals]);

  const filterCounts = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();

    // Filter-prædikat. Kaldes med de fem gruppevaerdier så vi kan
    // "slukke" én gruppe ad gangen og tælle resten.
    type FilterInput = {
      segment: Segment | "all";
      distrikter: Set<string>;
      salesNames: Set<string>;
      visitStatus: VisitStatusFilter;
      brancheKoder: Set<number>;
      brancheNone: boolean;
    };
    const passes = (r: EnrichedRow, opts: FilterInput): boolean => {
      if (needle) {
        const hay = `${r.name} ${r.city ?? ""} ${
          r.extension?.visma_customer_no ?? ""
        }`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (opts.segment !== "all" && r.extension?.segment !== opts.segment)
        return false;
      if (opts.distrikter.size > 0) {
        if (!r.extension?.distrikt) return false;
        if (!opts.distrikter.has(r.extension.distrikt)) return false;
      }
      if (opts.salesNames.size > 0) {
        const resolved =
          sellers.byCode(r.extension?.visma_sales_code) ??
          r.extension?.visma_sales_name ??
          null;
        if (!resolved || !opts.salesNames.has(resolved)) return false;
      }
      if (opts.visitStatus !== "any") {
        const s = r.priority.status;
        if (opts.visitStatus === "overdue") {
          if (s !== "overdue" && s !== "never_visited") return false;
        } else if (opts.visitStatus === "soon") {
          if (s !== "soon") return false;
        } else if (opts.visitStatus === "on_plan") {
          if (s !== "on_plan") return false;
        }
      }
      if (opts.brancheKoder.size > 0 || opts.brancheNone) {
        const k = r.extension?.branche_kode ?? null;
        const matchesNone = k == null && opts.brancheNone;
        const matchesKode = k != null && opts.brancheKoder.has(k);
        if (!matchesNone && !matchesKode) return false;
      }
      return true;
    };

    const baseOpts = {
      segment: selectedSegment,
      distrikter: selectedDistrikter,
      salesNames: selectedSalesNames,
      visitStatus: selectedVisitStatus,
      brancheKoder: selectedBrancheKoder,
      brancheNone: brancheNoneSelected,
    };
    // Fem subsets — én pr. gruppe hvor gruppens eget filter er nul.
    const forSegment = baseRows.filter((r) =>
      passes(r, { ...baseOpts, segment: "all" }),
    );
    const forVisitStatus = baseRows.filter((r) =>
      passes(r, { ...baseOpts, visitStatus: "any" }),
    );
    const forDistrikt = baseRows.filter((r) =>
      passes(r, { ...baseOpts, distrikter: new Set() }),
    );
    const forSales = baseRows.filter((r) =>
      passes(r, { ...baseOpts, salesNames: new Set() }),
    );
    const forBranche = baseRows.filter((r) =>
      passes(r, { ...baseOpts, brancheKoder: new Set(), brancheNone: false }),
    );

    const segment: Record<Segment | "all", number> = {
      all: forSegment.length,
      A: 0,
      B: 0,
      C: 0,
      X: 0,
      L: 0,
    };
    for (const r of forSegment) {
      const s = r.extension?.segment;
      if (s && segment[s as Segment] != null) segment[s as Segment]++;
    }

    const visitStatus: Record<VisitStatusFilter, number> = {
      any: forVisitStatus.length,
      overdue: 0,
      soon: 0,
      on_plan: 0,
    };
    for (const r of forVisitStatus) {
      const status = r.priority.status;
      if (status === "overdue" || status === "never_visited")
        visitStatus.overdue++;
      else if (status === "soon") visitStatus.soon++;
      else if (status === "on_plan") visitStatus.on_plan++;
    }

    // Distrikter og sælgere: alle værdier der findes i baseRows bevares
    // (tal = 0 hvis pt. tomt under de andre filtre), så en option ikke
    // forsvinder helt og gør skinnen usammenhængende.
    const distrikt = new Map<string, number>();
    for (const r of forDistrikt) {
      const d = r.extension?.distrikt;
      if (d) distrikt.set(d, (distrikt.get(d) ?? 0) + 1);
    }
    for (const r of baseRows) {
      const d = r.extension?.distrikt;
      if (d && !distrikt.has(d)) distrikt.set(d, 0);
    }

    const sales = new Map<string, number>();
    for (const r of forSales) {
      const name =
        sellers.byCode(r.extension?.visma_sales_code) ??
        r.extension?.visma_sales_name ??
        null;
      if (name) sales.set(name, (sales.get(name) ?? 0) + 1);
    }
    for (const r of baseRows) {
      const name =
        sellers.byCode(r.extension?.visma_sales_code) ??
        r.extension?.visma_sales_name ??
        null;
      if (name && !sales.has(name)) sales.set(name, 0);
    }

    // Branche — samme mønster: alle koder der forekommer i baseRows
    // bevares, tal fra forBranche-subsettet. Utens branche som separat
    // tæller. Fuld liste af koder inkl. udgåede holdes så vi kan sortere
    // aktive/udgåede i FilterSidebar.
    const brancheMap = new Map<number, number>();
    let utenBrancheCountInSubset = 0;
    for (const r of forBranche) {
      const k = r.extension?.branche_kode ?? null;
      if (k == null) utenBrancheCountInSubset++;
      else brancheMap.set(k, (brancheMap.get(k) ?? 0) + 1);
    }
    for (const r of baseRows) {
      const k = r.extension?.branche_kode ?? null;
      if (k != null && !brancheMap.has(k)) brancheMap.set(k, 0);
    }

    return {
      segment,
      visitStatus,
      distrikt,
      sales,
      brancheMap,
      utenBrancheCount: utenBrancheCountInSubset,
    };
  }, [
    baseRows,
    sellers,
    deferredSearch,
    selectedSegment,
    selectedDistrikter,
    selectedSalesNames,
    selectedVisitStatus,
    selectedBrancheKoder,
    brancheNoneSelected,
  ]);

  // Brief 55 §2 (17. sep 2026): paginering fjernet — alle rækker
  // renderes. Browser-⌘F virker først når alt står på siden, og
  // "gå tilbage til hvor jeg var" bryder ikke længere.
  const visibleRows = rows;

  const handleSelect = (id: number) => {
    setSelectedId(id);
    if (!hasSideRail) setSheetOpen(true);
  };

  const toggleDistrikt = (d: string) => {
    setSelectedDistrikter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };
  const toggleSalesName = (n: string) => {
    setSelectedSalesNames((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };
  const toggleBrancheKode = (k: number) => {
    setSelectedBrancheKoder((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const toggleBrancheNone = () => setBrancheNoneSelected((v) => !v);
  const resetAllFilters = () => {
    setSelectedSegment("all");
    setSelectedVisitStatus("any");
    setSelectedDistrikter(new Set());
    setSelectedSalesNames(new Set());
    setSelectedBrancheKoder(new Set());
    setBrancheNoneSelected(false);
  };
  const hasActiveFilter =
    selectedSegment !== "all" ||
    selectedVisitStatus !== "any" ||
    selectedDistrikter.size > 0 ||
    selectedSalesNames.size > 0 ||
    selectedBrancheKoder.size > 0 ||
    brancheNoneSelected;

  // Brief 58 §2b (17. sep 2026): branche-optioner sorteret aktive→udgåede.
  // Udgåede koder (25, 35, 90) er et fund, ikke et valg — de skal ikke stå
  // midt i den alfabetiske liste hvor man kan komme til at klikke dem.
  const brancher = useBrancher();
  const brancherOptions = useMemo(() => {
    return [...filterCounts.brancheMap.entries()]
      .map(([kode, count]) => {
        const b = brancher.byKode(kode);
        return {
          kode,
          label: b?.navn ?? `Kode ${kode}`,
          count,
          aktiv: b?.aktiv !== false,
        };
      })
      .sort((a, b) => {
        const activeA = a.aktiv ? 0 : 1;
        const activeB = b.aktiv ? 0 : 1;
        if (activeA !== activeB) return activeA - activeB;
        return a.label.localeCompare(b.label, "da");
      });
  }, [filterCounts.brancheMap, brancher]);

  const emphasisePriority = sortMode === "priority";

  const filterSidebarProps: FilterSidebarProps = {
    totalCount: baseRows.length,
    onlyMine,
    onOnlyMineChange: (v) => {
      setOnlyMine(v);
    },
    onlyMineDisabled: mySalesId == null,
    showInactive,
    onShowInactiveChange: (v) => {
      setShowInactive(v);
    },
    showLeads,
    onShowLeadsChange: (v) => {
      setShowLeads(v);
    },
    selectedSegment,
    onSelectSegment: (v) => {
      setSelectedSegment(v);
    },
    segmentCounts: filterCounts.segment,
    selectedVisitStatus,
    onSelectVisitStatus: (v) => {
      setSelectedVisitStatus(v);
    },
    visitStatusCounts: filterCounts.visitStatus,
    distrikter: filterCounts.distrikt,
    selectedDistrikter,
    onToggleDistrikt: toggleDistrikt,
    sellers: filterCounts.sales,
    selectedSalesNames,
    onToggleSalesName: toggleSalesName,
    brancher: brancherOptions,
    utenBrancheCount: filterCounts.utenBrancheCount,
    selectedBrancheKoder,
    onToggleBrancheKode: toggleBrancheKode,
    brancheNoneSelected,
    onToggleBrancheNone: toggleBrancheNone,
    hasActiveFilter,
    onReset: resetAllFilters,
  };

  return (
    <LagoPullToRefresh>
      <div className="mx-auto max-w-screen-2xl">
        {/* Brief 48 §E (16. sep 2026): 3-kol layout på XL (≥ 1280 px):
          venstre-skinne 240 px · liste fleksibel · preview 360 px. På
          LG (1024-1279) er skinnen skjult; en sammenklappelig blok
          over listen bærer de samme filtre. Under LG er også preview
          en bottom-sheet. */}
        {/* Brief 54 §2b (17. sep 2026): under 480 px reduceres beholderens
          margin til px-2 så kundenavnet får plads (mindst 26 tegn ved
          390 px). Kortets eget p-3 bevares — det er luften INDE i
          kortet der læses. Fra 480: px-3, fra 640 (sm): px-4. */}
        <div className="grid grid-cols-1 gap-4 px-2 py-4 min-[480px]:px-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[240px_minmax(0,1fr)_360px]">
          <aside className="hidden xl:block">
            {/* Brief 58 §2 (17. sep 2026): skinnen ruller med siden — ingen
              egen overflow-y, ingen sticky. Med BRANCHE tilføjet bliver
              den for høj til at klæbe, og en skinne med sin egen
              rullebjælke ved siden af sidens er den præcise dubletbjælke
              vi lige fjernede. Søgefeltet klæber stadig (brief 55 §1). */}
            <div className="pr-1">
              <FilterSidebar {...filterSidebarProps} />
            </div>
          </aside>

          <div className="min-w-0">
            {/* Brief 53 §2a (17. sep 2026): på smal skærm får tællingen
              sin egen linje under overskriften, så den ikke brækker
              midt i opremsningen. På ≥ 768 px står den til højre for
              overskriften — der er plads, og formen holder. */}
            <header className="mb-3 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-3">
              <h1 className="text-lg font-bold text-[var(--fg)]">
                {translate("lago.customer_list.title")}
              </h1>
              <span
                className="text-[length:var(--t-meta)] text-[var(--fg-3)]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                {translate("lago.customer_list.summary", {
                  smart_count: rows.length,
                  total: rows.length,
                  overdue: counts.overdue + counts.never_visited,
                  soon: counts.soon,
                })}
              </span>
            </header>
            {/* Brief 55 §2 (17. sep 2026): sig højt hvis serveren har
              afkortet svaret — bedre end at tie stille om 164 kunder
              der ikke findes for sælgeren. */}
            {serverTruncated && (
              // Brief 55 tillæg A §3.2 (17. sep 2026): Jonas ER admin —
              // sig hvad der skal GØRES, ikke hvem der skal spørges.
              <p
                role="alert"
                className="mb-3 rounded-[var(--r-2)] border border-[var(--st-amber-fg)] bg-[var(--st-amber-bg)] px-3 py-2 text-[length:var(--t-sec)] font-medium text-[var(--st-amber-fg)]"
              >
                Viser {serverRows?.length ?? 0} af {serverTotal} — listen er
                afkortet. Indsnævr med et filter.
              </p>
            )}
            {/* Brief 55 §1 (17. sep 2026): sticky top-0, ikke top-14. Et
              hårdkodet offset er et gæt på LagoHeader-højden, og den
              varierer med tekstlængden på sync-linjen. Lad LagoHeader
              rulle væk (den er kontekst, ikke værktøj) — så pinner
              søgefeltet i selve skærmkanten uden offset at ramme forkert.
              pt-[env(safe-area-inset-top)] tager iPhonens notch. Negative
              margins matcher list-containerens px-2/px-3/px-4 så
              baggrunden dækker helt til kanten. */}
            <div
              className={cn(
                "sticky top-0 z-20 md:static md:z-auto",
                "pt-[env(safe-area-inset-top)] md:pt-0",
                "bg-[var(--canvas)] md:bg-transparent",
                "border-b border-[var(--line)] md:border-b-0",
                "-mx-2 min-[480px]:-mx-3 sm:-mx-4 md:mx-0",
                "px-2 min-[480px]:px-3 sm:px-4 md:px-0",
                "pb-2 md:pb-0 mb-3 md:mb-0",
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Icon
                    icon={Search}
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                    }}
                    placeholder={translate(
                      "lago.customer_list.search_placeholder",
                    )}
                    className="pl-9"
                  />
                </div>
                {/* Brief 53 §2b (17. sep 2026): under 768 px er sortering en
                44 px ikonknap ⇅ ved siden af søgefeltet — rullelisten
                fyldte en hel linje for at sige noget man sjældent
                ændrer. Prik når sortMode afviger fra standard. Fra
                768 px står rullelisten som før. */}
                <SortMobileTrigger
                  current={sortMode}
                  onSelect={(v) => {
                    setSortMode(v);
                  }}
                />
                <Select
                  value={sortMode}
                  onValueChange={(v) => {
                    setSortMode(v as SortMode);
                  }}
                >
                  <SelectTrigger className="hidden md:flex md:w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">
                      {translate("lago.customer_list.sort.name")}
                    </SelectItem>
                    <SelectItem value="priority">
                      {translate("lago.customer_list.sort.priority")}
                    </SelectItem>
                    <SelectItem value="last_visit">
                      {translate("lago.customer_list.sort.last_visit")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Brief 50 §1 (17. sep 2026): filterbjælke som viser hvad
              der er valgt frem for bare "Filtre". Man kan se filteret
              uden at åbne det. Kun < 1280 px — XL viser skinnen selv. */}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((v) => !v)}
                className="flex w-full items-center gap-3 rounded-[var(--r-2)] bg-[var(--surface-1)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)] xl:hidden md:mb-3"
              >
                <Icon
                  icon={SlidersHorizontal}
                  size="sm"
                  className="shrink-0 text-[var(--fg-2)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[length:var(--t-sec)] font-medium text-[var(--fg)]">
                    {summariseActiveFilters({
                      selectedSegment,
                      selectedVisitStatus,
                      selectedDistrikter,
                      selectedSalesNames,
                      onlyMine,
                      showInactive,
                      showLeads,
                    })}
                  </p>
                  <p className="text-[length:var(--t-meta)] text-[var(--fg-3)]">
                    Tryk for at tilpasse visning
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[length:var(--t-meta)] text-[var(--fg-2)]">
                  {mobileFiltersOpen ? "Skjul" : "Tilpas"}
                  <Icon
                    icon={ChevronDown}
                    size="sm"
                    className={cn(
                      "transition-transform",
                      mobileFiltersOpen && "rotate-180",
                    )}
                  />
                </span>
              </button>
            </div>
            {/* / brief 54 §2c sticky wrapper — filter-ekspanderen står
              UNDER så den ikke er sticky, kun søgefelt+sortér+bjælken. */}

            {mobileFiltersOpen && (
              <div className="mb-3 rounded-[var(--r-2)] bg-[var(--surface-1)] p-4 xl:hidden">
                <FilterSidebar {...filterSidebarProps} />
              </div>
            )}

            {query.isLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                <Icon icon={Loader2} className="animate-spin" />
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
              <>
                {/* Brief 50 §1 (17. sep 2026): mobil = hvide kort med
                  8 px mellemrum, ingen tabel-header. Laptop = tabel
                  med sticky header + skillelinjer mellem rækker.
                  CustomerRow selv holder styr på begge udseender. */}
                <div className="flex flex-col gap-2 md:block md:gap-0 md:border-t md:border-[var(--line)]">
                  <CustomerRowHeader />
                  {visibleRows.map((row) => (
                    <CustomerRow
                      key={row.id}
                      row={row}
                      selected={row.id === selectedId}
                      onSelect={handleSelect}
                      emphasisePriority={emphasisePriority}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {hasSideRail && (
            <aside>
              <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
                <CustomerPreview
                  companyId={selectedId}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            </aside>
          )}
        </div>

        {!hasSideRail && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            {/* Brief 53 §1 (17. sep 2026): SheetHeader+SheetTitle fjernet
              og Sheet's indbyggede auto-close skjult via
              [&>button.absolute]:hidden. CustomerPreview's sticky
              topbjælke ér headeren — titel, primær handling, ✕.
              Uden det havde arket to headere og to ✕. */}
            <SheetContent
              side="bottom"
              className="max-h-[85vh] overflow-y-auto p-0 [&>button.absolute]:hidden"
            >
              <SheetTitle className="sr-only">
                {translate("lago.customer_list.preview.bottom_sheet_label")}
              </SheetTitle>
              <CustomerPreview
                companyId={selectedId}
                onClose={() => setSheetOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </LagoPullToRefresh>
  );
}

// Brief 55 §2 (17. sep 2026): PaginationBar er slettet — alle rækker
// vises. Tællingen er allerede i listetoppen ("259 kunder · 158 trænger
// til besøg · 2 snart") og duplikerede sidefoden.
