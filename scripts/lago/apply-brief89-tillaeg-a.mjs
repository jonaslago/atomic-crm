/* eslint-disable no-console */
// Brief 89 tillæg A (28. sep 2026): udvid hensigt-CHECK til 6 værdier
// + opdater auto-luk-funktion så send_med_naeste_ordre bortfalder når
// linjen står som MAV eller ordren er ekspederet.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME =
  "20260928234500_lago_89_tillaeg_A_send_med_naeste";

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

  console.log("BEFORE — CHECK-constraint tillader:");
  const before = await runSql(
    `SELECT pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conrelid='public.ordre_kommentar_lago'::regclass
       AND conname='ordre_kommentar_lago_hensigt_check'`,
  );
  console.log("  ", JSON.stringify(before));

  const sql = readFileSync(migrationPath, "utf8");
  console.log("\nApplying migration " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );

  console.log("\nAFTER — CHECK-constraint tillader:");
  const after = await runSql(
    `SELECT pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conrelid='public.ordre_kommentar_lago'::regclass
       AND conname='ordre_kommentar_lago_hensigt_check'`,
  );
  console.log("  ", JSON.stringify(after));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
