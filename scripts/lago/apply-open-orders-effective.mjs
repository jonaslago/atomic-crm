/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929220000_lago_open_orders_effective_view";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const path = resolve(__dirname, "..", "..", "supabase", "migrations", `${MIGRATION_NAME}.sql`);

async function main() {
  requireConfirm();
  const sql = readFileSync(path, "utf8");
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(`INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('${MIGRATION_NAME.slice(0,14)}') ON CONFLICT DO NOTHING;`);

  console.log("\nVerifikation: par-antal (forventet 37 par)");
  const par = await runSql(`
    SELECT COUNT(*) AS par_antal
    FROM public.open_orders_effective_lago
    WHERE er_par_komponent = true
  `);
  console.log(par);

  console.log("\n#34868 · effective-lagerstatus efter par-detektion:");
  const r34868 = await runSql(`
    SELECT linje_nr, produktnr, antal, reserveret_mod_lager,
           reserveret_effective, lagerstatus, lagerstatus_effective,
           er_par_komponent
    FROM public.open_orders_effective_lago
    WHERE ordre_nr = '34868'
    ORDER BY linje_nr::int
  `);
  console.log(JSON.stringify(r34868, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
