// LAGO Domain-brief 7 — idempotent VISMA activity/visit importer.
//
// Reads `aktiviteter.xlsx` (skip row 1, headers row 2, self-labelled),
// links each activity to the already-imported customer via
// companies_lago.visma_aktoer_nr and upserts into
// public.customer_activities_lago. The stable idempotency key is a
// SHA-256 of `${aftalenr}|${aktoernr}|${dato}|${type_code}|${beskr}|${ansv}`
// because VISMA's Aftalenr is not unique across rows.
//
// After the upserts we recompute `companies_lago.last_visit_at` (latest
// past visit) and `next_visit_planned` (earliest future visit) — merging
// with any CRM-native value so a manually-registered visit that beats
// the VISMA history stays put.
//
// Usage:
//   node scripts/lago/import-visma-activities.mjs <path-to.xlsx> \
//     [dry-run] confirm=YES
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { requireConfirm, runSql } from "./supabaseAdmin.mjs";

// Column indices confirmed against `aktiviteter.xlsx` via inspect-xls.mjs.
const COL = {
  ansvarlig: 0,
  udfoert: 1,
  dato: 2,
  type: 5,
  aftalenr: 10,
  aktoernr: 11,
  beskrivelse: 150,
};

function nonEmpty(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "0") return null;
  return s;
}

function label(v) {
  const s = nonEmpty(v);
  if (!s) return null;
  const m = s.match(/\[(.+?)\]$/);
  return (m ? m[1] : s).trim() || null;
}

function typeCode(v) {
  const s = nonEmpty(v);
  if (!s) return null;
  const m = s.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

// VISMA outputs "M/D/YY" (US) — data spans 2023-2026.
function parseDate(v) {
  const s = nonEmpty(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const yy = Number(m[3]);
  const year = yy < 100 ? 2000 + yy : yy;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function activityKey(row) {
  const parts = [
    row.visma_aftale_nr ?? "",
    row.visma_aktoer_nr ?? "",
    row.activity_date ?? "",
    row.activity_type_code ?? "",
    row.description ?? "",
    row.sales_name ?? "",
  ];
  return createHash("sha256")
    .update(parts.join(""))
    .digest("hex");
}

// ---------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------

function parseRows(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: null,
    raw: false,
  });
  const dataRows = grid.slice(2);
  const stats = {
    total: dataRows.length,
    kept: 0,
    droppedNoAktoerNr: 0,
    droppedNoDate: 0,
    duplicateKey: 0,
  };
  const seen = new Set();
  const rows = [];

  for (const r of dataRows) {
    if (!r) continue;
    const aktoerNr = nonEmpty(r[COL.aktoernr]);
    if (!aktoerNr) {
      stats.droppedNoAktoerNr++;
      continue;
    }
    const date = parseDate(r[COL.dato]);
    if (!date) {
      stats.droppedNoDate++;
      continue;
    }
    const row = {
      visma_aktoer_nr: aktoerNr,
      visma_aftale_nr: nonEmpty(r[COL.aftalenr]),
      activity_date: date,
      activity_type_code: typeCode(r[COL.type]),
      activity_type: label(r[COL.type]),
      description: nonEmpty(r[COL.beskrivelse]),
      sales_name: nonEmpty(r[COL.ansvarlig]),
      done: nonEmpty(r[COL.udfoert])?.toLowerCase() === "x",
    };
    row.visma_activity_key = activityKey(row);
    if (seen.has(row.visma_activity_key)) {
      stats.duplicateKey++;
      continue;
    }
    seen.add(row.visma_activity_key);
    rows.push(row);
    stats.kept++;
  }
  return { rows, stats };
}

// ---------------------------------------------------------------------
// SQL emission
// ---------------------------------------------------------------------

const COLS = [
  "visma_activity_key",
  "visma_aktoer_nr",
  "visma_aftale_nr",
  "activity_date",
  "activity_type_code",
  "activity_type",
  "description",
  "sales_name",
  "done",
];

function lit(v) {
  if (v == null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** One temp table + one PL/pgSQL loop that:
 *   1. resolves visma_aktoer_nr → company_id via companies_lago,
 *   2. upserts on visma_activity_key (idempotent),
 *   3. skips rows whose customer wasn't imported (counts them). */
function buildImportSql(rows) {
  const values = rows
    .map((r) => `(${COLS.map((c) => lit(r[c])).join(", ")})`)
    .join(",\n  ");
  return `
CREATE TEMP TABLE _lago_activity_import (
  ${COLS.map((c) => {
    if (c === "visma_activity_key") return `${c} text PRIMARY KEY`;
    if (c === "activity_date") return `${c} date NOT NULL`;
    if (c === "activity_type_code") return `${c} int`;
    if (c === "done") return `${c} boolean`;
    return `${c} text`;
  }).join(",\n  ")}
) ON COMMIT DROP;

INSERT INTO _lago_activity_import (${COLS.join(", ")}) VALUES
  ${values};

DO $LAGO$
DECLARE
  r RECORD;
  cust_id bigint;
  n_new int := 0;
  n_updated int := 0;
  n_skipped_no_customer int := 0;
BEGIN
  FOR r IN SELECT * FROM _lago_activity_import LOOP
    SELECT company_id INTO cust_id
      FROM public.companies_lago
     WHERE visma_aktoer_nr = r.visma_aktoer_nr;

    IF cust_id IS NULL THEN
      n_skipped_no_customer := n_skipped_no_customer + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.customer_activities_lago (
      company_id, visma_activity_key, visma_aftale_nr, visma_aktoer_nr,
      activity_date, activity_type_code, activity_type, description,
      sales_name, done, source
    ) VALUES (
      cust_id, r.visma_activity_key, r.visma_aftale_nr, r.visma_aktoer_nr,
      r.activity_date, r.activity_type_code, r.activity_type, r.description,
      r.sales_name, COALESCE(r.done, TRUE), 'visma_import'
    )
    ON CONFLICT (visma_activity_key) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      visma_aftale_nr = EXCLUDED.visma_aftale_nr,
      visma_aktoer_nr = EXCLUDED.visma_aktoer_nr,
      activity_date = EXCLUDED.activity_date,
      activity_type_code = EXCLUDED.activity_type_code,
      activity_type = EXCLUDED.activity_type,
      description = EXCLUDED.description,
      sales_name = EXCLUDED.sales_name,
      done = EXCLUDED.done,
      updated_at = now();

    IF FOUND THEN
      -- rough tally (INSERT vs UPDATE both count as FOUND)
      IF (SELECT xmin::text = xmax::text
            FROM public.customer_activities_lago
           WHERE visma_activity_key = r.visma_activity_key) THEN
        n_new := n_new + 1;
      ELSE
        n_updated := n_updated + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'LAGO_ACTIVITY_IMPORT rows_touched=% skipped_no_customer=%',
    n_new + n_updated, n_skipped_no_customer;
END
$LAGO$;

-- Recompute last_visit_at + next_visit_planned per company. Take the
-- latest past Besøg (type_code = 1); merge with any CRM-native value
-- via GREATEST/LEAST so a manually-registered visit that beats the
-- VISMA history stays put.

WITH last_visits AS (
  SELECT company_id, MAX(activity_date) AS max_date
    FROM public.customer_activities_lago
   WHERE activity_type_code = 1
     AND activity_date <= CURRENT_DATE
   GROUP BY company_id
)
UPDATE public.companies_lago cl SET
  last_visit_at = GREATEST(
    COALESCE(cl.last_visit_at, TIMESTAMPTZ '-infinity'),
    (lv.max_date + INTERVAL '12 hours')::timestamptz
  ),
  updated_at = now()
FROM last_visits lv
WHERE cl.company_id = lv.company_id;

WITH next_visits AS (
  SELECT company_id, MIN(activity_date) AS min_date
    FROM public.customer_activities_lago
   WHERE activity_type_code = 1
     AND activity_date > CURRENT_DATE
   GROUP BY company_id
)
UPDATE public.companies_lago cl SET
  next_visit_planned = LEAST(
    COALESCE(cl.next_visit_planned, TIMESTAMPTZ 'infinity'),
    (nv.min_date + INTERVAL '9 hours')::timestamptz
  ),
  updated_at = now()
FROM next_visits nv
WHERE cl.company_id = nv.company_id;
`;
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error(
      "Usage: node scripts/lago/import-visma-activities.mjs <path-to.xlsx> [dry-run] confirm=YES",
    );
    process.exit(1);
  }
  const dryRun = process.argv.includes("dry-run");
  if (!dryRun) requireConfirm();

  console.log(`Parsing ${path} …`);
  const { rows, stats } = parseRows(path);
  console.log("Parse stats:", stats);
  if (rows.length === 0) {
    console.error("No rows to import.");
    process.exit(1);
  }

  // Preview link coverage (dry-run friendly)
  const linkTargets = [...new Set(rows.map((r) => r.visma_aktoer_nr))];
  const found = await runSql(
    `SELECT visma_aktoer_nr FROM public.companies_lago
      WHERE visma_aktoer_nr = ANY(ARRAY[${linkTargets
        .map((v) => `'${v.replace(/'/g, "''")}'`)
        .join(",")}]);`,
  );
  const matched = new Set((found ?? []).map((m) => m.visma_aktoer_nr));
  const unlinked = rows.filter((r) => !matched.has(r.visma_aktoer_nr));
  console.log(
    `Distinct link targets: ${linkTargets.length}. Found in kunder: ${matched.size}. Activities that will be skipped: ${unlinked.length}.`,
  );

  const sql = buildImportSql(rows);
  if (dryRun) {
    console.log(`\n-- DRY RUN — ${rows.length} rows would be attempted --`);
    console.log(sql.slice(0, 2500));
    console.log(`… (${sql.length} chars total, truncated)`);
    return;
  }

  console.log(`\nSending upsert for ${rows.length} activities …`);
  const t0 = Date.now();
  const result = await runSql(sql);
  console.log(`Sent in ${Date.now() - t0}ms. Result:`, result);

  // Brief 24 §2: sidste skridt i enhver import — aflede
  // companies.sales_id fra VISMA-kode. Én kilde til sandhed
  // (derive_sales_id_from_visma), aldrig egen kopi her. Bemærk at
  // aktivitetsimporten kun rører companies_lago.visma_sales_code hvis
  // kundeimporten har opdateret koden først. Kør normalt:
  //   kunder → aktiviteter → derive_sales_id_from_visma()
  console.log("\nAfledning af ejerskab (derive_sales_id_from_visma) …");
  const deriveResult = await runSql(
    `SELECT public.derive_sales_id_from_visma() AS result;`,
  );
  console.log("derive result:", deriveResult?.[0]?.result);

  console.log("\nSanity counts:");
  console.log(
    await runSql(
      `SELECT
         (SELECT COUNT(*) FROM public.customer_activities_lago) AS activities,
         (SELECT COUNT(*) FROM public.customer_activities_lago
            WHERE activity_type_code = 1) AS besoeg,
         (SELECT COUNT(*) FROM public.customer_activities_lago
            WHERE activity_type_code = 1 AND activity_date > CURRENT_DATE) AS future_besoeg,
         (SELECT COUNT(DISTINCT company_id) FROM public.customer_activities_lago) AS distinct_customers,
         (SELECT COUNT(*) FROM public.companies_lago
            WHERE last_visit_at IS NOT NULL) AS customers_with_last_visit,
         (SELECT COUNT(*) FROM public.companies_lago
            WHERE next_visit_planned IS NOT NULL) AS customers_with_next_visit;`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
