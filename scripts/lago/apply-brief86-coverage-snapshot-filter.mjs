/* eslint-disable no-console */
// Brief 86 §7 opfølgning (28. sep 2026): filter-korrektion på
// refresh_coverage_snapshot. Første version viste 346 fordi den tog
// alle is_active-kunder inkl. skjulte og L. Nu filtreres som venstre-
// skinnen på kundelisten — så snapshot og venstreskinne stemmer.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260928235900_lago_86_coverage_snapshot_filter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationPath = resolve(
  __dirname,
  "..",
  "..",
  "supabase",
  "migrations",
  `${MIGRATION_NAME}.sql`,
);

async function main() {
  requireConfirm();
  const sql = readFileSync(migrationPath, "utf8");
  console.log("Applying migration " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );

  console.log("\nSnapshot efter fix (i dag):");
  const rows = await runSql(
    `SELECT dato, segment, ajour, traenger, overskredet, i_alt
     FROM public.coverage_snapshot_lago
     WHERE dato = CURRENT_DATE
     ORDER BY segment`,
  );
  console.log(JSON.stringify(rows, null, 2));

  console.log("\nSum af snapshot i dag:");
  const totals = await runSql(
    `SELECT SUM(ajour)::int AS ajour, SUM(traenger)::int AS traenger,
            SUM(overskredet)::int AS overskredet, SUM(i_alt)::int AS i_alt
     FROM public.coverage_snapshot_lago
     WHERE dato = CURRENT_DATE`,
  );
  console.log(JSON.stringify(totals, null, 2));

  console.log(
    "\nSammenlign med venstreskinnen på /companies — tallene skal stemme.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
