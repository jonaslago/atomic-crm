/* eslint-disable no-console */
// Brief 89 (28. sep 2026): ordre_kommentar_lago + close_matched_ordre_kommentarer.
// Jonas godkendte eksplicit — skal demonstreres i morgen.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260928230000_lago_89_ordre_kommentarer";

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

  console.log("BEFORE — tabel eksisterer?");
  const before = await runSql(
    `SELECT to_regclass('public.ordre_kommentar_lago')::text AS tabel`,
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

  console.log("\nAFTER — tabel + funktion + policies:");
  const after = await runSql(
    `SELECT
       (SELECT to_regclass('public.ordre_kommentar_lago')::text) AS tabel,
       (SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='close_matched_ordre_kommentarer') AS funktion,
       (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='ordre_kommentar_lago') AS policies`,
  );
  console.log("  ", JSON.stringify(after));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
