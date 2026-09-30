// Parser + tørløb for Kunder (Brief 26 · Alle kunder ind, synlighed
// afledt).
//
// Brief 26 flytter parseren fra "opdatér kun kendte" til:
//
//   • ALT skal ind — VISMA er master, basen skal spejle den.
//   • Kundenr tom/0 → afvis + tæl (bæltemulen selvom OSR nu filtrerer).
//   • Rapportér altid: 0 er et tal, ikke fravær af fejl.
//   • Kunder uden distrikt/status → egen rapport-linje (usynlige for
//     sælgeren; DQ-1 i praksis).
//   • Ukendte sælgerkoder → egen rapport-linje. sales_code_map_lago har
//     11 rækker seedet; ukendte koder skal admin klassificere (DQ-8).
//   • Læs Navn så nye kunder kan INSERTES med et menneskelig navn (ikke
//     bare "Pending Pending" hvis vi glemte).
//
// Synligheden AFLEDES i companies_lago.is_visible_to_sales (generated
// STORED column, brief 26 §2). Parseren skriver de rå felter; databasen
// bestemmer hvad der er synligt. Ingen "filtrér i klienten"-logik her.

import {
  buildHeaderMap,
  cellCode,
  cellString,
  checkRequiredColumnAliases,
  findFirstHeader,
  findHeaderRow,
  readExcelGrid,
} from "../excelUtils";
import type { DryRunResult, KunderPayload, KunderRow } from "../types";

const REQUIRED_COLUMN_ALIASES: [string, ...string[]][] = [
  ["Kundenr", "Kundenr."],
  ["Distrikt", "Salgsdistrikt"],
  ["Prisliste"],
  ["Status", "Statuskode"],
  // Brief 39 (16. sep 2026): Debitorinfo er obligatorisk fra 23.59-kørslen
  // i dag. Fejler højlydt med de fundne kolonnenavne hvis kolonnen mangler
  // — det er præcis dét vi vil have, ikke stille tab af feltet ved en
  // udtræks-ændring.
  ["Debitorinfo"],
];

// Kendte distrikts-koder mapped til labels. Brief 26 §1: koder udover
// dette lander i basen (som label eller raw-kode) og er skjulte via
// is_visible_to_sales. Vi bevarer koden hvis vi ikke har et label.
const DISTRIKT_MAP: Record<string, string> = {
  "10": "Øst",
  "11": "Vest",
  "12": "HQ",
  "13": "Intern",
  "15": "Eksport",
  "19": "Intern (19)",
};

const KUNDETYPE_MAP: Record<string, "engros" | "horeca" | "andre"> = {
  "1": "engros",
  "2": "horeca",
  "3": "andre",
};

// Brief 26 seedede kode 13/2/0 som historisk. Alle andre koder skal
// være enten person, system eller historisk — hvis en ny kode dukker
// op, rapporteres den. Denne liste er kun til rapport i tørløbet;
// selve accept/afvis afgøres af mappingtabellen i databasen.
const KNOWN_SAELGER_CODES = new Set([
  "1", "3", "4", "5", "6", "8", "10", "15",   // person
  "98", "99", "999",                           // system
  "13", "2", "0",                              // historisk
]);

export interface KunderParseInput {
  file: File;
  /**
   * Alle kundenumre der findes i CRM'et. Bruges nu KUN til at skelne
   * nye (INSERT) fra eksisterende (UPDATE) i tørløbs-tællingen —
   * ikke længere til at filtrere payload'en.
   */
  crmCustomers: Set<string>;
}

export async function parseKunder({
  file,
  crmCustomers,
}: KunderParseInput): Promise<DryRunResult<KunderPayload>> {
  const grid = await readExcelGrid(file);

  let headerRowIndex: number;
  try {
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
    salgsdistrikt: findFirstHeader(headerMap, ["Distrikt", "Salgsdistrikt"]),
    prisliste: headerMap.get("Prisliste")!,
    statuskode: findFirstHeader(headerMap, ["Status", "Statuskode"]),
    saelger: findFirstHeader(headerMap, ["Sælger", "Saelger", "Salgsprofil"]),
    // Tillæg 26A: læs alle 16 kolonner OSR bærer, i stedet for de
    // fire fra brief 26. Kerne-stamdata (Navn/Adresse/etc.) er
    // VISMA-master — 907 kunder blev oprettet tomme fordi brief 26
    // kun læste fire kolonner.
    navn: findFirstHeader(headerMap, ["Navn", "Navn 1"]),
    adresse1: findFirstHeader(headerMap, ["Adresse 1", "Adresse"]),
    adresse2: findFirstHeader(headerMap, ["Adresse 2"]),
    postnr: findFirstHeader(headerMap, ["Postnr", "Postnr."]),
    by: headerMap.get("By") ?? -1,
    land: headerMap.get("Land") ?? -1,
    telefon: findFirstHeader(headerMap, ["Telefon", "Telefonnr", "Tlf"]),
    email: findFirstHeader(headerMap, ["E-mail", "Email"]),
    cvr: findFirstHeader(headerMap, ["CVR", "CVR-nr"]),
    // Gem-men-vis-ikke (Tillæg 26A §1)
    branche: headerMap.get("Branche") ?? -1,
    aktoernr: findFirstHeader(headerMap, ["Aktørnr.", "Aktørnr", "Aktoernr"]),
    er_web_kunde: findFirstHeader(headerMap, ["Er web kunde?", "Er web kunde"]),
    kreditspaerre: headerMap.get("Kreditspærre") ?? -1,
    webside: headerMap.get("Webside") ?? -1,
    omraade: headerMap.get("Område") ?? -1,
    ansvarlig: headerMap.get("Ansvarlig") ?? -1,
    // Brief 39: Debitorinfo (checkRequiredColumnAliases ovenfor sikrer
    // at fejlen kommer højlydt hvis kolonnen mangler i input-filen).
    debitorinfo: headerMap.get("Debitorinfo") ?? -1,
  };

  const rawRows = grid.slice(headerRowIndex + 1);
  const payload: KunderRow[] = [];
  let rowsSeen = 0;
  let rowsRejectedNoKundenr = 0;
  const distriktCount: Record<string, number> = {
    Øst: 0,
    Vest: 0,
    HQ: 0,
    Intern: 0,
    Eksport: 0,
    Andet: 0,
  };
  const kundetypeCount: Record<string, number> = {
    engros: 0,
    horeca: 0,
    andre: 0,
  };
  let activeCount = 0;
  let inactiveCount = 0;
  let statusUnknownCount = 0;
  let n_will_insert = 0;
  let n_will_update = 0;
  let n_visible_after = 0;

  // Brief 26 §5b: kunder uden distrikt/status skal frem som EGEN
  // rapport-linje. Ikke skjules, ikke gættes.
  const missingDistrikt: string[] = [];
  const missingStatus: string[] = [];

  // Brief 26 §5c: ukendte sælgerkoder skal frem. Admin klassificerer.
  const unknownSaelgerCodes = new Map<string, number>();

  // Fuldstændighed (brief 15. sep): gør rede for HVER række.
  let rowsSkippedDuplicate = 0;

  const seen = new Set<string>();

  for (const row of rawRows) {
    if (!row || row.every((c) => c == null || c === "")) continue;
    rowsSeen++;

    // Brief 26 §5: bæltemulen. Kundenr tom eller 0 → afvis + tæl.
    // OSR filtrerer det nu ved kilden, men en OSR-rapport kan blive
    // ændret uden at nogen husker hvorfor filteret var her.
    const kundenrRaw = cellString(row[idx.kundenr]);
    if (!kundenrRaw || kundenrRaw === "0") {
      rowsRejectedNoKundenr++;
      continue;
    }
    const kundenr = kundenrRaw;
    if (seen.has(kundenr)) {
      rowsSkippedDuplicate++;
      continue;
    }
    seen.add(kundenr);

    const distriktCode = cellCode(row[idx.salgsdistrikt]);
    // Brief 26 §1: bevar ALLE distrikter. Kendte → label; ukendte → raw
    // kode så admin kan se dem i basen. Tom → null (rapporteres).
    const distrikt = distriktCode
      ? (DISTRIKT_MAP[distriktCode] ?? distriktCode)
      : null;

    const prislisteCode = cellCode(row[idx.prisliste]);
    const kundetype = prislisteCode
      ? (KUNDETYPE_MAP[prislisteCode] ?? null)
      : null;

    const statusCode = cellCode(row[idx.statuskode]);
    // Brief 26: status 1 = aktiv, 9 = inaktiv, 99 = ny (ikke vedligeholdt),
    // 0 = datafejl. Vi gemmer boolean: true kun for "1"; false for
    // "9" (bevidst inaktiv). Alt andet (99, 0, tom) → null — vi
    // gætter ikke.
    const is_active =
      statusCode === "1"
        ? true
        : statusCode === "9"
          ? false
          : null;

    const visma_sales_code =
      idx.saelger >= 0 ? cellCode(row[idx.saelger]) : null;

    const navn = idx.navn >= 0 ? cellString(row[idx.navn]) : null;

    // Tillæg 26A: kerne-stamdata (VISMA-master → companies).
    const adresse1 = idx.adresse1 >= 0 ? cellString(row[idx.adresse1]) : null;
    const adresse2 = idx.adresse2 >= 0 ? cellString(row[idx.adresse2]) : null;
    const postnr = idx.postnr >= 0 ? cellString(row[idx.postnr]) : null;
    const by = idx.by >= 0 ? cellString(row[idx.by]) : null;
    const land = idx.land >= 0 ? cellString(row[idx.land]) : null;
    const telefon = idx.telefon >= 0 ? cellString(row[idx.telefon]) : null;
    const email = idx.email >= 0 ? cellString(row[idx.email]) : null;
    const cvr = idx.cvr >= 0 ? cellString(row[idx.cvr]) : null;
    const webside = idx.webside >= 0 ? cellString(row[idx.webside]) : null;

    // Tillæg 26A: gem-men-vis-ikke (LAGO-sidecar).
    const branche = idx.branche >= 0 ? cellString(row[idx.branche]) : null;
    const aktoernr = idx.aktoernr >= 0 ? cellString(row[idx.aktoernr]) : null;
    const omraade = idx.omraade >= 0 ? cellString(row[idx.omraade]) : null;
    const ansvarlig = idx.ansvarlig >= 0 ? cellString(row[idx.ansvarlig]) : null;
    const debitorinfo =
      idx.debitorinfo >= 0 ? cellString(row[idx.debitorinfo]) : null;
    // "Er web kunde?" og "Kreditspærre" — boolean-agtige felter.
    // VISMA-eksporten viser typisk "Ja"/"Nej", "1"/"0" eller tom.
    const parseBoolFlag = (v: unknown): boolean | null => {
      const s = cellString(v);
      if (!s) return null;
      const low = s.toLowerCase();
      if (low === "ja" || low === "1" || low === "true" || low === "sand")
        return true;
      if (low === "nej" || low === "0" || low === "false" || low === "falsk")
        return false;
      return null;
    };
    const er_web_kunde =
      idx.er_web_kunde >= 0 ? parseBoolFlag(row[idx.er_web_kunde]) : null;
    const kreditspaerre =
      idx.kreditspaerre >= 0 ? parseBoolFlag(row[idx.kreditspaerre]) : null;

    // Brief 26 §5b: kunder uden distrikt/status skal rapporteres.
    // Rapportér KUN dem der ville have været synlige med data (dvs.
    // dem der har status=1 men mangler distrikt, ELLER har distrikt
    // 10/11/12 men mangler status). Rene interne konti uden nogen
    // felter fylder ikke rapporten.
    if (distrikt === null && is_active === true) {
      missingDistrikt.push(kundenr);
    }
    if (
      (distrikt === "Øst" || distrikt === "Vest" || distrikt === "HQ") &&
      is_active === null
    ) {
      missingStatus.push(kundenr);
    }

    // Brief 26 §5c: ukendte sælgerkoder rapporteres. Tomme koder er
    // OK (håndteres af historisk-kode 0 i mappingen).
    if (visma_sales_code && !KNOWN_SAELGER_CODES.has(visma_sales_code)) {
      unknownSaelgerCodes.set(
        visma_sales_code,
        (unknownSaelgerCodes.get(visma_sales_code) ?? 0) + 1,
      );
    }

    payload.push({
      visma_customer_no: kundenr,
      distrikt,
      kundetype,
      is_active,
      visma_sales_code,
      navn,
      adresse1,
      postnr,
      by,
      land,
      telefon,
      email,
      cvr,
      webside,
      adresse2,
      branche,
      aktoernr,
      er_web_kunde,
      kreditspaerre,
      omraade,
      ansvarlig,
      debitorinfo,
    });

    // Tællinger for tørløbs-summary.
    if (crmCustomers.has(kundenr)) n_will_update++;
    else n_will_insert++;

    // Bogfør distrikt-fordeling.
    if (distrikt === "Øst") distriktCount.Øst++;
    else if (distrikt === "Vest") distriktCount.Vest++;
    else if (distrikt === "HQ") distriktCount.HQ++;
    else if (distrikt === "Intern" || distrikt === "Intern (19)")
      distriktCount.Intern++;
    else if (distrikt === "Eksport") distriktCount.Eksport++;
    else distriktCount.Andet++;

    if (kundetype) kundetypeCount[kundetype]++;
    if (is_active === true) activeCount++;
    else if (is_active === false) inactiveCount++;
    else statusUnknownCount++;

    // Antal der bliver synlige for sælgeren efter denne import.
    const willBeVisible =
      (distrikt === "Øst" || distrikt === "Vest" || distrikt === "HQ") &&
      is_active === true;
    if (willBeVisible) n_visible_after++;
  }

  const rowErrors: DryRunResult<never>["rowErrors"] = [];

  // Fuldstændighed (brief 15. sep): sum af inkluderet + udeladelser
  // = rows_in_file. Alle 1.164 skal gøres rede for.
  const invariant =
    payload.length + rowsRejectedNoKundenr + rowsSkippedDuplicate;
  rowErrors.push({
    rowIndex: 0,
    message:
      `Fuldstændighed: ${payload.length} inkluderet + ` +
      `${rowsRejectedNoKundenr} uden kundenr (0/tom) + ` +
      `${rowsSkippedDuplicate} duplikat-kundenumre ` +
      `= ${invariant} af ${rowsSeen} rækker` +
      (invariant === rowsSeen
        ? "  ✓"
        : `  ⚠️ AFVIGER MED ${rowsSeen - invariant}`),
  });

  // Brief 26 §5: rapportér ALTID Kundenr=0-tælling, nul er også et tal.
  rowErrors.push({
    rowIndex: 0,
    message:
      rowsRejectedNoKundenr === 0
        ? "0 rækker afvist for tomt/0 Kundenr (bæltemulen).  ✓"
        : `${rowsRejectedNoKundenr} rækker afvist: Kundenr er tom eller 0. OSR bør filtrere disse — ret ved kilden.`,
  });

  // Brief 26 §5b: usynlige kunder pga. manglende data — hver gang.
  if (missingDistrikt.length > 0 || missingStatus.length > 0) {
    const parts: string[] = [];
    if (missingDistrikt.length > 0) {
      parts.push(
        `${missingDistrikt.length} kunder er usynlige for sælgerne: distrikt mangler i VISMA (Kundenr: ${missingDistrikt.slice(0, 10).join(", ")}${missingDistrikt.length > 10 ? " …" : ""})`,
      );
    }
    if (missingStatus.length > 0) {
      parts.push(
        `${missingStatus.length} kunder er usynlige for sælgerne: status mangler i VISMA (Kundenr: ${missingStatus.slice(0, 10).join(", ")}${missingStatus.length > 10 ? " …" : ""})`,
      );
    }
    rowErrors.push({
      rowIndex: 0,
      message: parts.join(" · "),
    });
  } else {
    rowErrors.push({
      rowIndex: 0,
      message: "0 kunder usynlige pga. manglende distrikt/status.  ✓",
    });
  }

  // Brief 26 §5c: ukendte sælgerkoder — DQ-8's første kunder.
  if (unknownSaelgerCodes.size > 0) {
    const codesList = Array.from(unknownSaelgerCodes.entries())
      .map(([code, n]) => `kode ${code} (${n} kunder)`)
      .join(", ");
    rowErrors.push({
      rowIndex: 0,
      message: `${unknownSaelgerCodes.size} ukendte sælgerkoder — tilføj dem i Indstillinger → Ejerskab: VISMA-kode → CRM-bruger. Kunderne får sales_id=null indtil da: ${codesList}`,
    });
  }

  const categoryBreakdown = [
    { label: `Bliver INSERT (nye)`, rows: n_will_insert, belob: 0 },
    { label: `Bliver UPDATE (eksisterende)`, rows: n_will_update, belob: 0 },
    { label: `Synlige for sælgeren efter import`, rows: n_visible_after, belob: 0 },
    { label: "Distrikt: Øst", rows: distriktCount.Øst, belob: 0 },
    { label: "Distrikt: Vest", rows: distriktCount.Vest, belob: 0 },
    { label: "Distrikt: HQ", rows: distriktCount.HQ, belob: 0 },
    { label: "Distrikt: Intern (skjult)", rows: distriktCount.Intern, belob: 0 },
    { label: "Distrikt: Eksport (skjult)", rows: distriktCount.Eksport, belob: 0 },
    { label: "Distrikt: Andet/tomt (skjult)", rows: distriktCount.Andet, belob: 0 },
    { label: "Kundetype: engros", rows: kundetypeCount.engros, belob: 0 },
    { label: "Kundetype: horeca", rows: kundetypeCount.horeca, belob: 0 },
    { label: "Kundetype: andre", rows: kundetypeCount.andre, belob: 0 },
    { label: "Status: aktiv (1)", rows: activeCount, belob: 0 },
    { label: "Status: inaktiv (9)", rows: inactiveCount, belob: 0 },
    { label: "Status: ny/tom (99/0)", rows: statusUnknownCount, belob: 0 },
  ];

  return {
    ok: true,
    rowsInFile: rowsSeen,
    rowsAfterFilter: payload.length,
    matchedCustomers: n_will_update,
    // Brief 26: unknownCustomers-listen tømmes. Vi opretter dem nu.
    unknownCustomers: [],
    categoryBreakdown,
    rowErrors,
    payload,
  };
}
