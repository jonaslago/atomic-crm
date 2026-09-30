// Parser + tørløb for Produkter → products_lago.
//
// 2.465 rækker, ændrer sig sjældent. Uden denne fil kan et kundekort
// kun vise varenumre — produkttransaktionen har Produktnr, men ikke
// produktnavnet.

import {
  buildHeaderMap,
  cellNumber,
  cellString,
  checkRequiredColumnAliases,
  findFirstHeader,
  findHeaderRow,
  readExcelGrid,
} from "../excelUtils";
import type { DryRunResult, ProdukterPayload, ProduktRow } from "../types";

// Brief 25 §1: OSR bruger "Produktnr" (uden punktum) og "Produktgruppe"
// (ikke "Bogføringsgruppe" — det felt findes ikke i nogen VISMA-eksport).
// bogfoeringsgruppe er DROPPET på schemaet (§4.1) — produktgruppe er det
// alle filtre hviler på i forvejen.
const REQUIRED_COLUMN_ALIASES: [string, ...string[]][] = [
  ["Produktnr", "Produktnr."],
  ["Beskrivelse"],
  ["Produktgruppe", "Bogføringsgruppe"],
];

export interface ProdukterParseInput {
  file: File;
}

export async function parseProdukter({
  file,
}: ProdukterParseInput): Promise<DryRunResult<ProdukterPayload>> {
  const grid = await readExcelGrid(file);

  let headerRowIndex: number;
  try {
    try {
      headerRowIndex = findHeaderRow(grid, "Produktnr");
    } catch {
      headerRowIndex = findHeaderRow(grid, "Produktnr.");
    }
  } catch {
    return {
      ok: false,
      rowsInFile: Math.max(0, grid.length - 1),
      rowsAfterFilter: 0,
      rowErrors: [],
      headerError: {
        kind: "header-missing",
        missingColumns: ["Produktnr / Produktnr. (header-rækken kunne ikke findes)"],
        foundHeaders: [],
      },
    };
  }

  const headerMap = buildHeaderMap(grid[headerRowIndex]);
  const missing = checkRequiredColumnAliases(headerMap, REQUIRED_COLUMN_ALIASES);
  if (missing.length > 0) {
    return {
      ok: false,
      rowsInFile: Math.max(0, grid.length - headerRowIndex - 1),
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
    produktnr: findFirstHeader(headerMap, ["Produktnr", "Produktnr."]),
    beskrivelse: headerMap.get("Beskrivelse")!,
    // Brief 25 §1: Produktgruppe erstatter Bogføringsgruppe.
    produktgruppe: findFirstHeader(headerMap, ["Produktgruppe", "Bogføringsgruppe"]),
    // Brief 25 §1: OSR bruger "Landekode" i stedet for "Oprindelsesland".
    oprindelsesland: findFirstHeader(headerMap, ["Landekode", "Oprindelsesland"]),
    appellation: headerMap.get("Appellation") ?? -1,
    // Brief 25 §1: OSR bruger "Farve/Type" (stort T).
    farve_type: findFirstHeader(headerMap, [
      "Farve/Type",
      "Farve/type",
      "Farve / type",
      "Farve",
    ]),
    aargang: headerMap.get("Årgang") ?? -1,
    producent: headerMap.get("Producent") ?? -1,
    alc_pct: findFirstHeader(headerMap, ["Alc %", "Alc%"]),
    oekologi: headerMap.get("Økologi") ?? -1,
    status: headerMap.get("Status") ?? -1,
    lagerenhed: headerMap.get("Lagerenhed") ?? -1,
    ant_pr_kolli: findFirstHeader(headerMap, [
      "Ant. Pr kolli",
      "Ant. pr kolli",
      "Antal pr kolli",
    ]),
    // Brief 25 §4.2: lagerdata gemmes (byg ingen skærm nu).
    fysisk_beholdning: findFirstHeader(headerMap, ["Fysisk beholdning"]),
    reserveret: findFirstHeader(headerMap, ["Reserveret"]),
    tilgang: findFirstHeader(headerMap, ["Tilgang"]),
    realiseret_beholdning: findFirstHeader(headerMap, ["Realiseret beholdning"]),
  };

  const rawRows = grid.slice(headerRowIndex + 1);
  const payload: ProduktRow[] = [];
  const seen = new Set<string>();
  const perProduktgruppe = new Map<string, number>();
  const perStatus = new Map<string, number>();
  let rowsSeen = 0;
  // Fuldstændighed (brief 15. sep): gør rede for HVER række.
  let rowsSkippedMissingProduktnr = 0;
  let rowsSkippedDuplicate = 0;
  // Tillæg A §3: varer med status "0" er ikke på kodelisten — samme
  // slags som kunder uden distrikt. Rapportér, gem koden rå, hold
  // dem ude af "salgbar".
  const status0Codes: string[] = [];

  for (const row of rawRows) {
    if (!row || row.every((c) => c == null || c === "")) continue;
    rowsSeen++;

    const produktnr = cellString(row[idx.produktnr]);
    if (!produktnr) {
      rowsSkippedMissingProduktnr++;
      continue;
    }
    if (seen.has(produktnr)) {
      rowsSkippedDuplicate++;
      continue;
    }
    seen.add(produktnr);

    const produktgruppe = cellString(row[idx.produktgruppe]);
    const status = idx.status >= 0 ? cellString(row[idx.status]) : null;

    payload.push({
      produktnr,
      beskrivelse: cellString(row[idx.beskrivelse]),
      produktgruppe,
      oprindelsesland:
        idx.oprindelsesland >= 0 ? cellString(row[idx.oprindelsesland]) : null,
      appellation:
        idx.appellation >= 0 ? cellString(row[idx.appellation]) : null,
      farve_type:
        idx.farve_type >= 0 ? cellString(row[idx.farve_type]) : null,
      aargang: idx.aargang >= 0 ? cellString(row[idx.aargang]) : null,
      producent: idx.producent >= 0 ? cellString(row[idx.producent]) : null,
      alc_pct: idx.alc_pct >= 0 ? cellNumber(row[idx.alc_pct]) : null,
      oekologi: idx.oekologi >= 0 ? cellString(row[idx.oekologi]) : null,
      status,
      lagerenhed:
        idx.lagerenhed >= 0 ? cellString(row[idx.lagerenhed]) : null,
      ant_pr_kolli:
        idx.ant_pr_kolli >= 0 ? cellNumber(row[idx.ant_pr_kolli]) : null,
      // Brief 25 §4.2: lagerdata.
      fysisk_beholdning:
        idx.fysisk_beholdning >= 0
          ? cellNumber(row[idx.fysisk_beholdning])
          : null,
      reserveret:
        idx.reserveret >= 0 ? cellNumber(row[idx.reserveret]) : null,
      tilgang: idx.tilgang >= 0 ? cellNumber(row[idx.tilgang]) : null,
      realiseret_beholdning:
        idx.realiseret_beholdning >= 0
          ? cellNumber(row[idx.realiseret_beholdning])
          : null,
    });

    if (produktgruppe)
      perProduktgruppe.set(
        produktgruppe,
        (perProduktgruppe.get(produktgruppe) ?? 0) + 1,
      );
    if (status) perStatus.set(status, (perStatus.get(status) ?? 0) + 1);

    // Tillæg A §3: rapportér status=0 (ikke på kodelisten).
    const statusCode = status ? status.match(/^(\d+)/)?.[1] : null;
    if (statusCode === "0") {
      status0Codes.push(produktnr);
    }
  }

  const categoryBreakdown = [
    ...Array.from(perProduktgruppe.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, rows]) => ({
        label: `Produktgruppe: ${label}`,
        rows,
        belob: 0,
      })),
    ...Array.from(perStatus.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, rows]) => ({
        label: `Status: ${label}`,
        rows,
        belob: 0,
      })),
  ];

  const rowErrors: DryRunResult<never>["rowErrors"] = [];

  // Fuldstændighed: sum af inkluderet + udeladelser = rows_in_file.
  const invariant =
    payload.length +
    rowsSkippedMissingProduktnr +
    rowsSkippedDuplicate;
  rowErrors.push({
    rowIndex: 0,
    message:
      `Fuldstændighed: ${payload.length} inkluderet + ` +
      `${rowsSkippedMissingProduktnr} manglende produktnr + ` +
      `${rowsSkippedDuplicate} duplikat-produktnr (i samme fil) ` +
      `= ${invariant} af ${rowsSeen} rækker` +
      (invariant === rowsSeen
        ? "  ✓"
        : `  ⚠️ AFVIGER MED ${rowsSeen - invariant}`),
  });

  // Tillæg A §3: rapportér altid status=0-tælling. Nul er også et tal.
  rowErrors.push({
    rowIndex: 0,
    message:
      status0Codes.length === 0
        ? "0 varer med Status=0 (ikke på kodelisten). ✓"
        : `${status0Codes.length} varer med Status=0 (ikke på kodelisten — DQ-8): ${status0Codes.slice(0, 10).join(", ")}${status0Codes.length > 10 ? " …" : ""}`,
  });

  return {
    ok: payload.length > 0,
    rowsInFile: rowsSeen,
    rowsAfterFilter: payload.length,
    categoryBreakdown,
    rowErrors,
    payload,
  };
}
