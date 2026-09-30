/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929230000_lago_kan_sendes_uses_effective";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const path = resolve(__dirname, "..", "..", "supabase", "migrations", `${MIGRATION_NAME}.sql`);

async function main() {
  requireConfirm();
  const sql = readFileSync(path, "utf8");
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(`INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('${MIGRATION_NAME.slice(0,14)}') ON CONFLICT DO NOTHING;`);

  console.log("\nNye Kan sendes-tal (efter par-detektion):");
  const t = await runSql(`
    SELECT (public.dashboard_kan_sendes_lago(500))->>'total' AS kunder,
           (public.dashboard_kan_sendes_lago(500))->>'total_ordrer' AS ordrer,
           (public.dashboard_kan_sendes_lago(500))->>'total_beloeb' AS beloeb
  `);
  console.log(t);

  console.log("\nSkælskør Vinhandel efter par:");
  const sk = await runSql(`
    WITH d AS (SELECT public.dashboard_kan_sendes_lago(500) AS p)
    SELECT r.value ->> 'kunde' AS kunde,
           (r.value ->> 'antal_ordrer')::int AS ordrer,
           r.value ->> 'beloeb' AS beloeb,
           r.value -> 'ordre_numre' AS ordre_numre
    FROM d, jsonb_array_elements(d.p -> 'rows') AS r
    WHERE r.value ->> 'kunde' ILIKE '%Skælskør%'
  `);
  console.log(JSON.stringify(sk, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
