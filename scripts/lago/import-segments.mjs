// LAGO Import-brief 5b — idempotent segment-klassificerings-importer.
//
// Læser T12M-CSV'en (semikolon-separeret, UTF-8-BOM), matcher på
// visma_customer_no, og sætter segment A/B/C — men KUN hvor kundens
// segment i dag er X (uklassificeret). Manuelle klassificeringer
// (A/B/C/L) overskrives aldrig.
//
// Samtidig skrives baseline-snapshot til public.lago_segment_history:
// ét snapshot pr. (kunde, klassificeret_dato, grundlag). Historikken
// gemmer det FAKTISK gældende segment efter opdateringen — så re-kørsel
// aldrig påstår "C" om en kunde, en sælger har flyttet manuelt til "A".
//
// X-rækker i CSV'en (T12M=0) springes over: hverken segment-opdatering
// eller historik.
//
// Usage:
//   node scripts/lago/import-segments.mjs [csv-path] [dry-run] [confirm=YES]
//
//   csv-path defaulter til scripts/lago/data/segment-t12m-2026-08-31.csv
//   dry-run  printer counts + umatchede kundenr, uden at røre databasen.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { requireConfirm, runSql } from "./supabaseAdmin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_CSV = resolve(
  __dirname,
  "data",
  "segment-t12m-2026-08-31.csv",
);

// Skæringsdato for T12M-udtrækket (IKKE importdagen — så genkørsel
// samme baseline er idempotent).
const KLASSIFICERET_DATO = "2026-08-31";
const GRUNDLAG = "T12M ABC 31-08-2026";

const VALID_SEGMENTS = new Set(["A", "B", "C"]);

// ---------------------------------------------------------------------
// CSV-parsing
// ---------------------------------------------------------------------

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function nonEmpty(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s;
}

function toNumber(v) {
  const s = nonEmpty(v);
  if (s == null) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Kolonner (0-indexed):
 *  0: Kundenr, 1: Kunde, 2: Distrikt, 3: T12M (kr),
 *  4: Vækst % vs forrige 12m, 5: Retning, 6: Segment (forslag)
 */
function parseCsv(path) {
  const raw = stripBom(readFileSync(path, "utf8"));
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const [, ...dataLines] = lines; // drop header

  const stats = {
    total: dataLines.length,
    parsedAbc: 0,
    droppedX: 0,
    droppedInvalidSegment: 0,
    droppedNoKundenr: 0,
    duplicateKundenr: 0,
    perSegment: { A: 0, B: 0, C: 0 },
  };

  const seen = new Set();
  const rows = [];

  for (const line of dataLines) {
    const cols = line.split(";");
    const kundenr = nonEmpty(cols[0]);
    if (!kundenr) {
      stats.droppedNoKundenr++;
      continue;
    }
    if (seen.has(kundenr)) {
      stats.duplicateKundenr++;
      continue;
    }
    seen.add(kundenr);

    const segment = nonEmpty(cols[6]);
    if (segment === "X") {
      stats.droppedX++;
      continue;
    }
    if (!VALID_SEGMENTS.has(segment)) {
      stats.droppedInvalidSegment++;
      continue;
    }

    rows.push({
      visma_customer_no: kundenr,
      kunde: nonEmpty(cols[1]),
      segment,
      t12m_belob: toNumber(cols[3]),
      vaekst_pct: toNumber(cols[4]),
      retning: nonEmpty(cols[5]),
    });
    stats.parsedAbc++;
    stats.perSegment[segment]++;
  }

  return { rows, stats };
}

// ---------------------------------------------------------------------
// SQL-emission
// ---------------------------------------------------------------------

function sqlLit(v) {
  if (v == null) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildImportSql(rows) {
  const values = rows
    .map(
      (r) =>
        `(${[
          sqlLit(r.visma_customer_no),
          sqlLit(r.segment),
          sqlLit(r.t12m_belob),
          sqlLit(r.vaekst_pct),
          sqlLit(r.retning),
        ].join(", ")})`,
    )
    .join(",\n  ");

  return `
CREATE TEMP TABLE _lago_seg_in (
  visma_customer_no text PRIMARY KEY,
  segment           text NOT NULL CHECK (segment IN ('A', 'B', 'C')),
  t12m_belob        numeric(14, 2),
  vaekst_pct        numeric(6, 1),
  retning           text
) ON COMMIT DROP;

INSERT INTO _lago_seg_in
  (visma_customer_no, segment, t12m_belob, vaekst_pct, retning)
VALUES
  ${values};

DO $LAGO$
DECLARE
  r RECORD;
  cid bigint;
  cur text;
  effective_segment text;
  n_set int := 0;
  n_skipped_manual int := 0;
  n_missing int := 0;
  n_history_written int := 0;
BEGIN
  FOR r IN SELECT * FROM _lago_seg_in LOOP
    SELECT company_id, segment INTO cid, cur
      FROM public.companies_lago
     WHERE visma_customer_no = r.visma_customer_no;

    IF cid IS NULL THEN
      n_missing := n_missing + 1;
      RAISE NOTICE 'LAGO_SEG_MISS kundenr=%', r.visma_customer_no;
      CONTINUE;
    END IF;

    -- SEED-ONLY: sæt kun segment hvor det i dag er X.
    IF cur = 'X' THEN
      UPDATE public.companies_lago
         SET segment = r.segment, updated_at = now()
       WHERE company_id = cid;
      effective_segment := r.segment;
      n_set := n_set + 1;
    ELSE
      -- Manuel klassificering findes — historikken skal afspejle det
      -- FAKTISK gældende segment, ikke CSV-forslaget.
      effective_segment := cur;
      n_skipped_manual := n_skipped_manual + 1;
    END IF;

    INSERT INTO public.lago_segment_history
      (company_id, visma_customer_no, segment, klassificeret_dato,
       grundlag, t12m_belob, vaekst_pct, retning)
    VALUES
      (cid, r.visma_customer_no, effective_segment,
       DATE '${KLASSIFICERET_DATO}', '${GRUNDLAG}',
       r.t12m_belob, r.vaekst_pct, r.retning)
    ON CONFLICT (visma_customer_no, klassificeret_dato, grundlag) DO NOTHING;
  END LOOP;

  SELECT COUNT(*) INTO n_history_written
    FROM public.lago_segment_history
   WHERE klassificeret_dato = DATE '${KLASSIFICERET_DATO}'
     AND grundlag = '${GRUNDLAG}';

  RAISE NOTICE 'LAGO_SEG_DONE set=% skipped_manual=% missing=% history_rows_for_baseline=%',
    n_set, n_skipped_manual, n_missing, n_history_written;
END
$LAGO$;
`;
}

// ---------------------------------------------------------------------
// Dry-run — vis umatchede kundenr uden at røre DB'en
// ---------------------------------------------------------------------

async function reportMissingKundenr(rows) {
  const values = rows
    .map((r) => `(${sqlLit(r.visma_customer_no)}, ${sqlLit(r.kunde)})`)
    .join(",\n  ");

  const missing = await runSql(`
    WITH input(visma_customer_no, kunde) AS (
      VALUES
        ${values}
    )
    SELECT i.visma_customer_no, i.kunde
      FROM input i
      LEFT JOIN public.companies_lago cl
        ON cl.visma_customer_no = i.visma_customer_no
     WHERE cl.company_id IS NULL
     ORDER BY i.visma_customer_no;
  `);
  return missing;
}

async function reportCurrentSegmentDistribution(rows) {
  const values = rows
    .map((r) => `(${sqlLit(r.visma_customer_no)})`)
    .join(",\n  ");

  const dist = await runSql(`
    WITH input(visma_customer_no) AS (
      VALUES
        ${values}
    )
    SELECT COALESCE(cl.segment, '(no match)') AS current_segment,
           COUNT(*) AS n
      FROM input i
      LEFT JOIN public.companies_lago cl
        ON cl.visma_customer_no = i.visma_customer_no
     GROUP BY current_segment
     ORDER BY current_segment;
  `);
  return dist;
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("-") || a.includes("=") || a === "dry-run"));
  const positional = args.filter((a) => !flags.has(a));
  const csvPath = positional[0] ?? DEFAULT_CSV;
  const dryRun = flags.has("dry-run");

  if (!dryRun) requireConfirm();

  console.log(`Læser ${csvPath} …`);
  const { rows, stats } = parseCsv(csvPath);
  console.log("Parse-stats:", stats);
  if (rows.length === 0) {
    console.error("Ingen A/B/C-rækker fundet — afbryder.");
    process.exit(1);
  }

  console.log("\nCurrent segment-fordeling for CSV'ens kunder (før):");
  const dist = await reportCurrentSegmentDistribution(rows);
  console.log(dist);

  console.log("\nUmatchede kundenr (i CSV, ikke i companies_lago):");
  const missing = await reportMissingKundenr(rows);
  console.log(missing);

  const sql = buildImportSql(rows);

  if (dryRun) {
    console.log(`\n-- DRY RUN — ville skrive ${rows.length} A/B/C-rækker --`);
    console.log(sql.slice(0, 4000));
    console.log(`\n… (${sql.length} chars total, truncated)`);
    console.log(
      "\nDry-run færdig. Kør igen uden 'dry-run' og med confirm=YES for at applier.",
    );
    return;
  }

  console.log(
    `\nSender opdatering + historik-baseline for ${rows.length} kunder …`,
  );
  const result = await runSql(sql);
  console.log("Result:", result);

  console.log("\nSanity — segment-fordeling i companies_lago nu:");
  console.log(
    await runSql(
      `SELECT segment, COUNT(*) AS n
         FROM public.companies_lago
        GROUP BY segment
        ORDER BY segment;`,
    ),
  );

  console.log("\nSanity — historik-baseline pr. dato/grundlag:");
  console.log(
    await runSql(
      `SELECT klassificeret_dato, grundlag,
              COUNT(*) AS n,
              COUNT(*) FILTER (WHERE segment = 'A') AS a,
              COUNT(*) FILTER (WHERE segment = 'B') AS b,
              COUNT(*) FILTER (WHERE segment = 'C') AS c
         FROM public.lago_segment_history
        GROUP BY 1, 2
        ORDER BY 1 DESC, 2;`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
