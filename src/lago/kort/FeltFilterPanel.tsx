import { X } from "lucide-react";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Icon } from "@/lago/ui/Icon";

import {
  ALL_CLASSIFIED_SEGMENTS,
  ALL_VISIT_GROUPS,
  defaultFeltFilters,
  feltFiltersEqual,
  isDefaultFeltFilters,
  type ClassifiedSegment,
  type FeltFilterCounts,
  type FeltFilters,
  type VisitGroup,
} from "./filters";

/**
 * Brief 23 pkt 3: distrikt og sælger som selects INDE i panelet, ikke
 * som separate header-kontroller. Én filter-akse, ét sted. Sender vi
 * ikke listerne (distrikter/sales tomme), rendres sektionen ikke —
 * Kort og Søg beholder deres eget nuværende layout.
 */
const ALL_SENTINEL = "__all__";

export interface DistriktSalesProps {
  distriktValue: string; // ALL_SENTINEL = alle
  distrikter: string[];
  onDistriktChange: (v: string) => void;
  salesValue: string; // ALL_SENTINEL = alle
  salesNames: string[];
  onSalesChange: (v: string) => void;
}

interface Props {
  filters: FeltFilters;
  onFiltersChange: (f: FeltFilters) => void;
  counts: FeltFilterCounts;
  hasMySalesId: boolean;
  layout?: "vertical" | "horizontal";
  /**
   * Dagens-specifik: render "Planlagt i dag"-chippen ved siden af
   * "Planlagte"-linsen. Kortet skjuler den — den passer kun til
   * "I dag"-rammen.
   */
  showPlannedToday?: boolean;
  /**
   * Brief 23 pkt 1: "Ryd filtre" skal føre tilbage til skærmens EGEN
   * udgangspunkt — Dagens vil have onlyMine=true, Kort/Søg onlyMine=false.
   * Uden dette prop bruges det globale defaultFeltFilters()
   * (bagud-kompatibelt for Kort/Søg som allerede kalder uden opts).
   */
  clearTo?: FeltFilters;
  /** Brief 23 pkt 3: valgfri distrikt/sælger-selects som egne grupper.
   *  Kort/Søg lader vaere med at sende dem. Ryd-knappen resetter dem
   *  ogsaa (til ALL_SENTINEL). */
  distriktSales?: DistriktSalesProps;
}

export { ALL_SENTINEL };

/**
 * Brief 14 (addendum 2): panelet er identisk på kort og Dagens. Én
 * regel — tomt i en gruppe = vis alle; hvert flueben snævrer ind.
 * Grupper: Linser (OR) · Besøg (OR) · Segment A/B/C/X (OR) · Vis også
 * (Leads · Inaktive — utvider basen). Alle counts er kontekst-følsomme.
 */
export function FeltFilterPanel({
  filters,
  onFiltersChange,
  counts,
  hasMySalesId,
  layout = "vertical",
  showPlannedToday = false,
  clearTo,
  distriktSales,
}: Props) {
  const translate = useTranslate();

  const setOnlyMine = (v: boolean) =>
    onFiltersChange({ ...filters, onlyMine: v });
  const setNeverVisited = (v: boolean) =>
    onFiltersChange({ ...filters, neverVisited: v });
  const setPlanned = (v: boolean) =>
    onFiltersChange({ ...filters, planned: v });
  const setPlannedToday = (v: boolean) =>
    onFiltersChange({ ...filters, plannedToday: v });
  const setShowLeads = (v: boolean) =>
    onFiltersChange({ ...filters, showLeads: v });
  const setShowInactive = (v: boolean) =>
    onFiltersChange({ ...filters, showInactive: v });
  const toggleSegment = (s: ClassifiedSegment) => {
    const next = new Set(filters.segments);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onFiltersChange({ ...filters, segments: next });
  };
  const toggleVisitStatus = (g: VisitGroup) => {
    const next = new Set(filters.visitStatuses);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    onFiltersChange({ ...filters, visitStatuses: next });
  };
  const clearAll = () => {
    onFiltersChange(clearTo ?? defaultFeltFilters());
    // Brief 23 pkt 3: Ryd omfatter ogsaa distrikt/sælger — det er
    // filtre paa lige fod med resten.
    if (distriktSales) {
      distriktSales.onDistriktChange(ALL_SENTINEL);
      distriktSales.onSalesChange(ALL_SENTINEL);
    }
  };

  const visitGroupLabel: Record<VisitGroup, string> = {
    must_visit: translate("lago.felt.filters.visit.must_visit"),
    soon: translate("lago.felt.filters.visit.soon"),
    on_plan: translate("lago.felt.filters.visit.on_plan"),
    no_urgency: translate("lago.felt.filters.visit.no_urgency"),
  };
  // Brief 33 §4: swatch-farver peger på status-tokens som CSS-var.
  // Værdien bruges i inline `background: <swatch>` og understøtter
  // CSS-var direkte, så en ændring i tokens.css slår igennem.
  const visitGroupSwatch: Record<VisitGroup, string> = {
    must_visit: "var(--st-red)",
    soon: "var(--st-amber)",
    on_plan: "var(--st-green)",
    no_urgency: "var(--fg-3)",
  };

  // Ryd-knap er aktiv naar de nuvaerende filtre AFVIGER fra skaermens
  // udgangspunkt (clearTo), ikke fra det globale default. Ellers ville
  // Dagens' Ryd-knap staa aktiv paa "fresh load" fordi onlyMine=true !=
  // global default.
  const distriktSalesActive = !!distriktSales && (
    distriktSales.distriktValue !== ALL_SENTINEL ||
    distriktSales.salesValue !== ALL_SENTINEL
  );
  const canClear =
    (clearTo
      ? !feltFiltersEqual(filters, clearTo)
      : !isDefaultFeltFilters(filters)) ||
    distriktSalesActive;

  return (
    <div
      className={cn(
        layout === "vertical"
          ? "flex flex-col gap-4"
          : "flex flex-wrap items-start gap-x-4 gap-y-2",
      )}
    >
      {/* Brief 23 pkt 5: én sætning der forklarer at tallene er
          "hvor mange kommer til hvis du vælger dette", ikke absolutte
          matches. Diskret --fg-3 saa det ikke stjaeler opmarksomhed. */}
      {layout === "vertical" && (
        <p className="text-sm text-[var(--fg-3)]">
          {translate("lago.felt.filters.counts_hint")}
        </p>
      )}

      <Section title={translate("lago.felt.filters.group_lenses")} layout={layout}>
        <CheckRow
          label={translate("lago.customer_list.filter_mine")}
          checked={filters.onlyMine}
          onChange={setOnlyMine}
          count={counts.onlyMine}
          disabled={!hasMySalesId}
          layout={layout}
        />
        <CheckRow
          label={translate("lago.customer_list.filter_visit_never")}
          checked={filters.neverVisited}
          onChange={setNeverVisited}
          count={counts.neverVisited}
          layout={layout}
        />
        <CheckRow
          label={translate("lago.felt.filters.lenses.planned")}
          checked={filters.planned}
          onChange={setPlanned}
          count={counts.planned}
          layout={layout}
        />
        {showPlannedToday && (
          <CheckRow
            label={translate("lago.felt.filters.lenses.planned_today")}
            checked={filters.plannedToday}
            onChange={setPlannedToday}
            count={counts.plannedToday}
            layout={layout}
          />
        )}
      </Section>

      <Section title={translate("lago.felt.filters.group_visit")} layout={layout}>
        {ALL_VISIT_GROUPS.map((g) => (
          <CheckRow
            key={g}
            label={visitGroupLabel[g]}
            checked={filters.visitStatuses.has(g)}
            onChange={() => toggleVisitStatus(g)}
            count={counts.visitStatuses[g]}
            swatch={visitGroupSwatch[g]}
            layout={layout}
          />
        ))}
      </Section>

      <Section title={translate("lago.felt.filters.group_segment")} layout={layout}>
        {ALL_CLASSIFIED_SEGMENTS.map((s) => (
          <CheckRow
            key={s}
            label={s}
            checked={filters.segments.has(s)}
            onChange={() => toggleSegment(s)}
            count={counts.segments[s]}
            layout={layout}
          />
        ))}
      </Section>

      {/* Brief 23 pkt 3: distrikt + sælger som egne grupper i panelet.
          Kun render hvis caller sender listerne (Dagens gør; Kort/Søg
          har deres egne mønstre). Layout er vertical (panelet lever
          altid i bottom-sheet paa Dagens nu). */}
      {distriktSales && layout === "vertical" && (
        <>
          <Section title={translate("lago.felt.filters.group_district")} layout={layout}>
            <Select
              value={distriktSales.distriktValue}
              onValueChange={distriktSales.onDistriktChange}
            >
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>
                  {translate("lago.customer_list.filter_district_all")}
                </SelectItem>
                {distriktSales.distrikter.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>
          <Section title={translate("lago.felt.filters.group_sales")} layout={layout}>
            <Select
              value={distriktSales.salesValue}
              onValueChange={distriktSales.onSalesChange}
            >
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>
                  {translate("lago.customer_list.filter_sales_all")}
                </SelectItem>
                {distriktSales.salesNames.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>
        </>
      )}

      <Section
        title={translate("lago.felt.filters.group_show_also")}
        layout={layout}
      >
        <CheckRow
          label={translate("lago.felt.filters.show_also.leads")}
          checked={filters.showLeads}
          onChange={setShowLeads}
          count={counts.showLeads}
          layout={layout}
        />
        <CheckRow
          label={translate("lago.felt.filters.show_also.inactive")}
          checked={filters.showInactive}
          onChange={setShowInactive}
          count={counts.showInactive}
          layout={layout}
        />
      </Section>

      <div
        className={cn(
          layout === "vertical"
            ? "mt-1 flex flex-col gap-1"
            : "flex items-center gap-3",
        )}
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={clearAll}
          disabled={!canClear}
          className="h-7 self-start px-2 text-sm"
        >
          <Icon icon={X} size="sm" />
          {translate("lago.felt.filters.clear")}
        </Button>
        {/* Brief 23 pkt 7: filter-reglen skrevet ud, ved siden af
            "Ryd filtre". Uden dette hint staar OR-inde-ELLER-mellem-
            grupper-modellen kun i en kodekommentar. */}
        <p className="text-sm text-[var(--fg-3)]">
          {translate("lago.felt.filters.rule_hint")}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  layout,
  children,
}: {
  title: string;
  layout: "vertical" | "horizontal";
  children: React.ReactNode;
}) {
  if (layout === "vertical") {
    return (
      <div>
        <div className="text-muted-foreground mb-2 text-xs font-bold uppercase tracking-widest">
          {title}
        </div>
        <div className="flex flex-col gap-1.5 text-sm">{children}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted-foreground mr-1 text-xs font-bold uppercase tracking-widest">
        {title}
      </span>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  count,
  disabled,
  swatch,
  layout,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  count: number;
  disabled?: boolean;
  swatch?: string;
  layout: "vertical" | "horizontal";
}) {
  if (layout === "vertical") {
    return (
      <label
        className={cn(
          "flex cursor-pointer items-center gap-2",
          disabled && "text-muted-foreground cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {swatch && (
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full ring-1 ring-white"
            style={{ background: swatch }}
          />
        )}
        <span className="flex-1">{label}</span>
        <span className="text-muted-foreground tabular-nums text-sm">
          ({count})
        </span>
      </label>
    );
  }
  // Horizontal chip form for Dagens.
  // Brief 49 §2 (17. sep 2026): kapsel-chip er væk. 44 px trykmål,
  // radius 4 px (--r-2). Aktiv = --ink; inaktiv = --surface-3.
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 px-3 py-1 rounded-[var(--r-2)] text-[length:var(--t-sec)] font-medium transition-colors",
        checked
          ? "bg-[var(--ink)] text-white hover:bg-[var(--ink)]/90"
          : "bg-[var(--surface-3)] text-[var(--fg)] hover:bg-[var(--surface-3)]/80",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {swatch && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full ring-1 ring-white"
          style={{ background: swatch }}
        />
      )}
      <span>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          checked ? "" : "text-muted-foreground",
        )}
      >
        ({count})
      </span>
    </button>
  );
}
