/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929250000_lago_ringeliste_never_visited";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const path = resolve(__dirname, "..", "..", "supabase", "migrations", `${MIGRATION_NAME}.sql`);

async function main() {
  requireConfirm();
  const sql = readFileSync(path, "utf8");
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(`INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('${MIGRATION_NAME.slice(0,14)}') ON CONFLICT DO NOTHING;`);

  console.log("\nNyt ringeliste-total (forventet 141):");
  const r = await runSql(`
    SELECT (public.dashboard_ringeliste_lago(500))->>'total' AS total;
  `);
  console.log(JSON.stringify(r, null, 2));

  console.log("\nBreakdown: overdue vs never_visited");
  const b = await runSql(`
    WITH d AS (SELECT public.dashboard_ringeliste_lago(500) AS p)
    SELECT
      COUNT(*) FILTER (WHERE r.value ->> 'status' = 'overdue') AS overdue,
      COUNT(*) FILTER (WHERE r.value ->> 'status' = 'never_visited') AS never_visited,
      COUNT(*) AS total
    FROM d, jsonb_array_elements(d.p -> 'rows') AS r
  `);
  console.log(JSON.stringify(b, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
