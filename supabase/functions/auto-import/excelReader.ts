/**
 * §95-2: Server-side Excel reader for Deno Edge Functions.
 *
 * Wraps SheetJS (xlsx) for Deno. The browser-side readExcelGrid()
 * in src/lago/settings/salesImport/excelUtils.ts takes a File object;
 * this version takes a Uint8Array (from Graph attachment contentBytes).
 *
 * The parsing helpers (findHeaderRow, buildHeaderMap, cellString, etc.)
 * are pure functions with no browser dependency — we inline the ones
 * we need here to avoid importing from src/ (different module system).
 */

/** Read an Excel file from bytes into a 2D array of raw cell values. */
export async function readExcelGridFromBytes(bytes: Uint8Array): Promise<unknown[][]> {
  // Lazy-load SheetJS to avoid loading 4MB at function startup
  const XLSX = await import("npm:xlsx@0.18.5");
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false, // format dates/numbers as strings — we normalise ourselves
  }) as unknown[][];
}

// ---------- Copied from excelUtils.ts (pure functions) ----------

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
  // ISO yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Danish dd-mm-yyyy or dd/mm/yyyy
  const dk = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dk) return `${dk[3]}-${dk[2]}-${dk[1]}`;
  // OSR M/D/YY
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
