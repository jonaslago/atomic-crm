// Parser + tørløb for Åbne ordrer → open_orders_lago (Brief 25).
//
// OSR-formatet leverer ÉN fil med både ordrehoved- og ordrelinje-felter
// samlet. 19b's to-fil-flow er væk. Kategorien udledes i view
// (v_open_orders_categorised, brief 25 §2) — her udføres kun:
//
//   1. Filter: Undtages lagerhåndtering = 1 → dropped (brief 25 §2 pkt 0)
//   2. Spærring: Ordrestatus 11/12/19/20 → afvis med tørløbs-fejl (brief §4b)
//   3. rest beregnes = Antal − Antal færdigmeldt (brief §2)
//   4. Tørløbs-optælling per kategori matcher view-kategorierne 1-til-1
//
// Datoer:
//   - "Ønsket lev. Dato" (OSR) → oensket_leveringsdato
//   - Færdigmeldingsdato: findes ikke i OSR pt. — tom.
//
// Datoer + kolonner: se projektgrundlag/VISMA_datamodel_og_ordretyper.md §3c.

import {
  buildHeaderMap,
  cellCode,
  cellDate,
  cellNumber,
  cellString,
  checkRequiredColumnAliases,
  findFirstHeader,
  findHeaderRow,
  readExcelGrid,
} from "../excelUtils";
import type { AabneOrdrerPayload, DryRunResult, OpenOrderRow } from "../types";

// Én fil, ikke to. OSR-navnene er kanoniske; 19b-varianter accepteres
// som fallback for at holde manuel-eksport-flowet i live.
const REQUIRED_COLUMN_ALIASES: [string, ...string[]][] = [
  ["Ordrenr", "Ordrenr."],
  ["Linienr", "Linjenr.", "Linjenr"],
  ["Kundenr", "Kundenr."],
  ["Ordredato"],
  ["Ordrestatus", "Status"],
  ["Levering", "Ordreart"],
  ["Ønsket lev. Dato", "Ønsket leveringsdato"],
  ["Produktnr", "Produktnr."],
  ["Produktgruppe"],
  ["Salgstype"],
  ["Antal"],
  ["Beløb", "Ej faktureret"],
];

// Brief 25 §4b: indkøbsordrer skal aldrig lande i salgs-tabellen.
// Ordregruppering 5 dækker BEGGE i VISMA — så et salgsordre-udtræk med
// disse koder er tilgang, ikke omsætning, og linjen skal afvises med
// tydelig fejl i tørløbet.
const INDKOEBS_STATUS_KODER = new Set(["11", "12", "19", "20"]);

interface DistrictLookup {
  get(kundeNo: string): string | null | undefined;
  has(kundeNo: string): boolean;
}

export interface AabneOrdrerParseInput {
  // Brief 25: ÉN fil. Ikke længere hovedFile + linjeFile.
  file: File;
  districtLookup: DistrictLookup;
}

export async function parseAabneOrdrer({
  file,
  districtLookup,
}: AabneOrdrerParseInput): Promise<DryRunResult<AabneOrdrerPayload>> {
  const grid = await readExcelGrid(file);

  let headerRowIndex: number;
  try {
    try {
      headerRowIndex = findHeaderRow(grid, "Ordrenr");
    } catch {
      headerRowIndex = findHeaderRow(grid, "Ordrenr.");
    }
  } catch {
    return {
      ok: false,
      rowsInFile: 0,
      rowsAfterFilter: 0,
      rowErrors: [],
      headerError: {
        kind: "header-missing",
        missingColumns: [
          "Ordrenr / Ordrenr. (header-rækken kunne ikke findes)",
        ],
        foundHeaders: [],
      },
    };
  }

  const headerMap = buildHeaderMap(grid[headerRowIndex]);
  const missing = checkRequiredColumnAliases(
    headerMap,
    REQUIRED_COLUMN_ALIASES,
  );
  if (missing.length > 0) {
    return {
      ok: false,
      rowsInFile: 0,
      rowsAfterFilter: 0,
      rowErrors: [],
      headerError: {
        kind: "header-missing",
        missingColumns: missing,
        foundHeaders: Array.from(headerMap.keys()),
      },
    };
  }

  const idx = {
    ordrenr: findFirstHeader(headerMap, ["Ordrenr", "Ordrenr."]),
    linjenr: findFirstHeader(headerMap, ["Linienr", "Linjenr.", "Linjenr"]),
    kundenr: findFirstHeader(headerMap, ["Kundenr", "Kundenr."]),
    ordredato: headerMap.get("Ordredato")!,
    // status = OSRs "Ordrestatus" — gemmes i kolonnen open_orders_lago.status
    status: findFirstHeader(headerMap, ["Ordrestatus", "Status"]),
    // levering = OSRs "Levering" — gemmes i kolonnen open_orders_lago.levering
    // Erstatter 19b's "Ordreart" som primær kategori-input.
    levering: findFirstHeader(headerMap, ["Levering", "Ordreart"]),
    oensket_lev: findFirstHeader(headerMap, [
      "Ønsket lev. Dato",
      "Ønsket leveringsdato",
    ]),
    produktnr: findFirstHeader(headerMap, ["Produktnr", "Produktnr."]),
    produktgruppe: headerMap.get("Produktgruppe")!,
    kundeprisgruppe: headerMap.get("Kundeprisgruppe 1") ?? -1,
    salgstype: headerMap.get("Salgstype")!,
    antal: headerMap.get("Antal")!,
    // Tillæg B: Antal færdigmeldt er 0 på alle åbne linjer per
    // definition. Vi læser den stadig så rest = antal - færdigmeldt
    // kan efterprøves, men lager-status kommer nu fra reserveret.
    antal_faerdigmeldt: findFirstHeader(headerMap, [
      "Antal færdigmeldt",
      "Antal faerdigmeldt",
    ]),
    // Tillæg B: KILDEN for lagerstatus. "Reserveret mod lager"
    // (positivt = klar, delvist = delvis, ≤ 0 = restordre).
    reserveret_mod_lager: findFirstHeader(headerMap, [
      "Reserveret mod lager",
      "Reserveret mod. lager",
    ]),
    // Tillæg B: vareforbrug pr. linje. Gemmes rå, ingen visning nu.
    forbrugt: findFirstHeader(headerMap, ["Forbrugt"]),
    belob: findFirstHeader(headerMap, ["Beløb", "Ej faktureret"]),
    kampagne: headerMap.get("Kampagne") ?? -1,
    saelger: findFirstHeader(headerMap, ["Sælger", "Sælger/indkøber"]),
    faerdigmelding: headerMap.get("Færdigmeldingsdato") ?? -1,
    sellerno: headerMap.get("Sellerno") ?? -1,
    // Brief 25 §2 pkt 0 · rev. brief 78 §1 (22. sep 2026): flaget læses
    // stadig, men bruges IKKE længere som filter. Alle linjer importeres;
    // par-håndtering (salgsvare + komponent) sker i visnings-laget.
    undtages_lagerhaandtering: findFirstHeader(headerMap, [
      "Undtages lagerhåndtering",
      "Undtages lagerhaandtering",
    ]),
    // Brief 78 tillæg A §3 (22. sep 2026): OSRs "Note"-kolonne. Ens på
    // alle linjer i samme ordre — reelt en ordre-note. Vises i ordrens
    // hoved.
    note: findFirstHeader(headerMap, ["Note"]),
  };

  const rawRows = grid.slice(headerRowIndex + 1);
  const rowErrors: DryRunResult<never>["rowErrors"] = [];
  const unknownCustomers = new Set<string>();
  const matchedCustomers = new Set<string>();
  const payload: OpenOrderRow[] = [];
  let rowsSeen = 0;
  let rowsAfterFilter = 0;
  // Fuldstændighed (brief 15. sep): rapportér HVER række der forsvinder.
  // Sum af inkluderet + alle udeladte-årsager = rows_in_file. Går den
  // ikke op, er der en linje ingen kan forklare — og det er præcis
  // det, "et tal, der ikke kan efterprøves, er bare et tal" advarer om.
  // Brief 78 §1: rowsFilteredUndtages hed før filteret var på. Nu tælles
  // flaget uden at det er blokkende.
  let rowsUndtages = 0;
  let rowsRejectedIndkoeb = 0;
  let rowsSkippedMissingId = 0;
  let rowsSkippedUnknownCustomer = 0;
  let rowsSkippedOtherDistrict = 0;
  let rowsSkippedInvalidDate = 0;
  const otherDistrikter = new Map<string, number>();

  // Tillæg B: fem-kategori-kaskade + tre uafhængige tællinger for
  // lager/mav/dato. Summen af lagerstatus skal være lig antallet af
  // linjer efter filteret (invariant fra tillæg B).
  const categoryTotals: Record<string, { rows: number; belob: number }> = {
    fejl: { rows: 0, belob: 0 },
    ikke_kundeordre: { rows: 0, belob: 0 },
    reservation: { rows: 0, belob: 0 },
    en_primeur: { rows: 0, belob: 0 },
    normal: { rows: 0, belob: 0 },
  };
  const lagerTotals: Record<string, { rows: number; belob: number }> = {
    klar: { rows: 0, belob: 0 },
    delvis: { rows: 0, belob: 0 },
    restordre: { rows: 0, belob: 0 },
  };
  let n_mav = 0;
  let n_har_oensket_dato = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => c == null || c === "")) continue;
    rowsSeen++;

    // Brief 78 §1 (22. sep 2026): tidligere filtrerede vi Undtages=1
    // ud FØR alt andet. Det droppede kundens prissatte linjer (AEvin
    // #34696·1: 91801-Jul, 3.163,80 kr., undtages=1 forsvandt; kun
    // komponenten 91801 med 0 kr. og 8 reserveret blev importeret).
    // Filteret er væk — flaget bevares som kolonne, par-håndtering
    // sker i visnings-laget.
    const undtages =
      idx.undtages_lagerhaandtering >= 0 &&
      cellCode(row[idx.undtages_lagerhaandtering]) === "1";
    if (undtages) rowsUndtages++;

    const ordrenr = cellString(row[idx.ordrenr]);
    const linjenr = cellString(row[idx.linjenr]);
    if (!ordrenr || !linjenr) {
      rowsSkippedMissingId++;
      continue;
    }

    const kundenr = cellString(row[idx.kundenr]);
    if (!kundenr) {
      rowsSkippedMissingId++;
      continue;
    }

    const statusCode = cellCode(row[idx.status]);

    // Brief 25 §4b: indkøbsordrer afvises med tydelig fejl. Salgsordre-
    // filer må ikke indeholde disse status-koder — dukker de op, er det
    // tilgang, ikke omsætning.
    if (statusCode && INDKOEBS_STATUS_KODER.has(statusCode)) {
      rowsRejectedIndkoeb++;
      rowErrors.push({
        rowIndex: headerRowIndex + 1 + i + 1,
        message: `Ordrenr ${ordrenr} linje ${linjenr}: Ordrestatus ${statusCode} er en indkøbsordre (tilgang fra leverandør), ikke en salgsordre. Linjen afvises.`,
      });
      continue;
    }

    if (!districtLookup.has(kundenr)) {
      unknownCustomers.add(kundenr);
      rowsSkippedUnknownCustomer++;
      continue;
    }
    const distrikt = districtLookup.get(kundenr);
    if (distrikt !== "Øst" && distrikt !== "Vest" && distrikt !== "HQ") {
      rowsSkippedOtherDistrict++;
      // Tæl hvilke distrikter linjerne kommer fra, så rapporten er
      // brugbar (Intern? Eksport?).
      const key = distrikt ?? "(uden distrikt)";
      otherDistrikter.set(key, (otherDistrikter.get(key) ?? 0) + 1);
      continue;
    }
    matchedCustomers.add(kundenr);

    const antal = cellNumber(row[idx.antal]) ?? 0;
    const antal_faerdigmeldt =
      idx.antal_faerdigmeldt >= 0
        ? (cellNumber(row[idx.antal_faerdigmeldt]) ?? 0)
        : 0;

    // Tillæg B: lagerstatus kommer fra "Reserveret mod lager"
    // sammenholdt med Antal. Null → behandles som ≤ 0 (restordre).
    const reserveret_mod_lager =
      idx.reserveret_mod_lager >= 0
        ? cellNumber(row[idx.reserveret_mod_lager])
        : null;
    const rml = reserveret_mod_lager ?? 0;
    let lagerstatus: "klar" | "delvis" | "restordre";
    if (rml >= antal) lagerstatus = "klar";
    else if (rml > 0) lagerstatus = "delvis";
    else lagerstatus = "restordre";

    // Brief 78 tillæg A §1 (22. sep 2026): rest = Antal − Reserveret
    // mod lager. VISMAs egen formel ("I rest"). Den forrige regel
    // (antal − antal_faerdigmeldt) var altid lig antal fordi LAGO
    // aldrig dellevererer på samme ordre. Vi bevarer antal_faerdigmeldt
    // som rå-felt, men rest kommer nu fra lagerreservationen.
    const rest_beregnet = antal - rml;

    const forbrugt = idx.forbrugt >= 0 ? cellNumber(row[idx.forbrugt]) : null;

    const belob = cellNumber(row[idx.belob]) ?? 0;
    const ordredato = cellDate(row[idx.ordredato]);
    if (!ordredato) {
      rowsSkippedInvalidDate++;
      continue;
    }
    const oensket_leveringsdato = cellDate(row[idx.oensket_lev]);
    const faerdigmelding =
      idx.faerdigmelding >= 0 ? cellDate(row[idx.faerdigmelding]) : null;

    const leveringRaw = cellString(row[idx.levering]);
    const leveringCode = cellCode(row[idx.levering]);

    // Tillæg B: mav og har_oensket_dato som EGNE felter — de kan
    // være sande samtidig med enhver kategori (undtaget filtrerede).
    const mav = leveringCode === "1";
    const har_oensket_dato = oensket_leveringsdato !== null;

    const line: OpenOrderRow = {
      ordre_nr: ordrenr,
      linje_nr: linjenr,
      visma_customer_no: kundenr,
      ordre_dato: ordredato,
      // Brief 25: ordreart er deprecated; skrives ikke af OSR-importen.
      ordreart: null,
      // Ny primær kategori-input.
      levering: leveringRaw,
      status: cellString(row[idx.status]),
      kampagne: idx.kampagne >= 0 ? cellString(row[idx.kampagne]) : null,
      saelger: idx.saelger >= 0 ? cellString(row[idx.saelger]) : null,
      produktnr: cellString(row[idx.produktnr]),
      produktgruppe: cellString(row[idx.produktgruppe]),
      kundeprisgruppe:
        idx.kundeprisgruppe >= 0 ? cellString(row[idx.kundeprisgruppe]) : null,
      salgstype: cellString(row[idx.salgstype]),
      antal,
      antal_faerdigmeldt,
      rest: rest_beregnet,
      // Brief 25: i_rest er deprecated fossil. Skrives ikke.
      i_rest: null,
      ej_faktureret: belob,
      oensket_leveringsdato,
      faerdigmeldingsdato: faerdigmelding,
      sellerno: idx.sellerno >= 0 ? cellString(row[idx.sellerno]) : null,
      // Tillæg B — fire nye felter:
      reserveret_mod_lager,
      lagerstatus,
      mav,
      har_oensket_dato,
      forbrugt,
      // Brief 78 tillæg A §3 + §1:
      note: idx.note >= 0 ? cellString(row[idx.note]) : null,
      undtages_lagerhaandtering: undtages,
    };
    payload.push(line);
    rowsAfterFilter++;

    // Tørløbs-kategorisering — Tillæg B: fem-kategori-kaskade.
    let kategori: keyof typeof categoryTotals;
    if (statusCode === "50" || statusCode === "51") kategori = "fejl";
    else if (statusCode === "23" || statusCode === "30")
      kategori = "ikke_kundeordre";
    else if (leveringCode === "5") kategori = "reservation";
    else if (statusCode === "21") kategori = "en_primeur";
    else kategori = "normal";
    categoryTotals[kategori].rows += 1;
    categoryTotals[kategori].belob += belob;

    // Tillæg B: uafhængige tællinger. mav/har_oensket_dato kan være
    // sande samtidig med normal (eller en_primeur eller reservation).
    lagerTotals[lagerstatus].rows += 1;
    lagerTotals[lagerstatus].belob += belob;
    if (mav) n_mav++;
    if (har_oensket_dato) n_har_oensket_dato++;
  }

  const totalBelob = Object.values(categoryTotals).reduce(
    (sum, c) => sum + c.belob,
    0,
  );

  // Fuldstændighed: rapportér HVER kategori af udeladelse med årsag.
  // Summen af inkluderet + alle udeladelser = rows_in_file.
  const otherDistrikterLabel =
    otherDistrikter.size === 0
      ? ""
      : ` (${Array.from(otherDistrikter.entries())
          .map(([d, n]) => `${d}: ${n}`)
          .join(", ")})`;
  // Brief 78 §1: rowsUndtages er ikke længere en udeladelse — tælles
  // som note (fx "64 Undtages=1"), ikke som et sub-tal i invariant.
  const invariantCheck =
    rowsAfterFilter +
    rowsRejectedIndkoeb +
    rowsSkippedMissingId +
    rowsSkippedUnknownCustomer +
    rowsSkippedOtherDistrict +
    rowsSkippedInvalidDate;
  rowErrors.push({
    rowIndex: 0,
    message:
      `Fuldstændighed: ${rowsAfterFilter} inkluderet + ` +
      `${rowsRejectedIndkoeb} indkøbsordrer (Status 11/12/19/20) + ` +
      `${rowsSkippedMissingId} manglende ordre/linje/kundenr + ` +
      `${rowsSkippedUnknownCustomer} ukendte kunder (ikke i CRM) + ` +
      `${rowsSkippedOtherDistrict} ikke-salgsdistrikt${otherDistrikterLabel} + ` +
      `${rowsSkippedInvalidDate} ugyldig ordredato ` +
      `= ${invariantCheck} af ${rowsSeen} rækker i fil` +
      (invariantCheck === rowsSeen
        ? "  ✓"
        : `  ⚠️ AFVIGER MED ${rowsSeen - invariantCheck} — en linje kan ikke forklares`) +
      ` · heraf ${rowsUndtages} med Undtages lagerhåndtering=1 (par-håndteres i visning, brief 78 §1)`,
  });

  return {
    ok: payload.length > 0 || rowsUndtages > 0,
    rowsInFile: rowsSeen,
    rowsAfterFilter,
    totalBelob,
    matchedCustomers: matchedCustomers.size,
    unknownCustomers: Array.from(unknownCustomers).sort(),
    categoryBreakdown: [
      // Kategori (fem — exclusive kaskade)
      { label: "kategori: normal", ...categoryTotals.normal },
      {
        label: "kategori: reservation (Levering = 5)",
        ...categoryTotals.reservation,
      },
      {
        label: "kategori: en_primeur (Ordrestatus = 21)",
        ...categoryTotals.en_primeur,
      },
      { label: "kategori: fejl (Ordrestatus 50/51)", ...categoryTotals.fejl },
      {
        label: "kategori: ikke_kundeordre (Personalekøb/Udlån 23/30)",
        ...categoryTotals.ikke_kundeordre,
      },
      // Lagerstatus (tre — exclusive, sum = alle linjer)
      { label: "lagerstatus: klar (reserveret ≥ antal)", ...lagerTotals.klar },
      {
        label: "lagerstatus: delvis (0 < reserveret < antal)",
        ...lagerTotals.delvis,
      },
      {
        label: "lagerstatus: restordre (reserveret ≤ 0)",
        ...lagerTotals.restordre,
      },
      // Uafhængige (kan overlappe med enhver kategori)
      { label: "mav (Levering = 1)", rows: n_mav, belob: 0 },
      { label: "har_oensket_dato", rows: n_har_oensket_dato, belob: 0 },
    ],
    rowErrors,
    payload,
  };
}
