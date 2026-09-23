import { AlertCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";

import { Icon } from "@/lago/ui/Icon";
import { getAppVersion } from "@/lago/layout/useAppVersion";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { cn } from "@/lib/utils";

import { useSectionNumber } from "./sectionNumberContext";
import type { WidgetShellProps } from "./widgetTypes";

/**
 * Fælles shell for alle dashboard-widgets (Domain-brief 34 + tillæg A).
 *
 * En widget er en SEKTION. Overskriften har fire dele:
 *
 *   [nummer]  Titel — spørgsmål         [tælling m. status-tone]
 *             Underlinje — sortering              [Se alle N →]
 *
 *   - Nummeret vises på ALLE bredder (tillæg A §4) i --fg-3.
 *   - Tællingen vises fra 768 px og op i --fg-2, men får rød/gul tone
 *     når indholdet er alvorligt ("2 kunder overskredet" i --st-red-fg).
 *   - Underlinjen (subtitle) er PÅKRÆVET — ingen widget uden forklaring.
 *   - "Se alle" er neutral --fg-2, ikke --a-deep (som efter v3 er sort
 *     og konkurrerer med overskriften).
 *
 * Flader: shell'en selv har INGEN ramme og INGEN baggrund — sektionen
 * ligger på siden. Rækker bruger --surface-1 (brief 34 §0), og indstik
 * INDE i en række bruger --surface. Adskillelse er fladeforskel, ikke
 * kanter.
 */
export function WidgetShell({
  title,
  subtitle,
  seeAllHref,
  isLoading,
  error,
  errorMessage,
  isEmpty,
  emptyState,
  children,
  className,
  sectionNumber,
  count,
}: WidgetShellProps) {
  // Brief 55 tillæg A (17. sep 2026): teknikken hører i konsollen —
  // brugeren skal ikke se "e.data.map is not a function" med
  // variabelnavne. Widget'en kan overskrive standardteksten via
  // errorMessage-prop.
  if (error) {
    console.error(`[${typeof title === "string" ? title : "widget"}]`, error);
  }
  // Widgets kalder <WidgetShell title="..." subtitle="..."/> uden at
  // sende sectionNumber. DashboardGrid injicerer det via context.
  const numberFromContext = useSectionNumber();
  const effectiveNumber = sectionNumber ?? numberFromContext;
  const countToneClass =
    count?.tone === "red"
      ? "text-[var(--st-red-fg)]"
      : count?.tone === "amber"
        ? "text-[var(--st-amber-fg)]"
        : "text-[var(--fg-2)]";
  return (
    // Brief 36 §3: en tom sektion må ikke reservere en kolonne. Uden
    // h-full tager shell'en kun den plads dens indhold kræver, og
    // grid-cellen falder sammen om overskrift + tomtekst frem for at
    // efterlade 700 px hvidt under sig.
    <section className={cn("flex flex-col", className)}>
      <header className="mb-4 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {effectiveNumber != null && (
              <span className="tabular-nums text-[var(--fg-3)] text-base font-bold">
                {effectiveNumber}.
              </span>
            )}
            <h2 className="text-base font-bold text-[var(--fg)]">{title}</h2>
          </div>
          {/* Brief 81 §3 (23. sep 2026): underlinjen skjules visuelt
              under 768 px. Bliver stående i DOM'en så skærmlæsere har
              den — kravet om at hver widget SKAL have en underlinje
              står ved magt. Fjernet visuelt hvor der ikke er plads. */}
          <p className="hidden @[768px]:block text-[var(--fg-2)] text-[13px] font-normal">
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {count && (
            <span
              className={cn(
                "hidden text-[13px] font-medium @[768px]:inline",
                countToneClass,
              )}
            >
              {count.label}
            </span>
          )}
          {seeAllHref && (
            <Link
              to={seeAllHref}
              className="text-[var(--fg-2)] inline-flex items-center gap-0.5 text-[13px] font-medium no-underline hover:underline"
            >
              Se alle
              <Icon icon={ChevronRight} size="sm" />
            </Link>
          )}
        </div>
      </header>
      <div>
        {error ? (
          <div className="text-[var(--st-red-fg)] flex items-start gap-2 text-sm">
            <Icon icon={AlertCircle} size="sm" className="mt-0.5" />
            <div className="text-[var(--fg-2)]">
              {errorMessage ?? "Kunne ikke hente data. Prøv at genindlæse."}
              {/* Brief 71 §1 (21. sep 2026): PostgREST-koden, tabel og
                  indlejring vises altid — også når widget'en har en
                  egen kort besked. En PGRST201 om ambiguous embed ligner
                  en tom liste ellers; nu står koden, tabellen og
                  indlejringen der. Fold væk i mono/fg-3 så den ikke
                  skriger, men er der som skærmbillede-bevis. */}
              <div className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[length:var(--t-meta)] text-[var(--fg-3)]">
                {readErrorMessage(error)}
              </div>
              {/* Brief 57 §0c: version følger med i fejlbesked, så et
                  skærmbillede fra en sælger bærer bundlen med. */}
              <div className="mt-0.5 font-mono text-[length:var(--t-meta)] text-[var(--fg-3)]">
                Version: {getAppVersion()}
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : isEmpty && emptyState ? (
          <div className="text-[var(--fg-2)] text-sm">{emptyState}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
