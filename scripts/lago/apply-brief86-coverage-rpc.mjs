/* eslint-disable no-console */
// Brief 86 §3+§12 (28. sep 2026): live-RPC coverage_by_segment_status.
// Widget'en skal stemme med venstreskinnen HELE dagen, ikke kun ved
// dagens snapshot. Kalder samme filter som refresh_coverage_snapshot.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929000000_lago_86_coverage_by_segment_rpc";

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

  console.log("\nLive-tal fra coverage_by_segment_status():");
  const rows = await runSql(
    `SELECT * FROM public.coverage_by_segment_status()`,
  );
  console.log(JSON.stringify(rows, null, 2));

  console.log("\nSummer på tværs:");
  const totals = await runSql(
    `SELECT
        SUM(ajour)::int AS ajour,
        SUM(traenger)::int AS traenger,
        SUM(overskredet)::int AS overskredet,
        SUM(i_alt)::int AS i_alt
     FROM public.coverage_by_segment_status()`,
  );
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
