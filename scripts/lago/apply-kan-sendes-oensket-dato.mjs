/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929270000_lago_kan_sendes_oensket_dato";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const path = resolve(__dirname, "..", "..", "supabase", "migrations", `${MIGRATION_NAME}.sql`);

async function main() {
  requireConfirm();
  const sql = readFileSync(path, "utf8");
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(`INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('${MIGRATION_NAME.slice(0,14)}') ON CONFLICT DO NOTHING;`);

  const t = await runSql(`
    SELECT (public.dashboard_kan_sendes_lago(500))->>'total' AS kunder,
           (public.dashboard_kan_sendes_lago(500))->>'total_ordrer' AS ordrer,
           (public.dashboard_kan_sendes_lago(500))->>'total_beloeb' AS beloeb;
  `);
  console.log("\nNye Kan sendes-tal (forventet ~31 ordrer / ~408.500 kr):");
  console.log(JSON.stringify(t, null, 2));

  const renes = await runSql(`
    WITH d AS (SELECT public.dashboard_kan_sendes_lago(500) AS p)
    SELECT r.value ->> 'kunde' AS kunde,
           (r.value ->> 'antal_ordrer')::int AS ordrer,
           r.value ->> 'beloeb' AS beloeb,
           r.value -> 'ordre_numre' AS ordre_numre
    FROM d, jsonb_array_elements(d.p -> 'rows') AS r
    WHERE r.value ->> 'kunde' ILIKE '%Rene%' OR r.value ->> 'visma_customer_no' = '98213338';
  `);
  console.log("\nRenes Vin efter fix (forventet 1 ordre 26.700 kr):");
  console.log(JSON.stringify(renes, null, 2));

  const passeret = await runSql(`
    WITH d AS (SELECT public.dashboard_kan_sendes_lago(500) AS p)
    SELECT r.value ->> 'kunde' AS kunde,
           r.value ->> 'har_passeret_dato' AS passeret,
           r.value ->> 'aeldste_passeret_dato' AS aeldste_passeret,
           r.value ->> 'beloeb' AS beloeb
    FROM d, jsonb_array_elements(d.p -> 'rows') AS r
    WHERE (r.value ->> 'har_passeret_dato')::boolean
    LIMIT 10;
  `);
  console.log("\nKunder med passeret dato (skal stå øverst):");
  console.log(JSON.stringify(passeret, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
