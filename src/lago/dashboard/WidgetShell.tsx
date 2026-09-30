import { AlertCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";

import { Icon } from "@/lago/ui/Icon";
import { Panel } from "@/lago/ui/Panel";
import { getAppVersion } from "@/lago/layout/useAppVersion";
import { readErrorMessage } from "@/lago/ui/errorMessage";
import { cn } from "@/lib/utils";

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
 * Flader (brief 90 opfølgning · 29. sep 2026): shell'en pakker sit
 * INDHOLD i et hvidt Panel-kort på beige. Overskrift + underlinje står
 * uden for panelet så titel og undertekst hviler på siden — kun det man
 * handler på får flade. Tomme tilstande, tabeller, lister — alle får
 * samme kort. Én sektion = ét kort. Widgets der selv laver Panel-wrap
 * indeni sætter `noPanel` for at undgå dobbelt padding.
 *
 * Historisk (før 29. sep) havde shell'en ingen ramme, og de widgets der
 * ikke selv brugte Panel flød sammen med siden. Efter fladbytte-brief 85
 * blev Panel hvidt på beige; de widgets uden Panel skilte sig ikke ud.
 */
export function WidgetShell({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel,
  isLoading,
  error,
  errorMessage,
  isEmpty,
  emptyState,
  children,
  className,
  count,
  headerExtra,
  noPanel,
}: WidgetShellProps) {
  // Brief 55 tillæg A (17. sep 2026): teknikken hører i konsollen —
  // brugeren skal ikke se "e.data.map is not a function" med
  // variabelnavne. Widget'en kan overskrive standardteksten via
  // errorMessage-prop.
  if (error) {
    console.error(`[${typeof title === "string" ? title : "widget"}]`, error);
  }
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
          {/* Brief 85 §0 (28. sep 2026): sektionsnumrene udgår. De var
              et greb fra brief 34, men med 1+3 i hovedspalten og 2+4
              i skinnen gav de mere skade end gavn — nummeret sagde én
              rækkefølge, layoutet en anden. */}
          <h2 className="text-base font-bold text-[var(--fg)]">{title}</h2>
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
          {/* Brief 85 §16 tillæg (28. sep 2026): widgetens egne
              header-handlinger (fx "+ Ny opgave") ligger over Se alle,
              så primær handling er øverst i topbjælken. */}
          {headerExtra}
          {seeAllHref && (
            <Link
              to={seeAllHref}
              className="text-[var(--fg-2)] inline-flex items-center gap-0.5 text-[13px] font-medium no-underline hover:underline"
            >
              {seeAllLabel ?? "Se alle"}
              <Icon icon={ChevronRight} size="sm" />
            </Link>
          )}
        </div>
      </header>
      {(() => {
        // Brief 90 opfølgning (29. sep 2026): tomme tilstande, error og
        // loading skal ALTID have Panel-flade — også når widget'en
        // ellers har noPanel=true. En tom sektion er stadig en sektion.
        // noPanel gælder KUN den fyldte tilstand (widget'ens egen
        // Panel-wrap tager over der).
        if (error) {
          const errBody = (
            <div className="text-[var(--st-red-fg)] flex items-start gap-2 text-sm">
              <Icon icon={AlertCircle} size="sm" className="mt-0.5" />
              <div className="text-[var(--fg-2)]">
                {errorMessage ?? "Kunne ikke hente data. Prøv at genindlæse."}
                <div className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[length:var(--t-meta)] text-[var(--fg-3)]">
                  {readErrorMessage(error)}
                </div>
                <div className="mt-0.5 font-mono text-[length:var(--t-meta)] text-[var(--fg-3)]">
                  Version: {getAppVersion()}
                </div>
              </div>
            </div>
          );
          return <Panel>{errBody}</Panel>;
        }
        if (isLoading) {
          return (
            <Panel>
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </Panel>
          );
        }
        if (isEmpty && emptyState) {
          return (
            <Panel>
              <div className="text-[var(--fg-2)] text-sm">{emptyState}</div>
            </Panel>
          );
        }
        // Fyldt tilstand: widget'ens egen Panel-wrap tager over hvis
        // noPanel=true; ellers pakker WidgetShell selv.
        return noPanel ? <div>{children}</div> : <Panel>{children}</Panel>;
      })()}
    </section>
  );
}
