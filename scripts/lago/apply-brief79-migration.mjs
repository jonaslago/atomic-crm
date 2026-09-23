/* eslint-disable no-console */
// Brief 79: drop lago_last_visit_backup_20260919 + set security_invoker=on
// on six LAGO views. Verify state before + after. Jonas har godkendt eksplicit
// i chatten den 23. sep 2026.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260923140000_lago_79_drop_backup_and_secure_views";

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

  console.log("BEFORE — backup-table exists:");
  const before = await runSql(
    `SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='lago_last_visit_backup_20260919') AS exists;`,
  );
  console.log(JSON.stringify(before));

  console.log("\nBEFORE — views' security_invoker:");
  const viewsBefore = await runSql(
    `SELECT c.relname, c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='v' ORDER BY c.relname;`,
  );
  for (const v of viewsBefore) {
    const opts = v.reloptions || [];
    const inv =
      opts.find((o) => o.startsWith("security_invoker=")) ||
      "(default: security_definer)";
    console.log("  " + v.relname + "  " + inv);
  }

  const sql = readFileSync(migrationPath, "utf8");
  console.log(`\nApplying migration ${MIGRATION_NAME} …`);
  await runSql(sql);
  console.log("Recording in schema_migrations …");
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );

  console.log("\nAFTER — backup-table exists:");
  const after = await runSql(
    `SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='lago_last_visit_backup_20260919') AS exists;`,
  );
  console.log(JSON.stringify(after));

  console.log("\nAFTER — views' security_invoker:");
  const viewsAfter = await runSql(
    `SELECT c.relname, c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='v' ORDER BY c.relname;`,
  );
  for (const v of viewsAfter) {
    const opts = v.reloptions || [];
    const inv =
      opts.find((o) => o.startsWith("security_invoker=")) ||
      "(default: security_definer)";
    console.log("  " + v.relname + "  " + inv);
  }

  console.log("\nAFTER — tabeller uden RLS i public:");
  const noRls = await runSql(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false ORDER BY c.relname;`,
  );
  console.log(JSON.stringify(noRls));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
