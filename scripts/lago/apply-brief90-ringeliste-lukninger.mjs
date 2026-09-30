/* eslint-disable no-console */
// Brief 90 §2 (28. sep 2026): ringeliste-lukninger med begrundelse
// + auto-luk-view + opdatér dashboard_ringeliste_lago til at udelukke
// aktive lukninger.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929030000_lago_90_ringeliste_lukninger";

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

  const total = await runSql(
    `SELECT (public.dashboard_ringeliste_lago(500))->>'total' AS total`,
  );
  console.log("\nRingeliste total efter (skal være uændret 106 indtil nogen lukker):", total[0].total);

  const active = await runSql(
    `SELECT COUNT(*)::int AS n FROM public.v_active_ringeliste_lukninger_lago`,
  );
  console.log("Aktive lukninger:", active);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
