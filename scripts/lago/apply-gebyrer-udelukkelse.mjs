/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929290000_lago_effective_view_ekskl_gebyrer";

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
  console.log("\nKan sendes efter §16 (gebyrer udelukket):");
  console.log(JSON.stringify(t, null, 2));

  // Verificér 35045 (blev blokeret af Vej/Energi)
  const r35045 = await runSql(`
    WITH d AS (SELECT public.dashboard_kan_sendes_lago(500) AS p)
    SELECT r.value ->> 'kunde' AS kunde,
           r.value ->> 'beloeb' AS beloeb,
           r.value -> 'ordre_numre' AS ordre_numre
    FROM d, jsonb_array_elements(d.p -> 'rows') AS r
    WHERE r.value -> 'ordre_numre' @> '"35045"'::jsonb
  `);
  console.log("\n35045 (skulle nu være med):");
  console.log(JSON.stringify(r35045, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
