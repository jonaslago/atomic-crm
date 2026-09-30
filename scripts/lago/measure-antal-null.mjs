/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== Antal-fordeling i open_orders_lago ===");
  const fordeling = await runSql(`
    SELECT
      COUNT(*) FILTER (WHERE antal IS NULL) AS antal_null,
      COUNT(*) FILTER (WHERE antal = 0) AS antal_nul,
      COUNT(*) FILTER (WHERE antal > 0) AS antal_positiv,
      COUNT(*) AS i_alt,
      COUNT(*) FILTER (WHERE ej_faktureret = 0) AS beloeb_nul,
      COUNT(*) FILTER (WHERE ej_faktureret = 0 AND antal = 0) AS begge_nul
    FROM public.open_orders_lago
  `);
  console.log(JSON.stringify(fordeling, null, 2));

  console.log("\n=== Ordre 32470 · linjenumre der findes (mulige huller) ===");
  const linjer = await runSql(`
    SELECT linje_nr, produktnr, antal, ej_faktureret
    FROM public.open_orders_lago WHERE ordre_nr='32470'
    ORDER BY linje_nr::int
  `);
  console.log(JSON.stringify(linjer, null, 2));

  console.log("\n=== Import-log for åbne ordrer (seneste 5 kørsler) ===");
  const runs = await runSql(`
    SELECT id, koert_af, koert_at, dataset, rows_written, rows_skipped, rows_rejected, meta
    FROM public.sync_runs_lago
    WHERE dataset = 'open_orders_lago'
    ORDER BY koert_at DESC
    LIMIT 5
  `);
  console.log(JSON.stringify(runs, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
