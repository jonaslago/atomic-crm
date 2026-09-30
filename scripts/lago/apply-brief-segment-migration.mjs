// Apply the LAGO Import-brief 5b migration
// (20260901120000_lago_segment_history.sql) to the cloud database, then
// record it in supabase_migrations.schema_migrations so `supabase db push`
// won't try to re-run it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260901120000_lago_segment_history";

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
  console.log(`Applying migration ${MIGRATION_NAME} …`);
  await runSql(sql);
  console.log("Migration applied. Recording in schema_migrations …");
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );
  console.log("Verifying columns …");
  const cols = await runSql(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lago_segment_history'
      ORDER BY ordinal_position;`,
  );
  console.log(cols);
  console.log("Row count (skal være 0 lige efter migration):");
  console.log(
    await runSql(`SELECT COUNT(*) FROM public.lago_segment_history;`),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
