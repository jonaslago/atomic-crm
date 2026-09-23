import { ErrorBoundary } from "react-error-boundary";

import { Skeleton } from "@/components/ui/skeleton";

import { useCurrentLagoRole } from "@/lago/auth/useCurrentLagoRole";
import { cn } from "@/lib/utils";

import { ROLE_LAYOUTS } from "./roleLayouts";
import { SectionNumberContext } from "./sectionNumberContext";
import { WidgetShell } from "./WidgetShell";

// Brief 81 bølge 2 (23. sep 2026) · build-marker der garanterer at
// content-hash ændrer sig — Tailwind-classer var allerede scannet fra
// tidligere build, så gap-y-6 og hidden @[768px]:block gav ikke ny
// bundle-hash. Uden ny hash fyrer opdaterings-striben ikke, og Jonas
// kan ikke vide om han ser bølge 2 eller det gamle bundle.
const BUILD_MARKER_BRIEF_81_BOELGE_2 = "2026-09-23-kompakthed";
void BUILD_MARKER_BRIEF_81_BOELGE_2;
import { WIDGETS } from "./widgetRegistry";
import type { WidgetWidth } from "./widgetTypes";

/**
 * DashboardGrid (Domain-brief 34 §5 + brief 38 §7 · 16. sep 2026).
 *
 * Sælgeren har fire sektioner, og de tre første er lister — de hører
 * under hinanden i én hovedspalte, ikke ved siden af hinanden. En
 * tidligere version prøvede at løse det med `col-span-8`/`col-span-4`
 * som søskende i ét 12-kolonners gitter; det gav præcis det tomme
 * højre-halvdel-mønster, brief 38 §7 fangede: tre 8-kol-elementer i
 * træk lagde sig i tre rækker med intet ved siden af, og skinnen
 * havnede nederst.
 *
 * Rigtige model (også Stitchs): to beholdere, hver med sin egen stak.
 *
 *   Sælger (≥ 1280 px)
 *     [ 1 · Hvem skal jeg besøge i dag  ]  [ 4 · Hvordan ligger jeg denne uge ]
 *     [ 2 · Hvem er jeg bagud med       ]
 *     [ 3 · Hvad lovede jeg sidst       ]
 *      ↑ hovedspalte (col-span-8)          ↑ skinne (col-span-4)
 *      hver flex-col med gap-10
 *
 *   Sælger (< 1280 px): alt stablet i én spalte — samme rækkefølge.
 *
 *   Kontor + admin: uændret 1 / 2 / 3-trins-gitter (brief 34 §5).
 *   Deres sektioner er ikke uge-opgørelse + arbejdslister, så samme
 *   "tom-kolonne"-problem opstår ikke der. Admin ser desuden både
 *   sælger- og kontor-flowet, hvor 8/4-modellen ikke ville rumme
 *   otte sektioner uden at kollapse.
 *
 * En widget-fejl bringer ikke resten ned — hver widget wrappes i
 * ErrorBoundary.
 */

const WIDTH_CLASS: Record<WidgetWidth, string> = {
  narrow: "@[768px]:col-span-1",
  wide: "@[768px]:col-span-2 @[1280px]:col-span-2",
  full: "@[768px]:col-span-2 @[1280px]:col-span-3",
};

export function DashboardGrid() {
  const { role, isLoading } = useCurrentLagoRole();

  if (isLoading) {
    return (
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const ids = ROLE_LAYOUTS[role] ?? [];
  const numbered = role === "saelger";

  if (role === "saelger") {
    // Første tre sektioner i hovedspalten, resten (typisk sektion 4)
    // i skinnen. Hver spalte er sin egen flex-col så en tom sektion i
    // hovedspalten skubber blot den næste op — den tvinger ikke
    // skinnens højde.
    const mainIds = ids.slice(0, 3);
    const railIds = ids.slice(3);
    const renderSection = (id: string, index: number) => {
      const def = WIDGETS[id];
      if (!def) return null;
      const WidgetComponent = def.component;
      const sectionNumber = numbered ? index + 1 : undefined;
      return (
        <div key={id} className="min-w-0">
          <ErrorBoundary
            fallbackRender={({ error }) => (
              <WidgetShell
                title={def.title}
                subtitle={def.subtitle}
                seeAllHref={def.seeAllHref}
                error={error as Error}
                sectionNumber={sectionNumber}
              />
            )}
          >
            <SectionNumberContext.Provider value={sectionNumber}>
              <WidgetComponent />
            </SectionNumberContext.Provider>
          </ErrorBoundary>
        </div>
      );
    };
    return (
      <div className="@container">
        {/* Brief 81 §2 (23. sep 2026): 24 px mellemrum under 768 px,
            40 px derover. Sektionerne har hverken ramme eller baggrund,
            så luften er adskillelsen — 40 px hele vejen gav 120 px ren
            luft på mobil før noget stod. */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 @[768px]:gap-y-10 @[1280px]:grid-cols-12 @[1280px]:items-start">
          <div className="flex flex-col gap-6 @[768px]:gap-10 @[1280px]:col-span-8">
            {mainIds.map((id, i) => renderSection(id, i))}
          </div>
          <div className="flex flex-col gap-6 @[768px]:gap-10 @[1280px]:col-span-4">
            {railIds.map((id, i) => renderSection(id, i + mainIds.length))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="@container">
      <div
        className={cn(
          // Brief 81 §2 (23. sep 2026): 24 px under 768, 40 px derover.
          "grid grid-cols-1 gap-y-6 gap-x-8 @[768px]:gap-y-10",
          "@[768px]:grid-cols-2",
          "@[1280px]:grid-cols-3",
        )}
      >
        {ids.map((id, index) => {
          const def = WIDGETS[id];
          if (!def) return null;
          const WidgetComponent = def.component;
          const sectionNumber = numbered ? index + 1 : undefined;
          return (
            <div key={id} className={cn("min-w-0", WIDTH_CLASS[def.width])}>
              <ErrorBoundary
                fallbackRender={({ error }) => (
                  <WidgetShell
                    title={def.title}
                    subtitle={def.subtitle}
                    seeAllHref={def.seeAllHref}
                    error={error as Error}
                    sectionNumber={sectionNumber}
                  />
                )}
              >
                <SectionNumberContext.Provider value={sectionNumber}>
                  <WidgetComponent />
                </SectionNumberContext.Provider>
              </ErrorBoundary>
            </div>
          );
        })}
      </div>
    </div>
  );
}
