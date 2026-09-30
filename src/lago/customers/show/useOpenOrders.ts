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
   * Brief 75 tillæg F · rev. brief 78 tillæg A §1 og tillæg G (22. sep 2026):
   * sælgervendt statustekst.
   *
   * - "reservation" (levering=5): varen står på hylden til senere træk.
   *   UI viser "på reservation" (blå), ingen "klar"/"afventer".
   * - "afventer"    (reserveret = 0): intet reserveret, intet leveret.
   * - "delvis"      (0 < reserveret < antal): nogle flasker klar,
   *   resten mangler. UI viser "N klar, M mangler".
   * - "klar"        (reserveret ≥ antal): alt reserveret, kan sendes.
   */
  kundeStatus: "reservation" | "afventer" | "delvis" | "klar";
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
  status: "klar" | "restordre" | "reservation";
  /** §11 (29. sep 2026): true når alle synlige linjer har Levering=1
   *  (MAV — venter på andre varer). Ordren er klar på lager, men afventer
   *  fragtvolumen. Badgen viser stadig "Klar til levering"; MAV-markøren
   *  ved siden af forklarer hvorfor den ikke er på forsidens "Kan sendes". */
  isMav: boolean;
  /** Antal linjer der afventer i denne ordre (rest > 0). */
  restLineCount: number;
  /** Brief 75 tillæg G (22. sep 2026): sum af antal på reservations-
   *  linjer. Sammendrag over reservationer skal tale om ANTAL, ikke
   *  kroner: "30 stk. på reservation". */
  reservationAntal: number;
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
 * Brief 75 tillæg C · rev. brief 78 tillæg A §1 · rev. tillæg H (22. sep
 * 2026) · rev. brief 90 §4-opfølgning (29. sep 2026) · rev. samme dag
 * med MAV-bucket:
 *
 * ORDRE-baserede totaler. Man sender en ordre, ikke en linje — kontorets
 * Kan sendes-widget bruger samme definition, og de to skal stemme.
 *
 * - klar:            hele ordren klar · Levering = 0. Kan sendes nu
 * - venterPaaAndre:  hele ordren klar · Levering = 1 (MAV). Klar på
 *                    lager, men afventer selskab — sælgeren skal kunne
 *                    se hvilke ordrer der venter på andre varer, når
 *                    han står i butikken
 * - afventer:        resten af beløbet på ordrer der ikke er hele klar
 *                    (og ikke er reservation eller En Primeur)
 * - enPrimeur:       hele ordrens linjer er status=21 og ordren ikke
 *                    er hele klar (aftalte 1-2 år)
 * - paaReservation:  alle linjer er levering=5 (kundens instruks: varer
 *                    står klar til træk)
 * - iAlt:            summen af alle synlige linjer.
 *
 * Blandede ordrer (MAV-linjer sammen med ikke-MAV-linjer) findes ikke
 * i praksis — målt 0 af 354 åbne ordrer i Aabne-ordrelinier_2026-09-22.
 * Beregningen behøver derfor ikke håndtere det tilfælde.
 *
 * Historisk (før 29. sep 2026) blev totalerne målt på linje-niveau,
 * hvilket gav en tredje definition af "klar" der ikke matchede badgen
 * pr. ordre eller kontorets widget. Brief 90 §4 fastholdt hele-ordre-
 * definitionen som den rigtige overalt.
 */
export interface OpenOrdersTotals {
  klar: number;
  venterPaaAndre: number;
  afventer: number;
  enPrimeur: number;
  paaReservation: number;
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
  reserveret_effective: number | null;
  ej_faktureret: number | null;
  lagerstatus: string | null;
  lagerstatus_effective: string | null;
  er_par_komponent: boolean | null;
  status: string | null;
  levering: string | null;
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

// §11 opfølgning (29. sep 2026): par-detektionen er flyttet til basen
// (view open_orders_effective_lago). Denne fil læser fra viewet og bruger
// reserveret_effective + lagerstatus_effective + er_par_komponent direkte.
// Den historiske detektPar() er væk — én implementation af reglen, læst
// af både kundekortet og forsidens Kan sendes-widget.

export function useOpenOrders(vismaCustomerNo: string | null | undefined) {
  return useQuery({
    queryKey: ["lago-open-orders", vismaCustomerNo],
    enabled: Boolean(vismaCustomerNo),
    staleTime: 60_000,
    queryFn: async (): Promise<OpenOrdersData> => {
      const supabase = getSupabaseClient();
      // §11 opfølgning (29. sep 2026): læs fra effective-view som bærer
      // reserveret_effective + lagerstatus_effective + er_par_komponent.
      // Ingen par-detektion mere i klienten; reglen ligger i basen.
      const { data, error } = await supabase
        .from("open_orders_effective_lago")
        .select(
          "ordre_nr, ordre_dato, linje_nr, antal, rest, reserveret_mod_lager, reserveret_effective, ej_faktureret, lagerstatus, lagerstatus_effective, er_par_komponent, status, levering, salgstype, kampagne, produktnr, oensket_leveringsdato, note, undtages_lagerhaandtering",
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
      // Brief 78 tillæg B §2 (22. sep 2026): Vej/Energi/emb-afg er
      // afgifter, ikke varer. De tælles i "I alt" men vises samlet
      // nederst — en vejafgift "afventer" ikke ankomst, den er en
      // post på regningen.
      const TILLAEG_PRODUKTNR = new Set(["Vej", "Energi", "emb-afg"]);
      for (const [ordre_nr, lines] of byOrdre) {
        // §11 opfølgning (29. sep 2026): er_par_komponent kommer fra
        // viewet — komponentens reservation er allerede overtaget af
        // salgsvaren, så vi skjuler komponent-linjen fra visning.
        const synligeLines = lines.filter((l) => !l.er_par_komponent);

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
            // §11 opfølgning (29. sep 2026): reserveret_effective kommer
            // fra viewet og har allerede overtaget komponentens reservation
            // for parrede salgsvarer. Ingen klient-side overtag.
            const reserveret = Number(l.reserveret_effective ?? 0);
            const rest = Math.max(0, antal - reserveret);
            // Brief 75 tillæg G: reservationer (levering=5) er varer,
            // kunden trækker efter behov — ikke noget hun venter på.
            // Overrider rest/reservation-baseret status.
            const erReservation = l.levering === "5";
            const kundeStatus: OpenOrderLine["kundeStatus"] = erReservation
              ? "reservation"
              : reserveret >= antal
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
            // Brief 75 tillæg G: reservationer sorteres først (kræver
            // handling — sælgeren kan spørge om træk), dernæst afventer,
            // dernæst delvis, dernæst klar. Sekundær: beløb faldende.
            const rank = (s: OpenOrderLine["kundeStatus"]) =>
              s === "reservation"
                ? 0
                : s === "afventer"
                  ? 1
                  : s === "delvis"
                    ? 2
                    : 3;
            const dr = rank(a.kundeStatus) - rank(b.kundeStatus);
            if (dr !== 0) return dr;
            return b.ej_faktureret - a.ej_faktureret;
          });

        // Brief 78 tillæg B §3: en ordre uden synlige linjer (fx
        // ordre 31890 med kun en enote-linje som filtreres væk) skal
        // ikke stå i listen — hverken som tom række eller som "N linje
        // afventer" uden noget under.
        if (orderLines.length === 0 && tillaegLines.length === 0) continue;

        // Brief 75 tillæg G: reservations-linjer tælles ikke som
        // restordre (kunden venter ikke på dem). En ordre er
        // "reservation" hvis ALLE varelinjer er reservationer;
        // ellers "restordre" hvis der er rest > 0 på en ikke-
        // reservation-linje; ellers "klar".
        const reservationLines = orderLines.filter(
          (l) => l.kundeStatus === "reservation",
        );
        const nonReservationLines = orderLines.filter(
          (l) => l.kundeStatus !== "reservation",
        );
        const restLines = nonReservationLines.filter((l) => l.rest > 0);
        const alleErReservation =
          orderLines.length > 0 &&
          reservationLines.length === orderLines.length;
        const orderStatus: OpenOrderSummary["status"] = alleErReservation
          ? "reservation"
          : restLines.length > 0
            ? "restordre"
            : "klar";
        const reservationAntal = reservationLines.reduce(
          (s, l) => s + l.antal,
          0,
        );
        // §11 (29. sep 2026): MAV-markør pr. ordre. True når alle
        // synlige linjer har Levering=1. Blandede ordrer findes ikke
        // i praksis (målt 0 af 354).
        const isMav =
          synligeLines.length > 0 &&
          synligeLines.every((l) => l.levering === "1");
        out.push({
          ordre_nr,
          ordre_dato: synligeLines[0]?.ordre_dato ?? lines[0].ordre_dato,
          total,
          status: orderStatus,
          isMav,
          restLineCount: restLines.length,
          reservationAntal,
          oensketLevering,
          note,
          lines: orderLines,
          tillaegOgAfgifter,
        });
      }
      out.sort((a, b) => (a.ordre_dato < b.ordre_dato ? 1 : -1));

      // Brief 90 §4 opfølgning (29. sep 2026): totaler måles på ORDRE-
      // niveau, ikke linje-niveau. Man sender en ordre, ikke en linje;
      // en linje på hylden i en restordre-ordre er reserveret, ikke
      // afsendelsesklar.
      //
      // Definition — samme som kontorets Kan sendes-widget og som brief
      // 90 §4 fastholder overalt:
      //   Klar til levering:  ordrer hvor ALLE synlige linjer har
      //                       reserveret >= antal (klar på lager) og
      //                       intet er faerdigmeldt endnu
      //   Afventer ankomst:   resten af beløbet på ordrer der ikke er
      //                       hele klar (og ikke er reservation/EP)
      //   På reservation:     ordrer hvor alle synlige linjer er
      //                       levering=5 (kundens træk-mod-lager)
      //   En Primeur:         ordrer hvor alle synlige linjer er
      //                       status=21 (aftalte 1-2 år) og ikke klar
      //
      // Ordrer med blandet reservation + normale linjer havner i
      // afventer (hele ordre-beløbet), fordi ordren ikke kan sendes
      // som helhed. Blandede ordrer er meget sjældne — hvis de bliver
      // et problem, splitter vi definitionen op i et senere brief.
      let klarRaw = 0;
      let venterPaaAndreRaw = 0;
      let afventerRaw = 0;
      let enPrimeurRaw = 0;
      let paaReservationRaw = 0;
      for (const [, lines] of byOrdre) {
        // §11 opfølgning (29. sep 2026): par-komponent-linjer skjules
        // via viewets er_par_komponent-flag. Reservationen er allerede
        // overtaget af salgsvaren.
        const synligeLines = lines.filter((l) => !l.er_par_komponent);
        if (synligeLines.length === 0) continue;
        const ordreBelob = synligeLines.reduce(
          (s, l) => s + Number(l.ej_faktureret ?? 0),
          0,
        );
        const alleErReservation = synligeLines.every(
          (l) => l.levering === "5",
        );
        const alleErEnPrimeur = synligeLines.every((l) => l.status === "21");
        // Brief 90 §4-opfølgning: MAV = Levering=1. Ordre er MAV hvis
        // ALLE linjer har levering=1. Blandede ordrer findes ikke
        // (målt 0 af 354), så beregningen behøver ikke tackle dem.
        const alleErMav = synligeLines.every((l) => l.levering === "1");
        // §11 opfølgning (29. sep 2026): reserveret_effective bærer par-
        // detektionens overtagelse. Ordren er hele-klar når alle synlige
        // linjer har lagerstatus_effective = 'klar'.
        const alleKlar = synligeLines.every(
          (l) => l.lagerstatus_effective === "klar",
        );
        if (alleErReservation) {
          paaReservationRaw += ordreBelob;
        } else if (alleErEnPrimeur && !alleKlar) {
          enPrimeurRaw += ordreBelob;
        } else if (alleErMav && alleKlar) {
          venterPaaAndreRaw += ordreBelob;
        } else if (alleKlar) {
          klarRaw += ordreBelob;
        } else {
          afventerRaw += ordreBelob;
        }
      }
      // Brief 75 tillæg H (22. sep 2026): iAlt indeholder ALT. Afventer
      // beregnes som differencen så afrundingen ikke løber fra os:
      // iAlt − klar − paaReservation − enPrimeur. De tre sidste rundes
      // først; afventer er restforskellen. Det er samme princip som
      // tillæg C's opfølgning (302.791 + 397.086 = 699.877, ikke 699.876).
      const klar = Math.round(klarRaw);
      const venterPaaAndre = Math.round(venterPaaAndreRaw);
      const enPrimeur = Math.round(enPrimeurRaw);
      const paaReservation = Math.round(paaReservationRaw);
      const iAlt = Math.round(
        klarRaw +
          venterPaaAndreRaw +
          afventerRaw +
          enPrimeurRaw +
          paaReservationRaw,
      );
      const afventer =
        iAlt - klar - venterPaaAndre - enPrimeur - paaReservation;

      return {
        orders: out,
        totals: {
          klar,
          venterPaaAndre,
          afventer,
          enPrimeur,
          paaReservation,
          iAlt,
        },
      };
    },
  });
}
