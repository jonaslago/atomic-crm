/* eslint-disable no-console */
// Apply brief 78 tillæg A migration to the cloud database via the
// Management API, then verify columns + a sample recompute.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260922060000_lago_78_note_undtages_i_rest";

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
  console.log(`Applying migration ${MIGRATION_NAME} …`);
  await runSql(sql);
  console.log("Recording in schema_migrations …");
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );
  console.log("Verifying columns …");
  const cols = await runSql(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'open_orders_lago'
        AND column_name IN ('note', 'undtages_lagerhaandtering', 'rest', 'reserveret_mod_lager')
      ORDER BY column_name;`,
  );
  console.log(JSON.stringify(cols, null, 2));

  console.log("\nSpot-check AEvin #34696 (før par-detektion) …");
  const aevin = await runSql(
    `SELECT ordre_nr, linje_nr, produktnr, antal, rest, reserveret_mod_lager,
            ej_faktureret, undtages_lagerhaandtering, note
       FROM public.open_orders_lago
      WHERE ordre_nr = '34696'
      ORDER BY linje_nr;`,
  );
  console.log(JSON.stringify(aevin, null, 2));

  console.log("\nToenden totals (klar/afventer med ny formel) …");
  const toenden = await runSql(
    `SELECT
       ROUND(SUM(CASE WHEN COALESCE(reserveret_mod_lager,0) >= antal THEN ej_faktureret ELSE 0 END)) AS klar,
       ROUND(SUM(CASE WHEN COALESCE(reserveret_mod_lager,0) < antal THEN ej_faktureret ELSE 0 END)) AS afventer,
       ROUND(SUM(ej_faktureret)) AS i_alt,
       COUNT(*) AS antal_linjer
     FROM public.open_orders_lago
     WHERE visma_customer_no = '56397045';`,
  );
  console.log(JSON.stringify(toenden, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
