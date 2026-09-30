// Domain-brief 28 · Sales YTD på kundekortet.
//
// Læser sales_monthly_lago for én kunde og bygger fire ærlige tal:
// ÅTD i år, ÅTD sidste år, vækst i kroner, vækst i procent.
//
// Perioderne sammenlignes altid FRA-TIL — hvis vi er i september,
// er "sidste år" jan-sep 2024, ikke hele 2024. Det er den fælde,
// briefen kalder "lettest at lave og sværest at opdage" (og som
// vi ramte i dag: 16.745.076 kr. blev læst som T12M).
//
// Tre tilstande drives af den samme hook:
//   - Har omsætning i begge perioder → fire tal
//   - Ingen sidste år, noget i år    → beløb + "ny omsætning"
//   - Ingen omsætning nogensinde     → "Ingen omsætning registreret"
// (Alle andre kombinationer viser fire tal — vækst% kan være negativ.)

import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

export type SalesYtdKind =
  | "both_periods"
  | "new_this_year"
  | "no_revenue_ever"
  | "silent_this_year";

export interface SalesYtd {
  currentYear: number;
  lastYear: number;
  /** Højeste måned der tælles med (1–12). Fanger perioden — "jan–sep". */
  throughMonth: number;
  ytdThisYear: number;
  ytdLastYear: number;
  growthKr: number;
  /** Fraktion (0.05 = +5%). Null når sidste år = 0 (ingen basis). */
  growthPct: number | null;
  kind: SalesYtdKind;
  /** Kunden findes i sales_monthly_lago (uanset periode). Adskiller
   *  "ingen omsætning nogensinde" fra "ingen omsætning i ÅTD men
   *  historisk aktivitet". */
  hasAnyHistoricRevenue: boolean;
}

async function fetchSalesYtd(vismaCustomerNo: string): Promise<SalesYtd> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const throughMonth = now.getMonth() + 1;
  const lastYear = currentYear - 1;

  // §28a (30. sep 2026): server-side aggregation via RPC. The old
  // client-side approach fetched up to 1.022 rows per customer and hit
  // PostgREST's 1.000-row limit — Dalum lost 38.644 kr. silently.
  // The RPC returns three numbers in one call, no row limit.
  const { data, error } = await supabase.rpc("sales_ytd_for_customer", {
    p_customer_no: vismaCustomerNo,
    p_current_year: currentYear,
    p_last_year: lastYear,
    p_through_month: throughMonth,
  });
  if (error) throw error;

  const result = data as {
    ytd_this_year: number;
    ytd_last_year: number;
    has_any_history: boolean;
  };
  const ytdThisYear = Number(result.ytd_this_year) || 0;
  const ytdLastYear = Number(result.ytd_last_year) || 0;

  const growthKr = ytdThisYear - ytdLastYear;
  const growthPct = ytdLastYear > 0 ? growthKr / ytdLastYear : null;
  const hasAnyHistoricRevenue = result.has_any_history;

  let kind: SalesYtdKind;
  if (!hasAnyHistoricRevenue) {
    // Kunden har aldrig haft en faktura i systemet.
    kind = "no_revenue_ever";
  } else if (ytdLastYear === 0 && ytdThisYear > 0) {
    // Ny omsætning i år — briefen kræver at vi IKKE viser ∞% eller 100%.
    kind = "new_this_year";
  } else if (ytdLastYear === 0 && ytdThisYear === 0) {
    // Havde historik, men er stille i begge ÅTD-perioder.
    kind = "silent_this_year";
  } else {
    // Standard: fire tal.
    kind = "both_periods";
  }

  return {
    currentYear,
    lastYear,
    throughMonth,
    ytdThisYear,
    ytdLastYear,
    growthKr,
    growthPct,
    kind,
    hasAnyHistoricRevenue,
  };
}

export function useSalesYtd(vismaCustomerNo: string | null | undefined) {
  return useQuery({
    queryKey: ["lago-sales-ytd", vismaCustomerNo],
    queryFn: () => fetchSalesYtd(vismaCustomerNo!),
    enabled: !!vismaCustomerNo,
    staleTime: 5 * 60_000,
  });
}

const monthShort = new Intl.DateTimeFormat("da-DK", { month: "short" });

/** "jan–sep" for throughMonth=9. Bruges i UI-label så perioden
 *  altid står ved siden af tallet — et tal uden en periode er ikke
 *  et tal man kan handle på (brief 28 §1). */
export function formatYtdPeriod(throughMonth: number): string {
  const start = monthShort.format(new Date(2000, 0, 1));
  const end = monthShort.format(new Date(2000, throughMonth - 1, 1));
  return `${start.replace(".", "")}–${end.replace(".", "")}`;
}
