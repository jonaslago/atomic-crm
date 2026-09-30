// §11a (30. sep 2026): parser for "Åbne ordrelinier - noter".
//
// 13 columns (VISMA duplicates "Ændret dato" — buildHeaderMap dedupes
// to ~12 unique names; we count raw cells instead for the column check).
//
// note_type is derived from the Produktnr column: value "inote" or
// "enote". There is no separate Notetype column. Rows where Produktnr
// is neither inote nor enote are rejected — they don't belong here.
//
// "Produktnr 2" is the control column that distinguishes the correct
// 13-column file from the wrong 12-column file.

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

const HEADER_PROBE = "Ordrenr";

const REQUIRED_COLUMNS = [
  "Ordrenr",
  "Linienr",
  "Produktnr",
  "Beskrivelse",
] as const;

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
  // Raw cell count — headerMap.size may be lower due to duplicate
  // column names (VISMA exports "Ændret dato" twice).
  const rawColCount = (grid[headerRowIndex] ?? []).filter(
    (c) => c != null && String(c).trim() !== "",
  ).length;

  const idx = {
    ordrenr: headerMap.get("Ordrenr")!,
    linjenr: headerMap.get("Linienr")!,
    produktnr: headerMap.get("Produktnr")!,
    beskrivelse: headerMap.get("Beskrivelse")!,
    aendret_dato:
      headerMap.get("Ændret dato") ?? headerMap.get("Aendret dato") ?? -1,
  };

  const rawRows = grid.slice(headerRowIndex + 1);
  const rowErrors: DryRunResult<never>["rowErrors"] = [];
  const payload: OpenOrderNoteRow[] = [];
  let rowsSeen = 0;
  let rowsSkippedMissing = 0;
  let rowsSkippedNotNote = 0;
  let inoteCount = 0;
  let enoteCount = 0;

  if (!hasControlColumn) {
    rowErrors.push({
      rowIndex: 0,
      message:
        `⚠️ Kontrolkolonnen "${CONTROL_COLUMN}" mangler (${rawColCount} kolonner fundet). ` +
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
    const produktnrRaw = cellString(row[idx.produktnr])?.toLowerCase();

    if (!ordrenr || !linjenr) {
      rowsSkippedMissing++;
      continue;
    }
    if (!beskrivelse) {
      rowsSkippedMissing++;
      continue;
    }

    // note_type derived from Produktnr — the only values that belong
    // in this file are "inote" and "enote". Everything else is rejected.
    if (produktnrRaw !== "inote" && produktnrRaw !== "enote") {
      rowsSkippedNotNote++;
      continue;
    }

    const noteType: "inote" | "enote" = produktnrRaw;
    if (noteType === "inote") inoteCount++;
    else enoteCount++;

    payload.push({
      ordre_nr: ordrenr,
      linje_nr: linjenr,
      produktnr: cellString(row[idx.produktnr]),
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
      `af ${rowsSeen} rækker. ` +
      `${rowsSkippedMissing} skippet (manglende nøgle/tekst). ` +
      `${rowsSkippedNotNote} afvist (Produktnr hverken inote/enote).`,
  });

  return {
    ok: payload.length > 0,
    rowsInFile: rowsSeen,
    rowsAfterFilter: payload.length,
    rowErrors,
    payload,
  };
}
