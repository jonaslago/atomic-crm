// Apply the LAGO Domain-brief 5 migration
// (20260710120000_lago_companies_visma_import_fields.sql) to the cloud
// database via the Management API, then record it in
// supabase_migrations.schema_migrations so `supabase db push` won't try
// to re-run it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260710120000_lago_companies_visma_import_fields";

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
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies_lago'
      ORDER BY ordinal_position;`,
  );
  console.log(cols);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
