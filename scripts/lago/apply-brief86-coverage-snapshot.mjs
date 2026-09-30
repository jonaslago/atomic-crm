/* eslint-disable no-console */
// Brief 86 §7 (28. sep 2026): coverage_snapshot_lago + refresh-funktion.
// Første snapshot skrives i migration-scriptet så kurven begynder nu.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260928235500_lago_86_coverage_snapshot";

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

  console.log("\nFørste snapshot:");
  const rows = await runSql(
    `SELECT dato, segment, ajour, traenger, overskredet, i_alt
     FROM public.coverage_snapshot_lago
     ORDER BY segment`,
  );
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
