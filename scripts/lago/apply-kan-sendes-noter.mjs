/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929240000_lago_kan_sendes_noter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const path = resolve(__dirname, "..", "..", "supabase", "migrations", `${MIGRATION_NAME}.sql`);

async function main() {
  requireConfirm();
  const sql = readFileSync(path, "utf8");
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(`INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('${MIGRATION_NAME.slice(0,14)}') ON CONFLICT DO NOTHING;`);

  console.log("\nVerifikation: kunder med noter i Kan sendes:");
  const noter = await runSql(`
    WITH d AS (SELECT public.dashboard_kan_sendes_lago(500) AS p)
    SELECT r.value ->> 'kunde' AS kunde,
           jsonb_array_length(r.value -> 'ordre_noter') AS antal_noter,
           r.value -> 'ordre_noter' AS ordre_noter
    FROM d, jsonb_array_elements(d.p -> 'rows') AS r
    WHERE jsonb_array_length(r.value -> 'ordre_noter') > 0
    ORDER BY jsonb_array_length(r.value -> 'ordre_noter') DESC, kunde
  `);
  console.log(JSON.stringify(noter, null, 2));

  console.log("\nSkælskør Vinhandel ApS · noter:");
  const sk = await runSql(`
    WITH d AS (SELECT public.dashboard_kan_sendes_lago(500) AS p)
    SELECT r.value -> 'ordre_noter' AS ordre_noter
    FROM d, jsonb_array_elements(d.p -> 'rows') AS r
    WHERE r.value ->> 'kunde' ILIKE '%Skælskør%'
  `);
  console.log(JSON.stringify(sk, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
