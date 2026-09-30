// Parser + tørløb for Kontakter → contacts + contacts_lago (Domain-brief 29).
//
// Engangsimport. 528 kontakter i dagens fil. Headeren står i række 2 —
// første række er rapportnavnet "Aktør". Kobling på kundens Aktørnr.
// via kolonnen "Kontaktperson for", ikke på kundenummer.
//
// Tørløbet svarer på fire spørgsmål:
//   1. Hvor mange rækker kan bindes til en kunde (forventet 439)?
//   2. Hvor mange kan ikke (forventet 89 — leverandører/medarbejdere)?
//   3. Hvor mange er webshop-brugere (forventet 182)?
//   4. Er telefontallet så lavt som VISMA siger (30 mobil, 18 fastnet)?
//
// Parseren rører ingen database; importen i executeImport.ts modtager
// listen og gør INSERT/UPDATE mod contacts + contacts_lago med
// dedupering på visma_aktoer_nr.

import {
  buildHeaderMap,
  cellDate,
  cellString,
  checkRequiredColumnAliases,
  findFirstHeader,
  findHeaderRow,
  readExcelGrid,
} from "../excelUtils";
import type { DryRunResult, KontaktRow, KontakterPayload } from "../types";

// "Kontaktperson for" er kundens Aktørnr. Navnet står som ét felt i
// kolonnen "Navn" — filen har IKKE separate Fornavn/Efternavn (målt
// 16. sep 2026 mod Kontakter 15092026.xlsx).
const REQUIRED_COLUMN_ALIASES: [string, ...string[]][] = [
  ["Kontaktperson for"],
  ["Navn", "Fornavn"],
];

/** Split et navn i (fornavn, efternavn) på SIDSTE mellemrum. VISMA
 *  bærer mellemnavne — "Martin Sandy Shalmi" → ("Martin Sandy",
 *  "Shalmi"), ikke ("Martin", "Sandy Shalmi"). Uden mellemrum ryger
 *  hele navnet i fornavn, og efternavn er null. */
export function splitFullNameLast(name: string): {
  first_name: string;
  last_name: string | null;
} {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const idx = trimmed.lastIndexOf(" ");
  if (idx === -1) {
    return { first_name: trimmed, last_name: null };
  }
  return {
    first_name: trimmed.slice(0, idx),
    last_name: trimmed.slice(idx + 1),
  };
}

export interface KontakterParseInput {
  file: File;
  /**
   * Map fra kundens Aktørnr. (som tekst) → { company_id, kunde_navn }.
   * Uden det kan tørløbet ikke svare "hvor mange kan bindes" eller
   * "hvor mange kan ikke". Import-executoren bygger det op fra
   * companies_lago før parse-kaldet.
   */
  companyLookupByAktoerNr: Map<
    string,
    { company_id: number; kunde_navn: string }
  >;
}

function parseWebkundeFlag(v: unknown): boolean {
  const s = cellString(v);
  if (!s) return false;
  // "1 [Webkunde]" / "0" / "true" / "Ja". Match tallet foran evt. klamme.
  const m = s.match(/^(\d+)/);
  if (m) return m[1] === "1";
  const lower = s.toLowerCase();
  return lower === "true" || lower === "ja" || lower === "yes";
}

export async function parseKontakter({
  file,
  companyLookupByAktoerNr,
}: KontakterParseInput): Promise<DryRunResult<KontakterPayload>> {
  const grid = await readExcelGrid(file);

  // Header i række 2 (index 1) — første række er rapportnavnet "Aktør".
  // findHeaderRow scanner de første 20 rækker efter et kendt kolonnenavn
  // og returnerer indekset, så vi behøver ikke hardkode "1".
  let headerRowIndex: number;
  try {
    headerRowIndex = findHeaderRow(grid, "Kontaktperson for");
  } catch {
    return {
      ok: false,
      rowsInFile: Math.max(0, grid.length - 1),
      rowsAfterFilter: 0,
      rowErrors: [],
      headerError: {
        kind: "header-missing",
        missingColumns: [
          '"Kontaktperson for" (header-rækken kunne ikke findes)',
        ],
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
    kontaktperson_for: headerMap.get("Kontaktperson for")!,
    // Kontaktens egen Aktørnr. — bruges som dedupering. Hedder "Aktørnr."
    // i denne kontekst (samme kolonnenavn som på kundefilen, men her er
    // det kontaktens id).
    aktoer_nr: headerMap.get("Aktørnr.") ?? headerMap.get("Aktørnr") ?? -1,
    // Ét navnefelt, splittes på sidste mellemrum.
    navn: findFirstHeader(headerMap, ["Navn", "Fornavn"]),
    titel: headerMap.get("Titel") ?? -1,
    email: findFirstHeader(headerMap, ["E-mailadresse", "E-mail"]),
    mobil: findFirstHeader(headerMap, ["Mobiltelefonnr.", "Mobiltelefonnr", "Mobil"]),
    telefon: findFirstHeader(headerMap, ["Telefonnr.", "Telefonnr", "Telefon"]),
    webkunde: headerMap.get("Webkunde") ?? -1,
    oprettet_af: headerMap.get("Oprettet af bruger") ?? -1,
    oprettet_dato: headerMap.get("Oprettet dato") ?? -1,
    aendret_af: headerMap.get("Ændret af bruger") ?? -1,
    aendret_dato: headerMap.get("Ændret dato") ?? -1,
  };

  const rawRows = grid.slice(headerRowIndex + 1);
  const payload: KontaktRow[] = [];
  let rowsSeen = 0;
  // Fuldstændighed: hver række skal ende ét sted.
  let rowsSkippedMissingKundeAktoer = 0;
  let rowsSkippedMissingNavn = 0;
  let rowsSkippedNoCustomerMatch = 0;
  // Eksempler til rapporten — vi vil se nogle uden match, så det kan
  // vurderes om det er leverandører eller manglende kunder.
  const noMatchExamples: string[] = [];
  // Webshop-tælling — brief 29 forventer 182 af 528.
  let webshopCount = 0;
  // Telefon-tællinger — for at bekræfte de lave tal fra briefen.
  let mobilCount = 0;
  let telefonCount = 0;
  let emailCount = 0;
  // Distribution: kunder der får mindst én kontakt.
  const kunderMedNyKontakt = new Set<number>();

  for (const row of rawRows) {
    if (!row || row.every((c) => c == null || c === "")) continue;
    rowsSeen++;

    const kundeAktoer = cellString(row[idx.kontaktperson_for]);
    if (!kundeAktoer) {
      rowsSkippedMissingKundeAktoer++;
      continue;
    }

    const navnRaw = cellString(row[idx.navn]);
    if (!navnRaw) {
      rowsSkippedMissingNavn++;
      continue;
    }
    const { first_name: fornavn, last_name: efternavn } =
      splitFullNameLast(navnRaw);

    const match = companyLookupByAktoerNr.get(kundeAktoer);
    if (!match) {
      rowsSkippedNoCustomerMatch++;
      if (noMatchExamples.length < 5) {
        noMatchExamples.push(`${navnRaw} (Aktørnr. ${kundeAktoer})`);
      }
      continue;
    }

    const is_webshop =
      idx.webkunde >= 0 ? parseWebkundeFlag(row[idx.webkunde]) : false;
    if (is_webshop) webshopCount++;

    const email = idx.email >= 0 ? cellString(row[idx.email]) : null;
    const mobil = idx.mobil >= 0 ? cellString(row[idx.mobil]) : null;
    const telefon = idx.telefon >= 0 ? cellString(row[idx.telefon]) : null;
    if (email) emailCount++;
    if (mobil) mobilCount++;
    if (telefon) telefonCount++;

    kunderMedNyKontakt.add(match.company_id);

    payload.push({
      kontakt_aktoer_nr:
        idx.aktoer_nr >= 0 ? cellString(row[idx.aktoer_nr]) : null,
      kunde_aktoer_nr: kundeAktoer,
      fornavn,
      efternavn,
      titel: idx.titel >= 0 ? cellString(row[idx.titel]) : null,
      email,
      mobiltelefon: mobil,
      telefon,
      is_webshop,
      visma_created_by:
        idx.oprettet_af >= 0 ? cellString(row[idx.oprettet_af]) : null,
      visma_created_at:
        idx.oprettet_dato >= 0 ? cellDate(row[idx.oprettet_dato]) : null,
      visma_updated_by:
        idx.aendret_af >= 0 ? cellString(row[idx.aendret_af]) : null,
      visma_updated_at:
        idx.aendret_dato >= 0 ? cellDate(row[idx.aendret_dato]) : null,
    });
  }

  const rowErrors: DryRunResult<never>["rowErrors"] = [];

  // Fuldstændighed: sum af inkluderet + udeladelser = rowsSeen.
  const invariant =
    payload.length +
    rowsSkippedMissingKundeAktoer +
    rowsSkippedMissingNavn +
    rowsSkippedNoCustomerMatch;
  rowErrors.push({
    rowIndex: 0,
    message:
      `Fuldstændighed: ${payload.length} matcher en kunde + ` +
      `${rowsSkippedMissingKundeAktoer} uden "Kontaktperson for" + ` +
      `${rowsSkippedMissingNavn} uden fornavn + ` +
      `${rowsSkippedNoCustomerMatch} peger på aktør uden kunde-match ` +
      `= ${invariant} af ${rowsSeen} rækker` +
      (invariant === rowsSeen
        ? "  ✓"
        : `  ⚠️ AFVIGER MED ${rowsSeen - invariant}`),
  });

  // Brief §1b: rapportér de uden-match. VISMAs "Aktør" dækker også
  // leverandører og medarbejdere — et par eksempler så det kan vurderes
  // om det er dem, eller om vi mangler kunder.
  if (rowsSkippedNoCustomerMatch > 0) {
    rowErrors.push({
      rowIndex: 0,
      message:
        `${rowsSkippedNoCustomerMatch} aktører uden kunde-match — ` +
        `sandsynligvis leverandører/medarbejdere. Eksempler: ` +
        noMatchExamples.join("; ") +
        (rowsSkippedNoCustomerMatch > noMatchExamples.length ? " …" : ""),
    });
  }

  // Brief §2: webshop-tælling. Skal give ~182 for hele filen.
  rowErrors.push({
    rowIndex: 0,
    message:
      `Webshop-brugere blandt de matchede: ${webshopCount} ` +
      `(bærer mærkat "adgang styres i VISMA" i UI).`,
  });

  // Brief §0: telefontallene. En kontaktperson uden nummer er et navn.
  rowErrors.push({
    rowIndex: 0,
    message:
      `Kontaktbarhed blandt de matchede: ` +
      `${emailCount} e-mail, ${mobilCount} mobil, ${telefonCount} fastnet.`,
  });

  // Brief §6: kunder der får mindst én kontakt.
  rowErrors.push({
    rowIndex: 0,
    message:
      `${kunderMedNyKontakt.size} kunder får mindst én kontakt via denne import.`,
  });

  const categoryBreakdown = [
    {
      label: "Matcher en kunde",
      rows: payload.length,
      belob: 0,
    },
    {
      label: "Aktør uden kunde-match (springes over)",
      rows: rowsSkippedNoCustomerMatch,
      belob: 0,
    },
    {
      label: "Webshop-brugere (adgang styres i VISMA)",
      rows: webshopCount,
      belob: 0,
    },
  ];

  return {
    ok: payload.length > 0,
    rowsInFile: rowsSeen,
    rowsAfterFilter: payload.length,
    matchedCustomers: kunderMedNyKontakt.size,
    categoryBreakdown,
    rowErrors,
    payload,
  };
}
