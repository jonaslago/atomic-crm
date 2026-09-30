/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929260000_lago_ringeliste_breakdown";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const path = resolve(__dirname, "..", "..", "supabase", "migrations", `${MIGRATION_NAME}.sql`);

async function main() {
  requireConfirm();
  const sql = readFileSync(path, "utf8");
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(`INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('${MIGRATION_NAME.slice(0,14)}') ON CONFLICT DO NOTHING;`);

  const r = await runSql(`
    SELECT (public.dashboard_ringeliste_lago(500))->>'total' AS total,
           (public.dashboard_ringeliste_lago(500))->>'total_overdue' AS overdue,
           (public.dashboard_ringeliste_lago(500))->>'total_never_visited' AS never_visited;
  `);
  console.log("\nRingeliste-tal (forventet 141 / 103 / 38):");
  console.log(JSON.stringify(r, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
