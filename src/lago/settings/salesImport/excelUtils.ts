// Shared Excel-parsing helpers for the sales-import UI.
//
// SheetJS (xlsx) er lazy-loaded ved første kald — pakken er ~1 MB og
// skal ikke bundles i main.js. Faktisk brug: én gang pr. importsession.
//
// Nøgle-princippet fra brief 19b:
//   "Aldrig positionsbaseret mapping, aldrig gæt — flere af felterne
//    er lokalt tilføjede og kan blive omdøbt."
// Vi finder headerrækken ved at søge efter en kanonisk kolonne (fx
// "Kundenr." eller "Ordrenr."), og mapper alle andre efter navn.

let xlsxModulePromise: Promise<typeof import("xlsx")> | null = null;

async function loadXlsx(): Promise<typeof import("xlsx")> {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx");
  }
  return xlsxModulePromise;
}

/** Læs en Excel-fil til et 2D-array (rå celleværdier, ingen header-
 *  antagelse). Klienten bestemmer selv hvor headerrækken er. */
export async function readExcelGrid(file: File): Promise<unknown[][]> {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false, // formater datoer/tal som strenge — vi normaliserer selv
  }) as unknown[][];
}

/** Find den række-index (0-baseret) hvor headerrækken ligger. Søger
 *  efter en af de kanoniske kolonner. Kaster hvis intet match — dét er
 *  filens første fejl-signal. */
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
    `Fandt ikke headerrækken. Søgte efter "${canonicalHeader}" i de første 20 rækker.`,
  );
}

/** Byg en {headerName → columnIndex}-map fra header-rækken. */
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

/** Verificér at alle krævede kolonner er til stede. Returnerer listen
 *  af manglende — tom liste = alt ok. */
export function checkRequiredColumns(
  headerMap: Map<string, number>,
  required: readonly string[],
): string[] {
  return required.filter((col) => !headerMap.has(col));
}

/**
 * Brief 25: OSR-formatet og det gamle 19b-format bruger delvist
 * forskellige kolonnenavne (fx "Kundenr" vs "Kundenr."). Denne helper
 * lader parseren pege på FLERE mulige navne pr. required-felt og
 * accepterer den første der findes. Rapporterer alle alternativer som
 * "mangler" hvis intet match, så importsiden viser klare fejlmeldinger.
 */
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
      // Rapportér ALLE alternativer så importsiden viser hvad importen
      // vil acceptere, ikke bare det første navn.
      missing.push(aliases.join(" / "));
    }
  }
  return missing;
}

// -------------- Value coercion --------------

export function cellString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/** Parse et tal fra en celle. VISMA-eksporten kan bruge komma eller
 *  punktum som decimalseparator, og tusindtalsseparator kan være
 *  punktum. "12.345,67" og "12345.67" skal begge give 12345.67. */
export function cellNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  // Fjern tusindtalspunktummer, konverter decimal-komma til punktum.
  // Håndterer "12.345,67" → "12345.67" og "12345,67" → "12345.67".
  // Bevarer "12345.67" (ingen tusindtal, punktum-decimal).
  const normalised =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.includes(",")
        ? s.replace(",", ".")
        : s;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

/** Parse en dato. Understøtter tre inputformater — vi tvinger ISO
 *  YYYY-MM-DD som output.
 *
 *  1. ISO: yyyy-mm-dd (VISMAs Ordrer-eksport, egne timestamps)
 *  2. Dansk 4-cifret år: dd-mm-yyyy eller dd/mm/yyyy (19b manuel eksport)
 *  3. OSR 2-cifret år: M/D/YY eller MM/DD/YY — amerikansk konvention.
 *     OneStopReporting eksporterer datoer sådan by default.
 *
 *  Hvis 2-cifret år: månedsdag først (amerikansk), for OSR bruger det
 *  format og bekræftet mod dagens fil (rækker som "5/21/25" og
 *  "11/26/24" har dag > 12 i midten, hvilket kun giver mening som M/D/YY).
 *  2-cifret år: 00-49 → 2000-2049, 50-99 → 1950-1999.
 *
 *  Excel-serial (raw:true) håndteres separat øverst. */
export function cellDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") {
    // Excel serial → JS Date. Excel epoch: 1899-12-30 (leap-bug offset).
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (!s) return null;

  // yyyy-mm-dd (ISO)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // 4-cifret år: dd-mm-yyyy eller dd/mm/yyyy (dansk konvention)
  const dmY4 = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmY4) {
    const [, d, m, y] = dmY4;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 2-cifret år: M/D/YY (amerikansk — OSR default). Antag mmddyy.
  const mdY2 = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (mdY2) {
    const [, m, d, y2] = mdY2;
    const y2n = Number(y2);
    const yyyy = y2n < 50 ? 2000 + y2n : 1900 + y2n;
    return `${yyyy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

/** VISMA-værdier med tal-prefix ("10 [Øst]" / "1 [Vin]") — tag tallet
 *  foran klammen. Returnerer null hvis input er tomt eller "0". */
export function cellCode(v: unknown): string | null {
  const s = cellString(v);
  if (!s || s === "0") return null;
  const m = s.match(/^(\d+)/);
  return m ? m[1] : s;
}

/** Samme som cellCode, men returnerer navnet fra klammen: "10 [Øst]"
 *  → "Øst". Falder tilbage til rå streng hvis der ingen klamme er. */
export function cellLabel(v: unknown): string | null {
  const s = cellString(v);
  if (!s || s === "0") return null;
  const m = s.match(/\[(.+?)\]$/);
  return (m ? m[1] : s).trim() || null;
}
