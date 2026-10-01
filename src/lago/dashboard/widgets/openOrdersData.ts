import { paginatedFetch, type PaginatedResult } from "@/lago/ui/paginatedFetch";

/**
 * §97/§101-3 (1. okt 2026): paginated read of open_orders_effective_lago.
 * Returns rows + truncated flag. Widgets must check truncated before
 * computing totals.
 */

export interface EffectiveLine {
  ordre_nr: string;
  ordre_dato: string;
  ej_faktureret: number;
  status: string | null;
  lagerstatus_effective: string | null;
  levering: string | null;
  mav: boolean | null;
  har_oensket_dato: boolean | null;
  er_par_komponent: boolean | null;
  antal: number | null;
  produktnr: string | null;
}

export async function fetchAllEffectiveLines(): Promise<
  PaginatedResult<EffectiveLine>
> {
  return paginatedFetch<EffectiveLine>({
    table: "open_orders_effective_lago",
    select:
      "ordre_nr, ordre_dato, ej_faktureret, status, lagerstatus_effective, levering, mav, har_oensket_dato, er_par_komponent, antal, produktnr",
  });
}
