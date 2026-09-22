import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 45 · sektion 7 på kundekortet · rev. Brief 48 §B (16. sep 2026)
 * · rev. Brief 75 tillæg A §1 (22. sep 2026).
 *
 * Åbne ordrer aggregeres pr. ordre_nr — én ordre kan have mange linjer,
 * men sælgeren skal se ordren, ikke linjerne. total = sum af
 * ej_faktureret på linjerne (kr uden moms).
 *
 * Brief 75 tillæg A §1 (22. sep 2026): status kom tidligere fra
 * `i_rest > 0`. Det felt er "deprecated fossil" — parseren sætter det
 * aktivt til NULL siden brief 25 (aabneOrdrer.ts:318). `null > 0`
 * er aldrig sand, så hver eneste ordre viste "klar til levering"
 * uanset virkelighed. 652 restordre-linjer var usynlige for preview'et
 * på alle 93 kunder — en aktiv beroligelse, der var forkert.
 *
 * Rettet: status læses fra `lagerstatus` (parserens kanoniske signal),
 * som er "klar" / "delvis" / "restordre" per linje. Ordren tælles som
 * "restordre" hvis MINDST én linje er "restordre" eller "delvis" —
 * kunden venter stadig på noget. Kun når alle linjer er "klar" er
 * ordren klar.
 *
 * Brief 48 §B: restNote nævner PRODUKTNAVN i stedet for linjetal.
 */

export interface OpenOrderLine {
  linje_nr: string;
  produktnr: string | null;
  /** Produkt-beskrivelse fra products_lago (fallback: produktnr). */
  produktnavn: string;
  antal: number;
  ej_faktureret: number;
  /** "klar" | "delvis" | "restordre" — hvad kunden får (linje-niveau). */
  lagerstatus: "klar" | "delvis" | "restordre";
  /**
   * Brief 75 tillæg D-opfølgning (22. sep 2026): når `ej_faktureret === 0`
   * er beløbet ikke informationen — LAGO's prisstruktur gør nul lovligt.
   * Label mapper VISMA's salgstype + kampagne til et ord sælgeren kan
   * sige højt til kunden. Se komputer i useOpenOrders for reglerne.
   *
   * `null` = vis beløbet normalt (også hvis det er 0 kr uden forklaring —
   * dét er den ærlige "vi ved ikke"-tilstand).
   */
  belobLabel: string | null;
}

export interface OpenOrderSummary {
  ordre_nr: string;
  ordre_dato: string;
  total: number;
  status: "klar" | "restordre";
  /** Brief 75 tillæg D (22. sep 2026): antal linjer der afventer i
   *  denne ordre (restordre + delvis). Bruges i stedet for restNote
   *  når hele ordren skal foldes ud — sælgeren skal kunne se HVAD
   *  der afventer, ikke bare et navn og "+ N andre". */
  restLineCount: number;
  /** Brief 51 §4 (17. sep 2026): tidligste ønskede leveringsdato på
   *  linjerne i ordren. Null når ingen linje har feltet udfyldt. */
  oensketLevering: string | null;
  /** Brief 75 tillæg D §4: alle linjer i ordren, så UI kan folde ud
   *  uden en ekstra fetch. */
  lines: OpenOrderLine[];
}

/**
 * Brief 75 tillæg C (22. sep 2026): linje-baserede totaler, opdelt så
 * sælgeren ikke skal lægge sammen i hovedet foran en kunde.
 *
 * - klar:      lagerstatus=klar (inkl. ankommet En Primeur, jf. tillæg B)
 * - afventer:  lagerstatus in {restordre, delvis}, UNDTAGET En Primeur
 *              der stadig venter (aftalte 1-2 år, ikke akut)
 * - enPrimeur: status=21 OG lagerstatus != klar — separat linje, holdes
 *              uden for "i alt" så tallet ikke bliver misvisende
 * - iAlt:      klar + afventer (bevidst UDEN enPrimeur)
 */
export interface OpenOrdersTotals {
  klar: number;
  afventer: number;
  enPrimeur: number;
  iAlt: number;
}

export interface OpenOrdersData {
  orders: OpenOrderSummary[];
  totals: OpenOrdersTotals;
}

interface RawRow {
  ordre_nr: string;
  ordre_dato: string;
  linje_nr: string;
  antal: number | null;
  ej_faktureret: number | null;
  lagerstatus: string | null;
  status: string | null;
  salgstype: string | null;
  kampagne: string | null;
  produktnr: string | null;
  oensket_leveringsdato: string | null;
}

/**
 * Brief 75 tillæg D-opfølgning (22. sep 2026): forklaring på hvorfor
 * en linje har ej_faktureret = 0 kr. LAGO's prisstruktur gør nul
 * lovligt: PRØVE er en smagsprøve, PROMO er en kampagnevare, FRIFL er
 * "frie flasker" (uden beregning), kampagne dækker ikke-klassificerede
 * kampagner. FRIFLM ("nettopris") er derimod en betalt linje — en
 * FRIFLM-linje på 0 kr er en anomali og skal se sådan ud, så vi ikke
 * beroliger sælgeren med et forkert ord.
 *
 * Returnerer null når beløbet skal vises normalt (også hvis det er
 * 0 kr uden forklaring — dét er den ærlige tilstand).
 */
function beloebLabel(
  ejFaktureret: number,
  salgstype: string | null,
  kampagne: string | null,
): string | null {
  if (ejFaktureret !== 0) return null;
  if (salgstype === "PRØVE") return "prøve";
  if (salgstype === "PROMO") return "promo";
  if (salgstype === "FRIFL") return "frie flasker";
  if (kampagne && kampagne !== "") return "kampagne";
  return null;
}

export function useOpenOrders(vismaCustomerNo: string | null | undefined) {
  return useQuery({
    queryKey: ["lago-open-orders", vismaCustomerNo],
    enabled: Boolean(vismaCustomerNo),
    staleTime: 60_000,
    queryFn: async (): Promise<OpenOrdersData> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("open_orders_lago")
        .select(
          "ordre_nr, ordre_dato, linje_nr, antal, ej_faktureret, lagerstatus, status, salgstype, kampagne, produktnr, oensket_leveringsdato",
        )
        .eq("visma_customer_no", vismaCustomerNo as string)
        .order("ordre_dato", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as RawRow[];

      // Brief 75 tillæg A §1: rest-linjer = lagerstatus i {restordre, delvis}.
      // "delvis" betyder noget er kommet men resten mangler — kunden venter
      // stadig, så det tælles med.
      const isRestLine = (r: RawRow) =>
        r.lagerstatus === "restordre" || r.lagerstatus === "delvis";
      // Brief 75 tillæg D §4: fetche produktnavn for ALLE linjer (ikke
      // kun rest), så folde-ud viser hvad hver linje er.
      const allProduktnr = new Set<string>();
      for (const r of rows) {
        if (r.produktnr) allProduktnr.add(r.produktnr);
      }
      const navnByProduktnr = new Map<string, string>();
      if (allProduktnr.size > 0) {
        const { data: pData, error: pError } = await supabase
          .from("products_lago")
          .select("produktnr, beskrivelse")
          .in("produktnr", [...allProduktnr]);
        if (pError) throw pError;
        for (const p of (pData ?? []) as Array<{
          produktnr: string;
          beskrivelse: string | null;
        }>) {
          if (p.beskrivelse) navnByProduktnr.set(p.produktnr, p.beskrivelse);
        }
      }

      const byOrdre = new Map<string, RawRow[]>();
      for (const r of rows) {
        const arr = byOrdre.get(r.ordre_nr) ?? [];
        arr.push(r);
        byOrdre.set(r.ordre_nr, arr);
      }

      const out: OpenOrderSummary[] = [];
      for (const [ordre_nr, lines] of byOrdre) {
        const total = lines.reduce(
          (s, l) => s + Number(l.ej_faktureret ?? 0),
          0,
        );
        const restLines = lines.filter(isRestLine);
        // Brief 51 §4: tidligste ønskede leveringsdato på tværs af
        // linjerne. Feltet ligger på ordre-hovedet i VISMA og skulle
        // være ens på alle linjer, men vi tager tidligste for at være
        // konservative — en delvis leverance rykker aldrig frem.
        const leveringsdatoer = lines
          .map((l) => l.oensket_leveringsdato)
          .filter((d): d is string => Boolean(d))
          .sort();
        const oensketLevering = leveringsdatoer[0] ?? null;
        // Brief 75 tillæg D §4: linjer med produkt-navn + normaliseret
        // lagerstatus. Sorter først på lagerstatus (rest/delvis øverst)
        // så folde-ud viser det interessante først, dernæst på beløb
        // faldende — det største produkt trækker øjet.
        const orderLines: OpenOrderLine[] = lines
          .map((l) => {
            const rawStatus = l.lagerstatus;
            const normalized: OpenOrderLine["lagerstatus"] =
              rawStatus === "klar" || rawStatus === "delvis"
                ? rawStatus
                : "restordre";
            const produktnavn =
              (l.produktnr && navnByProduktnr.get(l.produktnr)) ||
              l.produktnr ||
              "(uden produktnr)";
            const ejFakt = Number(l.ej_faktureret ?? 0);
            return {
              linje_nr: l.linje_nr,
              produktnr: l.produktnr,
              produktnavn,
              antal: Number(l.antal ?? 0),
              ej_faktureret: ejFakt,
              lagerstatus: normalized,
              belobLabel: beloebLabel(ejFakt, l.salgstype, l.kampagne),
            };
          })
          .sort((a, b) => {
            const rank = (s: string) =>
              s === "restordre" ? 0 : s === "delvis" ? 1 : 2;
            const dr = rank(a.lagerstatus) - rank(b.lagerstatus);
            if (dr !== 0) return dr;
            return b.ej_faktureret - a.ej_faktureret;
          });
        out.push({
          ordre_nr,
          ordre_dato: lines[0].ordre_dato,
          total,
          status: restLines.length > 0 ? "restordre" : "klar",
          restLineCount: restLines.length,
          oensketLevering,
          lines: orderLines,
        });
      }
      out.sort((a, b) => (a.ordre_dato < b.ordre_dato ? 1 : -1));

      // Brief 75 tillæg C: linje-baserede totaler. En Primeur der
      // stadig venter holdes uden for iAlt; ankommet En Primeur
      // (status=21 + lagerstatus=klar) tælles som klar — dét er
      // aftalen fra tillæg B: den er landet, sig det højt.
      let klarRaw = 0;
      let afventerRaw = 0;
      let enPrimeurRaw = 0;
      for (const r of rows) {
        const belob = Number(r.ej_faktureret ?? 0);
        const isEnPrimeur = r.status === "21";
        const isKlar = r.lagerstatus === "klar";
        if (isEnPrimeur && !isKlar) {
          enPrimeurRaw += belob;
        } else if (isKlar) {
          klarRaw += belob;
        } else {
          afventerRaw += belob;
        }
      }
      // Brief 75 tillæg C, opfølgning (22. sep 2026): afventer skal
      // beregnes som iAlt − klar, ikke summeres uafhængigt. Ellers
      // runder Intl.NumberFormat de tre tal hver for sig og de går
      // ikke op på skærmen (699.877 mod 302.791 + 397.085 = 699.876).
      // Runder først iAlt og klar, så afventer er restforskellen —
      // 302.791 + 397.086 = 699.877 hver gang.
      const klar = Math.round(klarRaw);
      const iAlt = Math.round(klarRaw + afventerRaw);
      const afventer = iAlt - klar;
      const enPrimeur = Math.round(enPrimeurRaw);

      return {
        orders: out,
        totals: { klar, afventer, enPrimeur, iAlt },
      };
    },
  });
}
