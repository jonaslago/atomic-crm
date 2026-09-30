// §11a (30. sep 2026): parser for "Åbne ordrelinier - noter".
//
// 13 columns. The correct file has "Produktnr 2" as a control column
// and the distribution inote 8.820 · enote 1.652. The wrong file has
// 12 columns and inote on every row.
//
// Returns one row per (ordre_nr, linje_nr) for open_order_notes_lago.
// No interpretation — raw text in linje_nr order (§11c).
// note_type is stored but not displayed (§11d).

import {
  buildHeaderMap,
  cellDate,
  cellString,
  findHeaderRow,
  readExcelGrid,
} from "../excelUtils";
import type { DryRunResult } from "../types";

export interface OpenOrderNoteRow {
  ordre_nr: string;
  linje_nr: string;
  produktnr: string | null;
  note_type: "inote" | "enote";
  beskrivelse: string;
  aendret_dato: string | null;
}

export type OpenOrderNotesPayload = OpenOrderNoteRow[];

// The canonical header to find the header row.
const HEADER_PROBE = "Ordrenr";

// Required columns — if any is missing, the file is wrong.
const REQUIRED_COLUMNS = [
  "Ordrenr",
  "Linienr",
  "Beskrivelse",
  "Notetype",
] as const;

// §11a control: "Produktnr 2" distinguishes the correct 13-column file
// from the wrong 12-column file. We warn but don't block — the data is
// still usable without it.
const CONTROL_COLUMN = "Produktnr 2";

export async function parseAabneOrdreNoter(
  file: File,
): Promise<DryRunResult<OpenOrderNotesPayload>> {
  const grid = await readExcelGrid(file);

  let headerRowIndex: number;
  try {
    headerRowIndex = findHeaderRow(grid, HEADER_PROBE);
  } catch {
    return {
      ok: false,
      rowsInFile: 0,
      rowsAfterFilter: 0,
      rowErrors: [],
      headerError: {
        kind: "header-missing",
        missingColumns: [`${HEADER_PROBE} (header row not found)`],
        foundHeaders: [],
      },
    };
  }

  const headerMap = buildHeaderMap(grid[headerRowIndex]);
  const missing = REQUIRED_COLUMNS.filter((col) => !headerMap.has(col));
  if (missing.length > 0) {
    return {
      ok: false,
      rowsInFile: 0,
      rowsAfterFilter: 0,
      rowErrors: [],
      headerError: {
        kind: "header-missing",
        missingColumns: missing as unknown as string[],
        foundHeaders: Array.from(headerMap.keys()),
      },
    };
  }

  const hasControlColumn = headerMap.has(CONTROL_COLUMN);
  const colCount = headerMap.size;

  const idx = {
    ordrenr: headerMap.get("Ordrenr")!,
    linjenr: headerMap.get("Linienr")!,
    produktnr: headerMap.get("Produktnr") ?? -1,
    beskrivelse: headerMap.get("Beskrivelse")!,
    notetype: headerMap.get("Notetype")!,
    aendret_dato:
      headerMap.get("Ændret dato") ?? headerMap.get("Aendret dato") ?? -1,
  };

  const rawRows = grid.slice(headerRowIndex + 1);
  const rowErrors: DryRunResult<never>["rowErrors"] = [];
  const payload: OpenOrderNoteRow[] = [];
  let rowsSeen = 0;
  let rowsSkipped = 0;
  let inoteCount = 0;
  let enoteCount = 0;

  // §11a: warn if the control column is missing — likely wrong file.
  if (!hasControlColumn) {
    rowErrors.push({
      rowIndex: 0,
      message:
        `⚠️ Kontrolkolonnen "${CONTROL_COLUMN}" mangler (${colCount} kolonner fundet). ` +
        `Den rigtige fil har 13 kolonner inkl. "${CONTROL_COLUMN}". ` +
        `Filen med 12 kolonner og inote på hver række er den forkerte kørsel.`,
    });
  }

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => c == null || c === "")) continue;
    rowsSeen++;

    const ordrenr = cellString(row[idx.ordrenr]);
    const linjenr = cellString(row[idx.linjenr]);
    const beskrivelse = cellString(row[idx.beskrivelse]);
    const notetypeRaw = cellString(row[idx.notetype])?.toLowerCase();

    if (!ordrenr || !linjenr) {
      rowsSkipped++;
      continue;
    }
    if (!beskrivelse) {
      rowsSkipped++;
      continue;
    }

    const noteType: "inote" | "enote" =
      notetypeRaw === "enote" ? "enote" : "inote";
    if (noteType === "inote") inoteCount++;
    else enoteCount++;

    payload.push({
      ordre_nr: ordrenr,
      linje_nr: linjenr,
      produktnr: idx.produktnr >= 0 ? cellString(row[idx.produktnr]) : null,
      note_type: noteType,
      beskrivelse,
      aendret_dato:
        idx.aendret_dato >= 0 ? cellDate(row[idx.aendret_dato]) : null,
    });
  }

  rowErrors.push({
    rowIndex: 0,
    message:
      `${payload.length} noter (inote: ${inoteCount}, enote: ${enoteCount}) ` +
      `af ${rowsSeen} rækker. ${rowsSkipped} skippet (manglende nøgle/tekst).`,
  });

  return {
    ok: payload.length > 0,
    rowsInFile: rowsSeen,
    rowsAfterFilter: payload.length,
    rowErrors,
    payload,
  };
}
