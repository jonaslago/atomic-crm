/**
 * §95-2: Server-side Excel reader for Deno Edge Functions.
 *
 * SheetJS (~4MB) exceeds Supabase Edge Function memory limits.
 * This reader uses fflate (~8KB) to unzip the XLSX and parses the
 * XML directly. Only reads the first sheet. No write support needed.
 */

/** Convert Excel column letters to 0-based index. A=0, B=1, Z=25, AA=26 */
function colToIndex(letters: string): number {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

/** Read an Excel file from bytes into a 2D array of raw cell values. */
export async function readExcelGridFromBytes(
  bytes: Uint8Array,
): Promise<unknown[][]> {
  const { unzipSync } = await import("npm:fflate@0.8.2");
  const files = unzipSync(bytes);

  // Find the first worksheet
  const sheetKey = Object.keys(files).find((k) =>
    /xl\/worksheets\/sheet\d+\.xml$/.test(k),
  );
  if (!sheetKey) return [];
  const sheetXml = new TextDecoder().decode(files[sheetKey]);

  // Parse shared strings
  const ssKey = Object.keys(files).find((k) => k === "xl/sharedStrings.xml");
  const sharedStrings: string[] = [];
  if (ssKey) {
    const ssXml = new TextDecoder().decode(files[ssKey]);
    const siBlocks = ssXml.match(/<si[\s>][\s\S]*?<\/si>/g) ?? [];
    for (const block of siBlocks) {
      const parts = block.match(/<t[^>]*>([^<]*)<\/t>/g) ?? [];
      sharedStrings.push(
        parts.map((p) => p.replace(/<\/?t[^>]*>/g, "")).join(""),
      );
    }
  }

  // Parse rows
  const rows: unknown[][] = [];
  const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
  const cellRegex =
    /<c\s[^>]*r="([A-Z]+)\d+"[^>]*(?:\st="([^"]*)")?[^>]*>(?:[\s\S]*?<v>([^<]*)<\/v>)?[\s\S]*?<\/c>/g;

  let rowMatch;
  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const cellsXml = rowMatch[1];
    const row: unknown[] = [];
    let cellMatch;
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(cellsXml)) !== null) {
      const col = colToIndex(cellMatch[1]);
      const type = cellMatch[2]; // s=shared string
      const rawVal = cellMatch[3];

      while (row.length <= col) row.push(null);

      if (rawVal == null || rawVal === "") {
        row[col] = null;
      } else if (type === "s") {
        row[col] = sharedStrings[parseInt(rawVal, 10)] ?? rawVal;
      } else {
        row[col] = rawVal;
      }
    }
    if (row.length > 0) rows.push(row);
  }

  return rows;
}

// ---------- Pure parsing helpers (copied from excelUtils.ts) ----------

export function findHeaderRow(
  grid: unknown[][],
  canonicalHeader: string,
): number {
  const norm = canonicalHeader.trim().toLowerCase();
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const row = grid[i];
    if (!row) continue;
    for (const cell of row) {
      if (typeof cell === "string" && cell.trim().toLowerCase() === norm) {
        return i;
      }
    }
  }
  throw new Error(
    `Header row not found. Searched for "${canonicalHeader}" in the first 20 rows.`,
  );
}

export function buildHeaderMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    if (typeof cell === "string" && cell.trim().length > 0) {
      map.set(cell.trim(), i);
    }
  }
  return map;
}

export function cellString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

export function cellNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const normalised =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.includes(",")
        ? s.replace(",", ".")
        : s;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

export function cellDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dk = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dk) return `${dk[3]}-${dk[2]}-${dk[1]}`;
  const osr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (osr) {
    const yy = Number(osr[3]);
    const yyyy = yy < 50 ? 2000 + yy : 1900 + yy;
    const mm = String(osr[1]).padStart(2, "0");
    const dd = String(osr[2]).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

export function cellCode(v: unknown): string | null {
  const s = cellString(v);
  if (!s) return null;
  return s.replace(/\s+/g, "");
}

export function findFirstHeader(
  headerMap: Map<string, number>,
  aliases: readonly string[],
): number {
  for (const name of aliases) {
    const idx = headerMap.get(name);
    if (idx !== undefined) return idx;
  }
  return -1;
}

export function checkRequiredColumnAliases(
  headerMap: Map<string, number>,
  aliasGroups: readonly (readonly string[])[],
): string[] {
  const missing: string[] = [];
  for (const aliases of aliasGroups) {
    if (findFirstHeader(headerMap, aliases) === -1) {
      missing.push(aliases.join(" / "));
    }
  }
  return missing;
}
