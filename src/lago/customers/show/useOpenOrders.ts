import { useQuery } from "@tanstack/react-query";

import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

/**
 * Brief 45 · sektion 7 på kundekortet · rev. Brief 48 §B (16. sep 2026)
 * · rev. Brief 75 tillæg A §1, tillæg F, og brief 78 + tillæg A
 * (22. sep 2026).
 *
 * Åbne ordrer aggregeres pr. ordre_nr. total = sum af ej_faktureret på
 * linjerne (kr uden moms).
 *
 * Brief 78 §1: `Undtages lagerhåndtering = 1` var tidligere et
 * import-filter; det droppede kundens prissatte linjer (AEvin #34696·1
 * "91801-Jul" 3.163,80 kr forsvandt; komponenten 91801 blev). Filteret
 * er væk. Par-detektion i visnings-laget: for hver ordre matches
 * salgsvarer (undtages=1, belob>0) med komponenter (undtages=0, belob=0,
 * res>0) via produktnr-prefix. Salgsvaren vises; komponentens
 * `reserveret_mod_lager` overtages så statustekst passer.
 *
 * Brief 78 tillæg A §1: rest = antal - reserveret_mod_lager (VISMAs
 * egen formel, "I rest"). Ikke antal - antal_faerdigmeldt, som altid
 * gav rest = antal fordi LAGO aldrig dellevererer på samme ordre.
 *
 * Brief 78 tillæg A §3: `note` fra VISMA (ordrens formål — fx
 * "Portvinspakke 2026 - rest") er den bedste enkeltoplysning en
 * sælger kan få. Vises i ordre-hovedet.
 */

export interface OpenOrderLine {
  linje_nr: string;
  produktnr: string | null;
  /** Produkt-beskrivelse fra products_lago (fallback: produktnr). */
  produktnavn: string;
  antal: number;
  /** Brief 78 tillæg A §1: rest = antal - reserveret_mod_lager. */
  rest: number;
  /** Brief 78 §1: hvor mange der er reserveret på lager til denne
   *  linje. Kommer fra parret komponent-linje hvis paret; ellers
   *  direkte fra linjen selv. Bruges til "N klar, M mangler"-tekst. */
  reserveret: number;
  ej_faktureret: number;
  /**
   * Brief 75 tillæg F · rev. brief 78 tillæg A §1 (22. sep 2026):
   * sælgervendt statustekst afledt af rest (I rest = antal −
   * reserveret_mod_lager).
   *
   * - "afventer" (reserveret = 0): intet reserveret, intet leveret.
   * - "delvis"   (0 < reserveret < antal): nogle flasker klar på
   *   lager, resten mangler. UI viser "N klar, M mangler".
   * - "klar"     (reserveret ≥ antal): alt reserveret, kan sendes.
   */
  kundeStatus: "afventer" | "delvis" | "klar";
  /**
   * Brief 75 tillæg D-opfølgning · rev. tillæg F: label for 0-kr linjer
   * (prøve/promo/frie flasker/kampagne). Vises EFTER produktnavnet,
   * ikke i beløbskolonnen — så "0 kr." forbliver et beløb.
   */
  belobLabel: string | null;
}

export interface OpenOrderSummary {
  ordre_nr: string;
  ordre_dato: string;
  total: number;
  status: "klar" | "restordre";
  /** Antal linjer der afventer i denne ordre (rest > 0). */
  restLineCount: number;
  /** Brief 78 tillæg A §2: alle datoer er ØNSKEDE — der findes ingen
   *  bekræftet leveringsdato i OSR-udtrækket. Ordet "Ønsket" skal
   *  altid stå. */
  oensketLevering: string | null;
  /** Brief 78 tillæg A §3: ordrens Note fra VISMA — ens på alle
   *  linjer, så vi tager første ikke-tomme. */
  note: string | null;
  /** Brief 75 tillæg D §4: varelinjer i ordren (uden tillæg/afgifter),
   *  så UI kan folde ud uden en ekstra fetch. */
  lines: OpenOrderLine[];
  /** Brief 78 tillæg B §2 (22. sep 2026): samlet beløb for
   *  tillæg/afgifter (Vej, Energi, emb-afg) — de tælles i `total`
   *  men vises som én linje nederst, ikke som varer man venter på. */
  tillaegOgAfgifter: number;
}

/**
 * Brief 75 tillæg C · rev. brief 78 tillæg A §1: linje-baserede totaler
 * målt på reservation (VISMAs "I rest"):
 *
 * - klar:      reserveret ≥ antal (kan sendes)
 * - afventer:  reserveret < antal, UNDTAGET En Primeur (aftalte 1-2 år)
 * - enPrimeur: status=21 OG reserveret < antal — separat linje
 * - iAlt:      klar + afventer
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
  rest: number | null;
  reserveret_mod_lager: number | null;
  ej_faktureret: number | null;
  lagerstatus: string | null;
  status: string | null;
  salgstype: string | null;
  kampagne: string | null;
  produktnr: string | null;
  oensket_leveringsdato: string | null;
  note: string | null;
  undtages_lagerhaandtering: boolean | null;
}

/**
 * Brief 75 tillæg D-opfølgning · rev. brief 78 tillæg A §4 (22. sep 2026):
 * forklaring på hvorfor en linje har ej_faktureret = 0 kr. LAGO's
 * prisstruktur gør nul lovligt.
 *
 * Rev. brief 78: en komponent-linje (0 kr, reserveret > 0) er en
 * LAGERROLLE, ikke en kampagne — så label undertrykkes for den.
 * Bekræftet på AEvin #34696·2 hvor kampagne=26120 stod på ALLE fire
 * linjer (også dem med pris), så kampagne-koden er ikke forklaringen
 * på 0-beløbet. Rollen som komponent er.
 */
function beloebLabel(
  ejFaktureret: number,
  salgstype: string | null,
  kampagne: string | null,
  reserveret: number,
): string | null {
  if (ejFaktureret !== 0) return null;
  // Komponent-mistanke: 0 kr + reservation > 0. Sig ikke "kampagne".
  if (reserveret > 0) return null;
  if (salgstype === "PRØVE") return "prøve";
  if (salgstype === "PROMO") return "promo";
  if (salgstype === "FRIFL") return "frie flasker";
  if (kampagne && kampagne !== "") return "kampagne";
  return null;
}

/**
 * Brief 78 §1 (22. sep 2026): par-detektion for salgsvare + komponent.
 *
 * VISMA modellerer nogle varer (fx Vista Alegre Juleport) som to
 * linjer: en salgsvare (produktnr=91801-Jul, undtages=1, belob>0) og
 * en komponent (produktnr=91801, undtages=0, belob=0, reserveret>0).
 * De er én bestilling, ikke to.
 *
 * Reglen: match to linjer på samme ordre, samme antal, én med
 * undtages=1 og belob>0, én med undtages=0 og belob=0 og reserveret>0,
 * som deler produktnr-prefix (før første `-`). Salgsvaren vises;
 * komponentens reserveret_mod_lager overføres.
 *
 * Match kun HELT entydige par (præcis én kandidat i hver retning).
 * Findes flere kandidater, lad linjerne stå alene — det er bedre at
 * vise begge sandheder end at gætte forkert.
 *
 * Returnerer et Set med linje_nr for komponent-linjer der skal skjules,
 * og et Map fra salgsvare-linje_nr til reserveret-værdi der skal
 * overføres.
 */
function detektPar(lines: RawRow[]): {
  skjul: Set<string>;
  overtagRes: Map<string, number>;
} {
  const skjul = new Set<string>();
  const overtagRes = new Map<string, number>();
  const salgsvarer = lines.filter(
    (l) => l.undtages_lagerhaandtering === true && Number(l.ej_faktureret) > 0,
  );
  const komponenter = lines.filter(
    (l) =>
      l.undtages_lagerhaandtering === false &&
      Number(l.ej_faktureret) === 0 &&
      Number(l.reserveret_mod_lager) > 0,
  );
  const basePart = (p: string | null) => (p ?? "").split("-")[0];
  for (const s of salgsvarer) {
    const sPrefix = basePart(s.produktnr);
    const sAntal = Number(s.antal ?? 0);
    if (!sPrefix || sAntal === 0) continue;
    const kandidater = komponenter.filter(
      (k) =>
        basePart(k.produktnr) === sPrefix && Number(k.antal ?? 0) === sAntal,
    );
    if (kandidater.length !== 1) continue;
    // Sikring: komponenten må ikke også være et match for en anden
    // salgsvare, ellers er relationen tvetydig.
    const komp = kandidater[0];
    const kompMatchesElsewhere = salgsvarer.filter(
      (x) =>
        x !== s &&
        basePart(x.produktnr) === basePart(komp.produktnr) &&
        Number(x.antal ?? 0) === Number(komp.antal ?? 0),
    );
    if (kompMatchesElsewhere.length > 0) continue;
    skjul.add(komp.linje_nr);
    overtagRes.set(s.linje_nr, Number(komp.reserveret_mod_lager ?? 0));
  }
  return { skjul, overtagRes };
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
          "ordre_nr, ordre_dato, linje_nr, antal, rest, reserveret_mod_lager, ej_faktureret, lagerstatus, status, salgstype, kampagne, produktnr, oensket_leveringsdato, note, undtages_lagerhaandtering",
        )
        .eq("visma_customer_no", vismaCustomerNo as string)
        .order("ordre_dato", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as RawRow[];

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

      // Brief 78 tillæg B §3: enote/inote-linjer er note-markører uden
      // indhold i OSR-udtrækket (Note-feltet på selve linjen er tom;
      // teksten ligger i VISMA-systemet men eksporteres ikke). Vi
      // skjuler dem helt fra ordre-visningen — de ville stå som "Ekstern
      // Note · 1 stk. · 0 kr." uden information.
      const rowsUdenNoteLinjer = rows.filter(
        (r) => r.produktnr !== "enote" && r.produktnr !== "inote",
      );
      const byOrdre = new Map<string, RawRow[]>();
      for (const r of rowsUdenNoteLinjer) {
        const arr = byOrdre.get(r.ordre_nr) ?? [];
        arr.push(r);
        byOrdre.set(r.ordre_nr, arr);
      }

      const out: OpenOrderSummary[] = [];
      // Brief 78 §1: hold pardata pr. ordre så totals også bruger dem.
      const skjulByOrdre = new Map<string, Set<string>>();
      const overtagByOrdre = new Map<string, Map<string, number>>();
      // Brief 78 tillæg B §2 (22. sep 2026): Vej/Energi/emb-afg er
      // afgifter, ikke varer. De tælles i "I alt" men vises samlet
      // nederst — en vejafgift "afventer" ikke ankomst, den er en
      // post på regningen.
      const TILLAEG_PRODUKTNR = new Set(["Vej", "Energi", "emb-afg"]);
      for (const [ordre_nr, lines] of byOrdre) {
        const { skjul, overtagRes } = detektPar(lines);
        skjulByOrdre.set(ordre_nr, skjul);
        overtagByOrdre.set(ordre_nr, overtagRes);
        const synligeLines = lines.filter((l) => !skjul.has(l.linje_nr));

        // Adskil varelinjer fra tillæg/afgifter.
        const vareLines = synligeLines.filter(
          (l) => !TILLAEG_PRODUKTNR.has(l.produktnr ?? ""),
        );
        const tillaegLines = synligeLines.filter((l) =>
          TILLAEG_PRODUKTNR.has(l.produktnr ?? ""),
        );
        const tillaegOgAfgifter = tillaegLines.reduce(
          (s, l) => s + Number(l.ej_faktureret ?? 0),
          0,
        );

        const total = synligeLines.reduce(
          (s, l) => s + Number(l.ej_faktureret ?? 0),
          0,
        );

        const leveringsdatoer = synligeLines
          .map((l) => l.oensket_leveringsdato)
          .filter((d): d is string => Boolean(d))
          .sort();
        const oensketLevering = leveringsdatoer[0] ?? null;

        // Brief 78 tillæg A §3: note er ens på alle linjer i ordren.
        // Tag første ikke-tomme (dybest set alle linjer, men trim
        // whitespace-only tomme strenge).
        const noteRaw = synligeLines
          .map((l) => (l.note ?? "").trim())
          .find((n) => n.length > 0);
        const note = noteRaw ?? null;

        const orderLines: OpenOrderLine[] = vareLines
          .map((l) => {
            const produktnavn =
              (l.produktnr && navnByProduktnr.get(l.produktnr)) ||
              l.produktnr ||
              "(uden produktnr)";
            const ejFakt = Number(l.ej_faktureret ?? 0);
            const antal = Number(l.antal ?? 0);
            // Brief 78 §1: overtag reservation fra parret komponent
            // hvis den findes; ellers linjens egen.
            const overtag = overtagRes.get(l.linje_nr);
            const reserveret =
              overtag !== undefined
                ? overtag
                : Number(l.reserveret_mod_lager ?? 0);
            const rest = Math.max(0, antal - reserveret);
            const kundeStatus: OpenOrderLine["kundeStatus"] =
              reserveret >= antal
                ? "klar"
                : reserveret > 0
                  ? "delvis"
                  : "afventer";
            return {
              linje_nr: l.linje_nr,
              produktnr: l.produktnr,
              produktnavn,
              antal,
              rest,
              reserveret,
              ej_faktureret: ejFakt,
              kundeStatus,
              belobLabel: beloebLabel(
                ejFakt,
                l.salgstype,
                l.kampagne,
                reserveret,
              ),
            };
          })
          .sort((a, b) => {
            // Sortér afventende først (kunden venter helt), dernæst
            // delvis, dernæst klar. Sekundær: beløb faldende.
            const rank = (s: OpenOrderLine["kundeStatus"]) =>
              s === "afventer" ? 0 : s === "delvis" ? 1 : 2;
            const dr = rank(a.kundeStatus) - rank(b.kundeStatus);
            if (dr !== 0) return dr;
            return b.ej_faktureret - a.ej_faktureret;
          });

        // Brief 78 tillæg B §3: en ordre uden synlige linjer (fx
        // ordre 31890 med kun en enote-linje som filtreres væk) skal
        // ikke stå i listen — hverken som tom række eller som "N linje
        // afventer" uden noget under.
        if (orderLines.length === 0 && tillaegLines.length === 0) continue;

        const restLines = orderLines.filter((l) => l.rest > 0);
        out.push({
          ordre_nr,
          ordre_dato: synligeLines[0]?.ordre_dato ?? lines[0].ordre_dato,
          total,
          status: restLines.length > 0 ? "restordre" : "klar",
          restLineCount: restLines.length,
          oensketLevering,
          note,
          lines: orderLines,
          tillaegOgAfgifter,
        });
      }
      out.sort((a, b) => (a.ordre_dato < b.ordre_dato ? 1 : -1));

      // Brief 75 tillæg C · rev. brief 78 tillæg A §1: totaler måles nu
      // på reservation (VISMAs "I rest" = 0 → klar). Komponent-linjer
      // der er skjult i par tælles ikke — deres reservation er allerede
      // overtaget af salgsvaren.
      let klarRaw = 0;
      let afventerRaw = 0;
      let enPrimeurRaw = 0;
      for (const [ordre_nr, lines] of byOrdre) {
        const skjul = skjulByOrdre.get(ordre_nr) ?? new Set<string>();
        const overtagRes = overtagByOrdre.get(ordre_nr) ?? new Map();
        for (const r of lines) {
          if (skjul.has(r.linje_nr)) continue;
          const belob = Number(r.ej_faktureret ?? 0);
          const antal = Number(r.antal ?? 0);
          const overtag = overtagRes.get(r.linje_nr);
          const reserveret =
            overtag !== undefined
              ? overtag
              : Number(r.reserveret_mod_lager ?? 0);
          const isEnPrimeur = r.status === "21";
          const isKlar = reserveret >= antal;
          if (isEnPrimeur && !isKlar) enPrimeurRaw += belob;
          else if (isKlar) klarRaw += belob;
          else afventerRaw += belob;
        }
      }
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
