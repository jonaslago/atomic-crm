// 🔴 IKKE I DRIFT. Kundeudtrækket importeres fra Indstillinger →
// "Opdatér kunder", som kører src/lago/settings/salesImport/
// (executeImport.ts + parsers/kunder.ts). Ret dér — ikke her.
// Dette script er et historisk værktøj til initielle/manuelle imports;
// morgenkørslen bruger det ikke. En dublet importer fik CRM-Code til
// at rette det forkerte sted den 21. sep 2026 — sket for én af os er
// nok.
//
// LAGO Domain-brief 5 — idempotent VISMA-XLS customer importer.
//
// Reads the customer export (skip row 1, headers on row 2, values are
// self-labelled), filters to real B2B customers, and upserts them into
// public.companies + public.companies_lago via the Supabase Management
// API. VISMA-owned fields (name, address, phone, email, CVR, betaling,
// distrikt, sælger-code+name) are refreshed on every run. CRM-owned
// seed fields (sector, segment, kundestatus) are only written when the
// row is new OR the existing value is NULL — the importer never
// overwrites CRM-side edits, so re-imports stay safe.
//
// Usage:
//   node scripts/lago/import-visma-customers.mjs <path-to.xlsx> \
//     [dry-run] confirm=YES
//
// `dry-run` prints the SQL that would be sent without executing it.
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { requireConfirm, runSql } from "./supabaseAdmin.mjs";

// ---------------------------------------------------------------------
// Column indices (row-1 headers). Confirmed against `kundeudtræ 2.xlsx`
// via inspect-xls.mjs — 221 columns, only 15 make it into CRM.
// ---------------------------------------------------------------------
const COL = {
  kundenr: 0,
  navn: 1,
  distrikt: 2,
  adresse1: 4,
  adresse2: 5,
  postnr: 6,
  by: 7,
  telefon: 10,
  aktoer_nr: 22, // VISMA Aktørnr — link target for contacts
  betaling: 44,
  branche: 50,
  distrikt_alt: 64, // second Distrikt column, always "0" — ignored
  erhverv: 76,
  mobil: 138,
  // Brief 13: VISMA-segmentkolonnerne bruges IKKE længere.
  // onsight (col 151) og status/Gruppe 2 (col 183) læses ikke.
  statuskode: 184, // "1 [Aktiv]" / "0" → aktiv-flag
  saelger: 190,
  webside: 210,
  cvr: 218,
  email: 220,
};


// HQ kunder skal med (Jonas' beslutning efter brief 5): kun rene interne
// og eksport-distrikter droppes.
const EXCLUDED_DISTRIKT = new Set(["Intern", "Eksport"]);

// From `sælgere.xlsx` (short form in the brief). Kept in code — the sales
// login model will replace this in a later phase (brief note).
const SAELGER_MAP = new Map([
  ["1", "Ole"],
  ["2", "Lars G"],
  ["3", "Jonas Arild"],
  ["4", "Susanne"],
  ["5", "Kim"],
  ["6", "Peter Ærensgaard"],
  ["7", "Dan"],
  ["8", "Simon Jensen"],
  ["9", "Cecilia"],
  ["10", "Camilla Uhre Pedersen"],
  ["11", "Silas"],
  ["12", "Simone"],
  ["13", "Peter J"],
  ["14", "Ida"],
  ["98", "Webshop"],
  ["99", "System"],
  ["101", "Statistik"],
  ["102", "Statistik"],
  ["999", "Ingen sælger tildelt"],
]);

/** Extract the human label from a self-labelled VISMA value, e.g.
 * "10 [Øst]" → "Øst". Falls through to the raw string when there is no
 * bracket. `null` for empty / "0" / whitespace-only cells. */
function label(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === "0") return null;
  const m = s.match(/\[(.+?)\]$/);
  return (m ? m[1] : s).trim() || null;
}

/** Only the leading numeric code, e.g. "10 [Øst]" → "10". */
function code(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === "0") return null;
  const m = s.match(/^(\d+)/);
  return m ? m[1] : null;
}

function nonEmpty(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === "0") return null;
  return s;
}

function normaliseWebsite(raw) {
  const v = nonEmpty(raw);
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return v;
  return `https://${v}`;
}

function joinAddress(a1, a2) {
  const parts = [nonEmpty(a1), nonEmpty(a2)].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function pickPhone(fixed, mobile) {
  return nonEmpty(fixed) ?? nonEmpty(mobile);
}

// ---------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------

function parseRows(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const dataRows = grid.slice(2); // skip junk row 0 + header row 1
  const stats = {
    total: dataRows.length,
    kept: 0,
    droppedNoKundenr: 0,
    droppedNotErhverv: 0,
    droppedExcludedDistrikt: 0,
    duplicateKundenr: 0,
  };

  const seen = new Set();
  const parsed = [];

  for (const r of dataRows) {
    if (!r) continue;
    const kundenr = nonEmpty(r[COL.kundenr]);
    if (!kundenr) {
      stats.droppedNoKundenr++;
      continue;
    }
    if (seen.has(kundenr)) {
      stats.duplicateKundenr++;
      continue;
    }
    const erhverv = label(r[COL.erhverv]);
    if (erhverv !== "Erhverv") {
      stats.droppedNotErhverv++;
      continue;
    }
    const distrikt = label(r[COL.distrikt]);
    if (distrikt && EXCLUDED_DISTRIKT.has(distrikt)) {
      stats.droppedExcludedDistrikt++;
      continue;
    }

    const saelgerCode = code(r[COL.saelger]);
    const saelgerName = saelgerCode ? SAELGER_MAP.get(saelgerCode) ?? null : null;

    // Brief 13: Statuskode → aktiv-flag (1 = aktiv, 0 = inaktiv).
    const statuskodeStr = code(r[COL.statuskode]);
    const visma_statuskode = statuskodeStr != null ? Number(statuskodeStr) : null;
    const is_active =
      visma_statuskode == null ? true : visma_statuskode === 1;

    seen.add(kundenr);
    parsed.push({
      visma_customer_no: kundenr,
      visma_aktoer_nr: nonEmpty(r[COL.aktoer_nr]),
      name: nonEmpty(r[COL.navn]) ?? kundenr,
      address: joinAddress(r[COL.adresse1], r[COL.adresse2]),
      zipcode: nonEmpty(r[COL.postnr]),
      city: nonEmpty(r[COL.by]),
      country: "Danmark",
      phone_number: pickPhone(r[COL.telefon], r[COL.mobil]),
      faktura_email: nonEmpty(r[COL.email]),
      tax_identifier: nonEmpty(r[COL.cvr]),
      website: normaliseWebsite(r[COL.webside]),
      sector: label(r[COL.branche]),
      distrikt,
      betaling: label(r[COL.betaling]),
      visma_sales_code: saelgerCode,
      visma_sales_name: saelgerName,
      // Brief 13: segmentet ejes af CRM alene (default X). VISMA
      // sender ikke segmentet med; kundestatus (Gruppe 2) droppes helt.
      visma_statuskode,
      is_active,
    });
    stats.kept++;
  }

  return { rows: parsed, stats };
}

// ---------------------------------------------------------------------
// SQL emission
// ---------------------------------------------------------------------

// Brief 13: segmentet ejes af CRM (default X), og VISMA-kundestatus
// (Gruppe 2) er droppet. Nye kolonner er visma_statuskode + is_active.
const IMPORT_COLUMNS = [
  "visma_customer_no",
  "visma_aktoer_nr",
  "name",
  "address",
  "zipcode",
  "city",
  "country",
  "phone_number",
  "faktura_email",
  "tax_identifier",
  "website",
  "sector",
  "distrikt",
  "betaling",
  "visma_sales_code",
  "visma_sales_name",
  "visma_statuskode",
  "is_active",
];

// Kolonner der skal bruges som TEXT i temp-tabellen. De to nye
// (visma_statuskode, is_active) har andre typer.
function sqlLiteral(v) {
  if (v == null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Build a single SQL script that:
 *  1. Creates a temp table with the incoming rows.
 *  2. Loops through it, inserting new customers or refreshing existing ones
 *     according to the ownership rules.
 *  3. Returns tallies via NOTICE messages we can grep after the run. */
function buildImportSql(rows) {
  const valueRows = rows
    .map(
      (r) =>
        `(${IMPORT_COLUMNS.map((c) => sqlLiteral(r[c])).join(", ")})`,
    )
    .join(",\n  ");

  const columnDefs = IMPORT_COLUMNS.map((c) => {
    if (c === "visma_customer_no") return `${c} text PRIMARY KEY`;
    if (c === "visma_statuskode") return `${c} int`;
    if (c === "is_active") return `${c} boolean`;
    return `${c} text`;
  }).join(",\n  ");

  return `
CREATE TEMP TABLE _lago_import (
  ${columnDefs}
) ON COMMIT DROP;

INSERT INTO _lago_import (${IMPORT_COLUMNS.join(", ")}) VALUES
  ${valueRows};

DO $LAGO$
DECLARE
  r RECORD;
  cid bigint;
  n_new int := 0;
  n_updated int := 0;
  n_sector_seeded int := 0;
  n_inactive int := 0;
BEGIN
  FOR r IN SELECT * FROM _lago_import LOOP
    SELECT company_id INTO cid
      FROM public.companies_lago
     WHERE visma_customer_no = r.visma_customer_no;

    IF cid IS NULL THEN
      INSERT INTO public.companies (
        name, address, zipcode, city, country,
        phone_number, website, tax_identifier, sector
      ) VALUES (
        r.name, r.address, r.zipcode, r.city, r.country,
        r.phone_number, r.website, r.tax_identifier, r.sector
      ) RETURNING id INTO cid;

      -- Brief 13: segmentet defaults til X i DB. Vi rører det ikke her.
      INSERT INTO public.companies_lago (
        company_id, visma_customer_no, visma_aktoer_nr, faktura_email,
        distrikt, betaling, visma_sales_code, visma_sales_name,
        visma_statuskode, is_active, last_visma_import_at
      ) VALUES (
        cid, r.visma_customer_no, r.visma_aktoer_nr, r.faktura_email,
        r.distrikt, r.betaling, r.visma_sales_code, r.visma_sales_name,
        r.visma_statuskode, COALESCE(r.is_active, TRUE), now()
      );

      n_new := n_new + 1;
      IF r.sector IS NOT NULL THEN n_sector_seeded := n_sector_seeded + 1; END IF;
      IF r.is_active IS FALSE THEN n_inactive := n_inactive + 1; END IF;
    ELSE
      UPDATE public.companies SET
        name = r.name,
        address = r.address,
        zipcode = r.zipcode,
        city = r.city,
        country = COALESCE(country, r.country),
        phone_number = r.phone_number,
        website = r.website,
        tax_identifier = r.tax_identifier,
        -- CRM-owned: seed only when NULL
        sector = COALESCE(sector, r.sector)
      WHERE id = cid;

      -- Brief 13: segmentet er CRM-ejet og RØRES IKKE. Aktiv-flaget
      -- ejes af VISMA og opdateres ved hver import.
      UPDATE public.companies_lago SET
        visma_aktoer_nr = r.visma_aktoer_nr,
        faktura_email = r.faktura_email,
        distrikt = r.distrikt,
        betaling = r.betaling,
        visma_sales_code = r.visma_sales_code,
        visma_sales_name = r.visma_sales_name,
        visma_statuskode = r.visma_statuskode,
        is_active = COALESCE(r.is_active, TRUE),
        last_visma_import_at = now(),
        updated_at = now()
      WHERE company_id = cid;

      n_updated := n_updated + 1;
      IF r.is_active IS FALSE THEN n_inactive := n_inactive + 1; END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'LAGO_IMPORT_DONE new=% updated=% sector_seeded=% inactive=%',
    n_new, n_updated, n_sector_seeded, n_inactive;
END
$LAGO$;
`;
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error(
      "Usage: node scripts/lago/import-visma-customers.mjs <path-to.xlsx> [dry-run] confirm=YES",
    );
    process.exit(1);
  }
  const dryRun = process.argv.includes("dry-run");
  if (!dryRun) requireConfirm();

  console.log(`Parsing ${path} …`);
  const { rows, stats } = parseRows(path);
  console.log("Parse stats:", stats);
  if (rows.length === 0) {
    console.error("No rows survived filtering — refusing to run.");
    process.exit(1);
  }

  const sql = buildImportSql(rows);
  if (dryRun) {
    console.log(`\n-- DRY RUN — ${rows.length} rows would be upserted --\n`);
    console.log(sql.slice(0, 4000));
    console.log(`\n… (${sql.length} chars total, truncated)`);
    return;
  }

  console.log(
    `Sending upsert for ${rows.length} customers to cloud Supabase …`,
  );
  const result = await runSql(sql);
  console.log("Result:", result);

  // Brief 24 §2: KUNDEIMPORTEN er den rigtige placering af ejerskabs-
  // afledningen — det er her visma_sales_code sættes på kunden. Én
  // kilde til sandhed (derive_sales_id_from_visma), aldrig egen kopi.
  // Kaldes efter opdatering af companies_lago så mappingen laves på
  // frisk data.
  console.log("\nAfledning af ejerskab (derive_sales_id_from_visma) …");
  const deriveResult = await runSql(
    `SELECT public.derive_sales_id_from_visma() AS result;`,
  );
  console.log("derive result:", deriveResult?.[0]?.result);

  console.log("\nSanity counts:");
  const counts = await runSql(
    `SELECT
       (SELECT COUNT(*) FROM public.companies_lago
          WHERE visma_customer_no IS NOT NULL) AS lago_rows_with_visma_no,
       (SELECT COUNT(*) FROM public.companies_lago
          WHERE last_visma_import_at::date = CURRENT_DATE) AS touched_today,
       (SELECT COUNT(*) FROM public.companies_lago
          WHERE distrikt IS NOT NULL) AS with_distrikt,
       (SELECT COUNT(*) FROM public.companies_lago
          WHERE visma_sales_name IS NOT NULL) AS with_saelger,
       (SELECT COUNT(*) FROM public.companies_lago
          WHERE is_active) AS active_now,
       (SELECT COUNT(*) FROM public.companies_lago
          WHERE NOT is_active) AS inactive_now,
       (SELECT COUNT(*) FROM public.companies_lago
          WHERE segment = 'X') AS unclassified_segment;`,
  );
  console.log(counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
