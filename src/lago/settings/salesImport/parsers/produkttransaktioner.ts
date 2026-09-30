// Parser + tørløb for Produkttransaktioner → sales_monthly_lago.
//
// Filter (bekræftet mod direktørens rapport, 4. sep 2026):
//   Salgsdistrikt IN ('10 [Øst]', '11 [Vest]', '12 [HQ]') [via kunde-opslag]
//   AND Produktgruppe-nummer IN {settings.sales_product_groups}
//
// Produktgruppe-filteret hentes fra lago_settings — ikke hardkodet
// (rev 4. sep). Så kan produktafdelingen ændre det uden deploy.
//
// Aggregering: én række pr. (kundenr × år × måned × produktnr × salgstype).
// Produktnr er nødvendigt for FS-21 vareprøve-konvertering, FS-1
// købshistorik pr. produkt, FS-17 mersalg.

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
import type {
  DryRunResult,
  ProdukttransaktionerPayload,
  SalesMonthlyRow,
} from "../types";

// Brief 25: OSR-formatet bruger "Kundenr" (uden punktum), "Beløb"
// (uden "(kr)") og "Produktnr". Vi accepterer BEGGE varianter så 19b
// manuel fallback stadig virker — findFirstHeader vælger den første
// der findes, ellers rapporteres begge navne som mangler.
const REQUIRED_COLUMN_ALIASES: [string, ...string[]][] = [
  ["Kundenr", "Kundenr."],
  ["Fakturadato"],
  ["Beløb", "Beløb (kr)"],
  ["Produktgruppe"],
  ["Salgstype"],
  ["Produktnr", "Produktnr."],
  ["Antal"],
];

interface DistrictLookup {
  get(kundeNo: string): string | null | undefined;
  has(kundeNo: string): boolean;
}

export interface ProdukttransaktionerParseInput {
  file: File;
  districtLookup: DistrictLookup;
  /** Set af tilladte produktgruppe-numre (fra lago_settings). */
  acceptedProductGroups: Set<string>;
}

export async function parseProdukttransaktioner({
  file,
  districtLookup,
  acceptedProductGroups,
}: ProdukttransaktionerParseInput): Promise<
  DryRunResult<ProdukttransaktionerPayload>
> {
  const grid = await readExcelGrid(file);

  let headerRowIndex: number;
  try {
    // findHeaderRow prøver den kanoniske OSR-variant først; fallback
    // til 19b's "Kundenr." hvis ikke fundet.
    try {
      headerRowIndex = findHeaderRow(grid, "Kundenr");
    } catch {
      headerRowIndex = findHeaderRow(grid, "Kundenr.");
    }
  } catch {
    return {
      ok: false,
      rowsInFile: Math.max(0, grid.length - 1),
      rowsAfterFilter: 0,
      rowErrors: [],
      headerError: {
        kind: "header-missing",
        missingColumns: ["Kundenr / Kundenr. (header-rækken kunne ikke findes)"],
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
    kundenr: findFirstHeader(headerMap, ["Kundenr", "Kundenr."]),
    fakturadato: headerMap.get("Fakturadato")!,
    belob: findFirstHeader(headerMap, ["Beløb", "Beløb (kr)"]),
    produktgruppe: headerMap.get("Produktgruppe")!,
    salgstype: headerMap.get("Salgstype")!,
    produktnr: findFirstHeader(headerMap, ["Produktnr", "Produktnr."]),
    antal: headerMap.get("Antal")!,
    // Tillæg B: vareforbrug. Findes på alle 58.899 fakturalinjer.
    // Gemmes rå, aggregeres på samme nøgle som belob og antal.
    // Ingen visning — kolonnen er dækningsgrad-arsenalet.
    forbrugt: findFirstHeader(headerMap, ["Forbrugt"]),
  };

  const rawRows = grid.slice(headerRowIndex + 1);
  const rowErrors: DryRunResult<never>["rowErrors"] = [];
  const unknownCustomers = new Set<string>();
  const matchedCustomers = new Set<string>();

  // Aggregering: nøgle = kundenr|år|måned|produktnr|salgstype
  const aggregated = new Map<string, SalesMonthlyRow>();
  let rowsSeen = 0;
  let rowsAfterFilter = 0;
  // Fuldstændighed (brief 15. sep): gør rede for HVER række.
  let rowsSkippedNoKundenr = 0;
  let rowsSkippedProduktgruppe = 0;
  let rowsSkippedUnknownCustomer = 0;
  let rowsSkippedOtherDistrict = 0;
  let rowsSkippedInvalidDate = 0;
  const otherDistrikter = new Map<string, number>();

  const currentYear = new Date().getFullYear();
  const perMonth = new Map<string, number>();
  let aatdTotal = 0;
  let t12mTotal = 0;
  const t12mCutoff = new Date();
  t12mCutoff.setMonth(t12mCutoff.getMonth() - 12);

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => c == null || c === "")) continue;
    rowsSeen++;

    const kundenr = cellString(row[idx.kundenr]);
    if (!kundenr) {
      rowsSkippedNoKundenr++;
      continue;
    }

    const pgCode = cellCode(row[idx.produktgruppe]);
    if (!pgCode || !acceptedProductGroups.has(pgCode)) {
      rowsSkippedProduktgruppe++;
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
      const key = distrikt ?? "(uden distrikt)";
      otherDistrikter.set(key, (otherDistrikter.get(key) ?? 0) + 1);
      continue;
    }
    matchedCustomers.add(kundenr);

    const dateStr = cellDate(row[idx.fakturadato]);
    if (!dateStr) {
      rowsSkippedInvalidDate++;
      rowErrors.push({
        rowIndex: headerRowIndex + 1 + i + 1,
        message: `Ugyldig fakturadato: "${row[idx.fakturadato]}"`,
      });
      continue;
    }
    const [yStr, mStr] = dateStr.split("-");
    const aar = Number(yStr);
    const maaned = Number(mStr);

    const belob = cellNumber(row[idx.belob]) ?? 0;
    const antal = cellNumber(row[idx.antal]) ?? 0;
    const forbrugt =
      idx.forbrugt >= 0 ? (cellNumber(row[idx.forbrugt]) ?? 0) : 0;
    const salgstype = cellString(row[idx.salgstype]) ?? "";
    const produktnr = cellString(row[idx.produktnr]) ?? "";

    const key = `${kundenr}|${aar}|${maaned}|${produktnr}|${salgstype}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.belob += belob;
      existing.antal += antal;
      existing.forbrugt = (existing.forbrugt ?? 0) + forbrugt;
    } else {
      aggregated.set(key, {
        visma_customer_no: kundenr,
        aar,
        maaned,
        produktnr,
        salgstype,
        belob,
        antal,
        forbrugt,
      });
    }
    rowsAfterFilter++;

    const monthKey = `${yStr}-${mStr}`;
    perMonth.set(monthKey, (perMonth.get(monthKey) ?? 0) + belob);
    if (aar === currentYear) aatdTotal += belob;
    const rowDate = new Date(dateStr);
    if (rowDate >= t12mCutoff) t12mTotal += belob;
  }

  // Salgstype-fordeling — hjælper Jonas se PRØVE/PROMO-tælling
  const perSalgstype = new Map<string, { rows: number; belob: number }>();
  for (const r of aggregated.values()) {
    const key = r.salgstype || "(tom)";
    const cur = perSalgstype.get(key) ?? { rows: 0, belob: 0 };
    cur.rows += 1;
    cur.belob += r.belob;
    perSalgstype.set(key, cur);
  }

  const periodTotals = [
    { label: `ÅTD ${currentYear}`, belob: aatdTotal },
    { label: "T12M", belob: t12mTotal },
    ...Array.from(perMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, belob]) => ({ label, belob })),
  ];

  const totalBelob = Array.from(perMonth.values()).reduce((a, b) => a + b, 0);

  // Fuldstændighed: sum af inkluderet + alle udeladelser = rows_in_file.
  // NB: rowsAfterFilter tælles på RÅ rækker (før aggregering), så
  // summen matcher rows_in_file — ikke aggregated.size.
  const otherDistrikterLabel =
    otherDistrikter.size === 0
      ? ""
      : ` (${Array.from(otherDistrikter.entries())
          .map(([d, n]) => `${d}: ${n}`)
          .join(", ")})`;
  const invariant =
    rowsAfterFilter +
    rowsSkippedNoKundenr +
    rowsSkippedProduktgruppe +
    rowsSkippedUnknownCustomer +
    rowsSkippedOtherDistrict +
    rowsSkippedInvalidDate;
  rowErrors.unshift({
    rowIndex: 0,
    message:
      `Fuldstændighed: ${rowsAfterFilter} inkluderet + ` +
      `${rowsSkippedNoKundenr} uden kundenr + ` +
      `${rowsSkippedProduktgruppe} produktgruppe udenfor filter + ` +
      `${rowsSkippedUnknownCustomer} ukendte kunder + ` +
      `${rowsSkippedOtherDistrict} ikke-salgsdistrikt${otherDistrikterLabel} + ` +
      `${rowsSkippedInvalidDate} ugyldig fakturadato ` +
      `= ${invariant} af ${rowsSeen} rækker i fil` +
      (invariant === rowsSeen
        ? "  ✓"
        : `  ⚠️ AFVIGER MED ${rowsSeen - invariant}`),
  });

  return {
    ok: rowErrors.length === 0 || aggregated.size > 0,
    rowsInFile: rowsSeen,
    rowsAfterFilter,
    totalBelob,
    periodTotals,
    matchedCustomers: matchedCustomers.size,
    unknownCustomers: Array.from(unknownCustomers).sort(),
    categoryBreakdown: Array.from(perSalgstype.entries())
      .sort((a, b) => b[1].belob - a[1].belob)
      .map(([label, v]) => ({ label, rows: v.rows, belob: v.belob })),
    rowErrors,
    payload: Array.from(aggregated.values()),
  };
}
