import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Icon } from "@/lago/ui/Icon";

import { FeltFilterPanel, type DistriktSalesProps } from "./FeltFilterPanel";
import {
  countActiveFeltFilters,
  type FeltFilterCounts,
  type FeltFilters,
} from "./filters";

interface Props {
  filters: FeltFilters;
  onFiltersChange: (f: FeltFilters) => void;
  counts: FeltFilterCounts;
  hasMySalesId: boolean;
  showPlannedToday?: boolean;
  /** Ekstra content over panelet — fx distrikt Select på kort. */
  extras?: React.ReactNode;
  /** Brief 23 pkt 1: skærmens udgangspunkt (Dagens' onlyMine=true).
   *  Forwardes til FeltFilterPanel så "Ryd filtre" rammer det rigtige. */
  clearTo?: FeltFilters;
  /** Brief 23 pkt 3: distrikt/sælger som egne grupper i panelet.
   *  Badge-tælleren inkluderer dem ogsaa. */
  distriktSales?: DistriktSalesProps;
  className?: string;
}

/**
 * Brief 16: mobile "Filtre"-knap → bottom-sheet med hele det delte
 * FeltFilterPanel lodret. Bruges under `md:hidden`-breakpointet på både
 * Dagens og Kort så den vandrette panel-strip (og kortets sidepanel) ikke
 * længere presses på iPhone-bredde.
 */
export function MobileFilterButton({
  filters,
  onFiltersChange,
  counts,
  hasMySalesId,
  showPlannedToday,
  extras,
  clearTo,
  distriktSales,
  className,
}: Props) {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  // Brief 23 pkt 3: distrikt/sælger tælles som aktive filtre i badgen
  // (én pr. akse hvis ikke ALL_SENTINEL), saa "Filtre 3"-badge afspejler
  // hele filter-summen, ikke bare fluebens-grupperne.
  const distriktSalesActive =
    (distriktSales && distriktSales.distriktValue !== "__all__" ? 1 : 0) +
    (distriktSales && distriktSales.salesValue !== "__all__" ? 1 : 0);
  const activeCount = countActiveFeltFilters(filters) + distriktSalesActive;

  return (
    <>
      <Button
        type="button"
        variant={activeCount > 0 ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("h-9 gap-2", className)}
      >
        <Icon icon={SlidersHorizontal} size="sm" />
        <span>{translate("lago.felt.filters.mobile_button")}</span>
        {activeCount > 0 && (
          <span
            className={cn(
              "tabular-nums rounded-full px-1.5 py-px text-sm font-bold",
              "bg-background text-foreground",
            )}
          >
            {activeCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-xl"
        >
          <SheetHeader className="pb-2">
            <SheetTitle>
              {translate("lago.felt.filters.mobile_sheet_title")}
            </SheetTitle>
          </SheetHeader>
          {extras && <div className="mb-4">{extras}</div>}
          <FeltFilterPanel
            filters={filters}
            onFiltersChange={onFiltersChange}
            counts={counts}
            hasMySalesId={hasMySalesId}
            layout="vertical"
            showPlannedToday={showPlannedToday}
            clearTo={clearTo}
            distriktSales={distriktSales}
          />
          <div className="sticky bottom-0 -mx-6 mt-4 border-t bg-background px-6 pb-2 pt-3">
            <Button
              className="w-full"
              onClick={() => setOpen(false)}
            >
              {translate("lago.felt.filters.mobile_apply")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
