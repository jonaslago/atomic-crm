/* eslint-disable no-console */
// Brief 90 §3 (28. sep 2026): sæsonlukket-periode på companies_lago +
// priority-view. Uret tikker, statussen skjuler den; når vinduet er
// forbi, får kunden sin gamle overskridelse tilbage.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929010000_lago_90_saesonlukket";

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

  console.log("\nKolonner tilføjet:");
  const cols = await runSql(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='companies_lago'
       AND column_name IN ('saesonlukket_fra','saesonlukket_til')`,
  );
  console.log(JSON.stringify(cols, null, 2));

  console.log("\nStatus-fordeling i customers_with_priority_lago (efter):");
  const dist = await runSql(
    `SELECT status, COUNT(*)::int AS n FROM public.customers_with_priority_lago
     GROUP BY status ORDER BY status`,
  );
  console.log(JSON.stringify(dist, null, 2));

  console.log(
    "\nIngen kunder er saesonlukket endnu (kolonnerne er NULL for alle) —",
    "\ndet forventes.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
