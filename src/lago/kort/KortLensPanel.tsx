import { Compass } from "lucide-react";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Icon } from "@/lago/ui/Icon";
import { FeltFilterPanel } from "./FeltFilterPanel";
import type { FeltFilterCounts, FeltFilters } from "./filters";

interface Props {
  filters: FeltFilters;
  onFiltersChange: (f: FeltFilters) => void;
  counts: FeltFilterCounts;
  distinctDistrikter: string[];
  distrikt: string | null;
  onDistriktChange: (d: string | null) => void;
  /**
   * Brief 17 (Nær mig-forenkling): ren recenter-handling — ingen toggle,
   * ingen aktiv-tilstand. Trykker sælger, hopper kortet til hans område.
   */
  onRecenterToMe: () => void;
  hasMySalesId: boolean;
  /**
   * Brief 17: antal kunder der ikke kunne geokodes. Vises som lille
   * dæmpet note nederst i panelet — flyttet fra det permanente
   * overlay øverst på kortet, så flad'en står renere.
   */
  geocodeMissingCount?: number;
}

const ALL = "__all__";

/**
 * Kortets venstre panel — indeholder det fælles FeltFilterPanel
 * (brief 14 rev 2) plus de kort-specifikke kontroller (distrikt +
 * Nær mig). Dagens bruger samme FeltFilterPanel med layout="horizontal".
 */
export function KortLensPanel({
  filters,
  onFiltersChange,
  counts,
  distinctDistrikter,
  distrikt,
  onDistriktChange,
  onRecenterToMe,
  hasMySalesId,
  geocodeMissingCount = 0,
}: Props) {
  const translate = useTranslate();

  return (
    <div className="flex flex-col gap-4 p-3">
      <FeltFilterPanel
        filters={filters}
        onFiltersChange={onFiltersChange}
        counts={counts}
        hasMySalesId={hasMySalesId}
        layout="vertical"
      />

      <div>
        <div className="text-muted-foreground mb-1 text-xs font-bold uppercase tracking-widest">
          {translate("lago.customer_list.filter_district_label")}
        </div>
        <Select
          value={distrikt ?? ALL}
          onValueChange={(v) => onDistriktChange(v === ALL ? null : v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {translate("lago.customer_list.filter_district_all")}
            </SelectItem>
            {distinctDistrikter.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={onRecenterToMe}
        variant="outline"
        className="h-9 justify-start gap-2 text-sm"
      >
        <Icon icon={Compass} />
        {translate("lago.felt.kort.near_me")}
      </Button>

      {geocodeMissingCount > 0 && (
        <p className="text-muted-foreground mt-auto text-sm leading-relaxed">
          {translate("lago.felt.kort.no_coords_hint", {
            smart_count: geocodeMissingCount,
            missing: geocodeMissingCount,
          })}
        </p>
      )}
    </div>
  );
}
