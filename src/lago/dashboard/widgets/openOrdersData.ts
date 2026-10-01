import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * §97 fix (1. okt 2026): paginated read of open_orders_effective_lago.
 *
 * PostgREST has a 1.000-row default limit. The view has 1.500+ rows.
 * Without pagination, widgets silently show 64% of the real total.
 * A wrong number on a leadership dashboard is worse than no number.
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
}

const PAGE_SIZE = 1000;

export async function fetchAllEffectiveLines(): Promise<EffectiveLine[]> {
  const supabase = getSupabaseClient();
  const all: EffectiveLine[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("open_orders_effective_lago")
      .select(
        "ordre_nr, ordre_dato, ej_faktureret, status, lagerstatus_effective, levering, mav, har_oensket_dato, er_par_komponent, antal",
      )
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as EffectiveLine[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
