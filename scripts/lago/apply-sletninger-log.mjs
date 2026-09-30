/* eslint-disable no-console */
// Sletteregler (29. sep 2026): sletninger_lago tabel + triggere på
// company_notes_lago og customer_activities_lago + RPC'er der bærer
// begrundelsen ind via SET LOCAL.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929100000_lago_sletninger_log";

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
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );

  console.log("\nsletninger_lago struktur:");
  const cols = await runSql(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='sletninger_lago'
     ORDER BY ordinal_position`,
  );
  console.log(JSON.stringify(cols, null, 2));

  console.log("\ncompany_notes_lago har nu deleted_at:");
  const notesCol = await runSql(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='company_notes_lago'
       AND column_name='deleted_at'`,
  );
  console.log(JSON.stringify(notesCol, null, 2));

  console.log("\nTriggers:");
  const trigs = await runSql(
    `SELECT event_object_table AS tabel, trigger_name AS trigger
       FROM information_schema.triggers
      WHERE trigger_schema='public'
        AND trigger_name LIKE 'log_soft_delete%'
      ORDER BY tabel`,
  );
  console.log(JSON.stringify(trigs, null, 2));

  console.log("\nRPC'er:");
  const rpcs = await runSql(
    `SELECT routine_name FROM information_schema.routines
      WHERE routine_schema='public'
        AND routine_name IN ('soft_delete_note','restore_note','soft_delete_activity','restore_activity','log_soft_delete')
      ORDER BY routine_name`,
  );
  console.log(JSON.stringify(rpcs, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
