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

export interface OpenOrderSummary {
  ordre_nr: string;
  ordre_dato: string;
  total: number;
  status: "klar" | "restordre";
  restNote: string | null;
  /** Brief 51 §4 (17. sep 2026): tidligste ønskede leveringsdato på
   *  linjerne i ordren. Null når ingen linje har feltet udfyldt. */
  oensketLevering: string | null;
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
  ej_faktureret: number | null;
  lagerstatus: string | null;
  status: string | null;
  produktnr: string | null;
  oensket_leveringsdato: string | null;
}

/** Kort produktnavn — appellation eller første 2-3 markante ord. Hvis
 *  navnet er meget langt tages det op til første komma / slash / dash
 *  så vi ikke får hele produkt-etiketten i noten. */
function shortenProductName(
  name: string | null | undefined,
  fallback: string,
): string {
  if (!name) return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  // Klip ved første "· , / -" der har mellemrum foran — så vi tager
  // "Meursault" ud af "Meursault 1er cru · Perrières · 2020".
  const cut = trimmed.search(/\s[·,/-]/);
  const head = cut > 0 ? trimmed.slice(0, cut) : trimmed;
  return head.length > 40 ? head.slice(0, 40) + "…" : head;
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
          "ordre_nr, ordre_dato, ej_faktureret, lagerstatus, status, produktnr, oensket_leveringsdato",
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
      const restProduktnr = new Set<string>();
      for (const r of rows) {
        if (isRestLine(r) && r.produktnr) {
          restProduktnr.add(r.produktnr);
        }
      }
      const navnByProduktnr = new Map<string, string>();
      if (restProduktnr.size > 0) {
        const { data: pData, error: pError } = await supabase
          .from("products_lago")
          .select("produktnr, beskrivelse")
          .in("produktnr", [...restProduktnr]);
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
        // Restlinjer sorteret efter beløb faldende — det største produkt
        // er hovedvaren i "Meursault + 2 andre".
        const restLines = lines
          .filter(isRestLine)
          .sort(
            (a, b) =>
              Number(b.ej_faktureret ?? 0) - Number(a.ej_faktureret ?? 0),
          );
        let restNote: string | null = null;
        if (restLines.length > 0) {
          const primary = restLines[0];
          const primaryName = shortenProductName(
            primary.produktnr ? navnByProduktnr.get(primary.produktnr) : null,
            primary.produktnr ?? "produkt",
          );
          if (restLines.length === 1) {
            restNote = `${primaryName} afventer ankomst`;
          } else {
            const others = restLines.length - 1;
            restNote = `${primaryName} + ${others} ${others === 1 ? "anden" : "andre"} afventer ankomst`;
          }
        }
        // Brief 51 §4: tidligste ønskede leveringsdato på tværs af
        // linjerne. Feltet ligger på ordre-hovedet i VISMA og skulle
        // være ens på alle linjer, men vi tager tidligste for at være
        // konservative — en delvis leverance rykker aldrig frem.
        const leveringsdatoer = lines
          .map((l) => l.oensket_leveringsdato)
          .filter((d): d is string => Boolean(d))
          .sort();
        const oensketLevering = leveringsdatoer[0] ?? null;
        out.push({
          ordre_nr,
          ordre_dato: lines[0].ordre_dato,
          total,
          status: restLines.length > 0 ? "restordre" : "klar",
          restNote,
          oensketLevering,
        });
      }
      out.sort((a, b) => (a.ordre_dato < b.ordre_dato ? 1 : -1));

      // Brief 75 tillæg C: linje-baserede totaler. En Primeur der
      // stadig venter holdes uden for iAlt; ankommet En Primeur
      // (status=21 + lagerstatus=klar) tælles som klar — dét er
      // aftalen fra tillæg B: den er landet, sig det højt.
      let klar = 0;
      let afventer = 0;
      let enPrimeur = 0;
      for (const r of rows) {
        const belob = Number(r.ej_faktureret ?? 0);
        const isEnPrimeur = r.status === "21";
        const isKlar = r.lagerstatus === "klar";
        if (isEnPrimeur && !isKlar) {
          enPrimeur += belob;
        } else if (isKlar) {
          klar += belob;
        } else {
          afventer += belob;
        }
      }

      return {
        orders: out,
        totals: { klar, afventer, enPrimeur, iAlt: klar + afventer },
      };
    },
  });
}
