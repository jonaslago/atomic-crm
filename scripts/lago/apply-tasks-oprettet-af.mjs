/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929200000_lago_tasks_oprettet_af";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationPath = resolve(
  __dirname, "..", "..", "supabase", "migrations", `${MIGRATION_NAME}.sql`,
);

async function main() {
  requireConfirm();
  const sql = readFileSync(migrationPath, "utf8");
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}') ON CONFLICT DO NOTHING;`,
  );
  const cols = await runSql(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='tasks' AND column_name='oprettet_af'`,
  );
  console.log("tasks.oprettet_af:", cols);
}
main().catch((e) => { console.error(e); process.exit(1); });
