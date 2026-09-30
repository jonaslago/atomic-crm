import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

import { fetchCustomerList } from "@/lago/customers/dataAccess";
import { useViewSalesId } from "@/lago/portefolje/PortefoljeContext";
import { Panel } from "@/lago/ui/Panel";

import { WidgetShell } from "../WidgetShell";

/**
 * Salg og ordrer (Brief 87 §3+§4, 28. sep 2026).
 *
 * To linjer i én widget:
 *   1. Denne måned · beløb · småt: hele samme måned sidste år
 *   2. Åbne ordrer · antal · samlet beløb
 *
 * Kildedata:
 *   - sales_monthly_lago (afstemt mod direktørens rapport, ÅTD jan–aug
 *     2026 = 16.745.075,95 kr. / rapport 16.745.076 kr.)
 *   - v_open_orders_categorised (Undtages lagerhåndtering er allerede
 *     filtreret væk i view'et, brief 78 §1)
 *
 * Filter: sælgerens egne kunder via viewSalesId — samme regel som resten
 * af forsiden. Under dækning: Camillas kunder, ikke coverens.
 *
 * De to udeladte linjer fra brief §3:
 *   - "Denne uge vs samme uge sidste år": kræver sales_transactions_lago
 *     (brief 88). Dato-opløsningen er kasseret i den nuværende import.
 *   - "Kan leveres uden aftalt dato": kræver bekraeftet_lev_dato som vi
 *     droppede i migration 20260904150000. Brief 88 måler kilden.
 *
 * Sammenligning: hele sidste års samme måned, ikke samme delperiode.
 * Jonas 28. sep: "med små tal samme periode sidste år — hele perioden."
 * Mandag formiddag i september sammenlignes altså med hele september 2025.
 * Perioden skrives ud ("Sep 2025: …"), så sælgeren kan se det.
 *
 * Ordre-rækken har intet link. Ordreoversigten er ikke bygget — brief:
 * "Byg ikke linket til en side, der ikke findes."
 *
 * Salg-rækken peger på /salgsudvikling.
 *
 * Forbehold på widget'en: vi kan ikke se, hvem der tog ordren (SC-11
 * ikke bygget). Tallet er alt faktureret til hans kunder — også webshop
 * og kontorets indtastninger. Det skal fremgå så sælgeren ved, hvad han
 * ser på.
 */

interface SalgOgOrdrerData {
  denneMaanedBeloeb: number;
  sammeMaanedSidsteAar: number;
  denneMaanedLabel: string;
  sammeMaanedSidsteAarLabel: string;
  aabneOrdreAntal: number;
  aabneOrdreBeloeb: number;
  /**
   * Brief 87 tillæg (28. sep 2026): MAV = "Med Andre Varer" (Levering-
   * kode 1). Filtreret på ORDRE-niveau: kun ordrer hvor alle linjer er
   * lagerstatus=klar, og mindst én er MAV-flagget. Reservationer
   * (kategori='reservation') holdes udenfor. Målt hele basen 28. sep:
   * 26 kunder, 38 ordrer, 250.757 kr (Jonas' 22. sep-fil: 26/37/230.703).
   */
  mavKunder: number;
  mavBeloeb: number;
}

const MAANEDER_KORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

async function fetchSalgOgOrdrer(
  vismaCustomerNos: string[],
  companyIds: number[],
): Promise<SalgOgOrdrerData> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const aar = now.getFullYear();
  const maaned = now.getMonth() + 1;
  const denneMaanedLabel = `${MAANEDER_KORT[maaned - 1]} ${aar}`;
  const sammeMaanedSidsteAarLabel = `${MAANEDER_KORT[maaned - 1]} ${aar - 1}`;

  // Ingen kunder = ingen tal. Undgår ".in([])"-fejl mod PostgREST.
  if (vismaCustomerNos.length === 0 && companyIds.length === 0) {
    return {
      denneMaanedBeloeb: 0,
      sammeMaanedSidsteAar: 0,
      denneMaanedLabel,
      sammeMaanedSidsteAarLabel,
      aabneOrdreAntal: 0,
      aabneOrdreBeloeb: 0,
      mavKunder: 0,
      mavBeloeb: 0,
    };
  }

  const [salgIAar, salgSidsteAar, aabneOrdre] = await Promise.all([
    vismaCustomerNos.length > 0
      ? supabase
          .from("sales_monthly_lago")
          .select("belob")
          .eq("aar", aar)
          .eq("maaned", maaned)
          .in("visma_customer_no", vismaCustomerNos)
      : Promise.resolve({ data: [], error: null }),
    vismaCustomerNos.length > 0
      ? supabase
          .from("sales_monthly_lago")
          .select("belob")
          .eq("aar", aar - 1)
          .eq("maaned", maaned)
          .in("visma_customer_no", vismaCustomerNos)
      : Promise.resolve({ data: [], error: null }),
    companyIds.length > 0
      ? supabase
          .from("v_open_orders_categorised")
          // Vi henter også antal_faerdigmeldt, mav, lagerstatus, kategori
          // og company_id — MAV-linjen skal grupperes på ordre-niveau
          // client-side, og guarden mod "beloeb=ej_faktureret lyver"
          // læser antal_faerdigmeldt. Se guard nedenfor.
          .select(
            "ordre_nr, beloeb, antal_faerdigmeldt, mav, lagerstatus, kategori, company_id",
          )
          .in("company_id", companyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if ("error" in salgIAar && salgIAar.error) throw salgIAar.error;
  if ("error" in salgSidsteAar && salgSidsteAar.error) throw salgSidsteAar.error;
  if ("error" in aabneOrdre && aabneOrdre.error) throw aabneOrdre.error;

  const sum = (rows: Array<{ belob?: number | string | null }>) =>
    rows.reduce((acc, r) => acc + Number(r.belob ?? 0), 0);
  const sumOrdreBeloeb = (rows: Array<{ beloeb?: number | string | null }>) =>
    rows.reduce((acc, r) => acc + Number(r.beloeb ?? 0), 0);
  const unikkeOrdrer = (rows: Array<{ ordre_nr?: string | null }>) =>
    new Set(rows.map((r) => r.ordre_nr).filter(Boolean)).size;

  type OrdreLinje = {
    ordre_nr: string | null;
    beloeb: number | string | null;
    antal_faerdigmeldt: number | string | null;
    mav: boolean | null;
    lagerstatus: string | null;
    kategori: string | null;
    company_id: number | null;
  };
  const ordreRows = (aabneOrdre.data ?? []) as OrdreLinje[];

  // Brief 87 tillæg (28. sep 2026): guard mod at aliaset "beloeb =
  // ej_faktureret" lyver, den dag VISMA sender en delvist leveret linje.
  // I dag: 0 rækker med antal_faerdigmeldt > 0 målt 28. sep. Advarer i
  // konsollen så udviklere ser signalet, uden at tallet på skærmen
  // ændres. En SQL-kommentar er tilføjet på view'et via migration 87 (TODO).
  const delvistFakturerede = ordreRows.filter(
    (r) => Number(r.antal_faerdigmeldt ?? 0) > 0,
  );
  if (delvistFakturerede.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SalgOgOrdrer] ${delvistFakturerede.length} åbne linjer har antal_faerdigmeldt > 0.` +
        ' "beloeb" er alias for ej_faktureret; delvis fakturering kan gøre visningen mindre præcis. Overvej at revidere view + widget.',
    );
  }

  // Brief 87 tillæg (28. sep 2026): MAV på ORDRE-niveau. Kun ordrer hvor
  // ALLE linjer er lagerstatus='klar' OG mindst én linje er mav-flagget.
  // Reservationer (kategori='reservation') holdes udenfor. Beløbet er
  // summen af ordrelinjernes beloeb (ej_faktureret).
  const ordreMap = new Map<
    string,
    {
      alleKlar: boolean;
      harMav: boolean;
      companyId: number | null;
      beloeb: number;
    }
  >();
  for (const r of ordreRows) {
    if (!r.ordre_nr || r.kategori === "reservation") continue;
    const cur = ordreMap.get(r.ordre_nr);
    const isKlar = r.lagerstatus === "klar";
    const isMav = r.mav === true;
    const b = Number(r.beloeb ?? 0);
    if (cur) {
      cur.alleKlar = cur.alleKlar && isKlar;
      cur.harMav = cur.harMav || isMav;
      cur.beloeb += b;
    } else {
      ordreMap.set(r.ordre_nr, {
        alleKlar: isKlar,
        harMav: isMav,
        companyId: r.company_id,
        beloeb: b,
      });
    }
  }
  let mavBeloeb = 0;
  const mavKunderSet = new Set<number>();
  for (const o of ordreMap.values()) {
    if (o.alleKlar && o.harMav) {
      mavBeloeb += o.beloeb;
      if (o.companyId != null) mavKunderSet.add(o.companyId);
    }
  }

  return {
    denneMaanedBeloeb: sum(
      (salgIAar.data ?? []) as Array<{ belob: number | string | null }>,
    ),
    sammeMaanedSidsteAar: sum(
      (salgSidsteAar.data ?? []) as Array<{ belob: number | string | null }>,
    ),
    denneMaanedLabel,
    sammeMaanedSidsteAarLabel,
    aabneOrdreAntal: unikkeOrdrer(ordreRows),
    aabneOrdreBeloeb: sumOrdreBeloeb(ordreRows),
    mavKunder: mavKunderSet.size,
    mavBeloeb,
  };
}

const krFmt = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  maximumFractionDigits: 0,
});
const nFmt = new Intl.NumberFormat("da-DK");

export function SalgOgOrdrerWidget() {
  const mySalesId = useViewSalesId();

  const mineQuery = useQuery({
    queryKey: ["lago-salg-og-ordrer-kunder", mySalesId],
    queryFn: () => fetchCustomerList({ mySalesId, onlyMine: true }),
    enabled: mySalesId != null,
    staleTime: 60_000,
  });

  const kunder = useMemo(() => {
    const list = mineQuery.data ?? [];
    return {
      vismaCustomerNos: list
        .map((r) => r.extension?.visma_customer_no)
        .filter((v): v is string => !!v),
      companyIds: list.map((r) => r.id),
    };
  }, [mineQuery.data]);

  const dataQuery = useQuery({
    queryKey: [
      "lago-salg-og-ordrer",
      mySalesId,
      kunder.vismaCustomerNos.length,
      kunder.companyIds.length,
    ],
    queryFn: () =>
      fetchSalgOgOrdrer(kunder.vismaCustomerNos, kunder.companyIds),
    enabled: mySalesId != null && mineQuery.isSuccess,
    staleTime: 60_000,
  });

  const isLoading = mineQuery.isPending || dataQuery.isPending;
  const error =
    (mineQuery.error as Error | null) ?? (dataQuery.error as Error | null);
  const d = dataQuery.data;

  return (
    <WidgetShell
      title="Salg og ordrer"
      // Brief 87 tillæg (28. sep 2026): underlinjen bærer selv ophavs-
      // oplysningen — "Alt faktureret på dine kunder" gør klart, at
      // det er alle fakturaer på hans kunder, uden en fodnote der
      // undskylder for det. Forbeholds-Inset'et er derfor fjernet.
      subtitle="Alt faktureret på dine kunder · hvad der ligger åbent nu"
      isLoading={isLoading && mySalesId != null}
      error={error}
      isEmpty={mySalesId == null}
      emptyState="Log ind for at se dine salg og ordrer."
      noPanel
    >
      {d && (
        <Panel>
          {/* Brief 87 tillæg #3 (28. sep 2026): to i bredden fra 1024 px
              (samme greb som Dagens tal, bare to i stedet for fire).
              Under 1024 px stables de i én kolonne. Brief 87 tillæg (28.
              sep 2026): fjerde række — "Venter på andre varer" (MAV) —
              lagt til. Fire linjer i alt, samme mønster som de tre
              øverste (kroner er hovedtal, antal understøttende). */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-6">
            <Link
              to="/salgsudvikling"
              className="flex items-baseline justify-between gap-3 no-underline hover:underline"
            >
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-[var(--fg)]">
                  Denne måned
                </div>
                <div className="text-[13px] text-[var(--fg-2)]">
                  {d.sammeMaanedSidsteAarLabel}:{" "}
                  {krFmt.format(d.sammeMaanedSidsteAar)}
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums text-base font-bold text-[var(--fg)]">
                {krFmt.format(d.denneMaanedBeloeb)}
              </div>
            </Link>
            {/* Brief 87 §3: ordre-rækken har intet link — ordreoversigten
                findes ikke. Byg ikke et link til en side, der ikke er der.
                Brief 87 tillæg (28. sep 2026): beløb er hovedtallet, antal
                er understøttende tekst — samme mønster som rækken ovenover,
                så de to læses ens. Kroner er det, man sammenligner.
                Beløbet er `ej_faktureret` (view-alias for beloeb): det
                udestående, ikke fulddet ordre-beløb. Målt 28. sep: 0
                linjer med antal_faerdigmeldt > 0, så ingen skjult
                dobbelttælling i det aktuelle udtræk. */}
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-[var(--fg)]">
                  Åbne ordrer
                </div>
                <div className="text-[13px] text-[var(--fg-2)]">
                  {nFmt.format(d.aabneOrdreAntal)}{" "}
                  {d.aabneOrdreAntal === 1 ? "ordre" : "ordrer"}
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums text-base font-bold text-[var(--fg)]">
                {krFmt.format(d.aabneOrdreBeloeb)}
              </div>
            </div>
            {/* Brief 87 tillæg (28. sep 2026): MAV = "Med Andre Varer" —
                Levering-kode 1, hvor hele ordren er klar men venter på
                at blive sendt sammen med noget andet. Sælgeren kan sælge
                én ting mere, så ordren kan sendes. Reservationer holdes
                udenfor. `title` giver forklaringen som tooltip. */}
            <div
              className="flex items-baseline justify-between gap-3"
              title="Varer klar på lager, der venter på at blive sendt sammen med noget andet."
            >
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold text-[var(--fg)]">
                  Venter på andre varer
                </div>
                <div className="text-[13px] text-[var(--fg-2)]">
                  {nFmt.format(d.mavKunder)}{" "}
                  {d.mavKunder === 1 ? "kunde" : "kunder"}
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums text-base font-bold text-[var(--fg)]">
                {krFmt.format(d.mavBeloeb)}
              </div>
            </div>
          </div>
        </Panel>
      )}
    </WidgetShell>
  );
}
