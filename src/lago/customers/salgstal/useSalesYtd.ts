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

  // Hent ÅTD-relevante rækker for begge år i én query. Alle salgstyper
  // (FRIFLM, PRØVE, FRIFL, PROMO) er allerede aggregeret pr. måned;
  // vi summerer belob uanset type — PRØVE er 0 kr. og påvirker ikke.
  const [ytdRes, historyRes] = await Promise.all([
    supabase
      .from("sales_monthly_lago")
      .select("aar, maaned, belob")
      .eq("visma_customer_no", vismaCustomerNo)
      .in("aar", [currentYear, lastYear])
      .lte("maaned", throughMonth),
    // Én head-query for at afgøre om kunden overhovedet har historik.
    // Skiller "ingen omsætning nogensinde" (23 af 257 kunder pr. dagens
    // data) fra "ingen omsætning i ÅTD men aktivitet før".
    supabase
      .from("sales_monthly_lago")
      .select("visma_customer_no", { head: true, count: "exact" })
      .eq("visma_customer_no", vismaCustomerNo),
  ]);
  if (ytdRes.error) throw ytdRes.error;
  if (historyRes.error) throw historyRes.error;

  let ytdThisYear = 0;
  let ytdLastYear = 0;
  for (const r of (ytdRes.data ?? []) as Array<{
    aar: number;
    maaned: number;
    belob: number | string;
  }>) {
    const belob = Number(r.belob) || 0;
    if (r.aar === currentYear) ytdThisYear += belob;
    else if (r.aar === lastYear) ytdLastYear += belob;
  }

  const growthKr = ytdThisYear - ytdLastYear;
  const growthPct = ytdLastYear > 0 ? growthKr / ytdLastYear : null;
  const hasAnyHistoricRevenue = (historyRes.count ?? 0) > 0;

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
