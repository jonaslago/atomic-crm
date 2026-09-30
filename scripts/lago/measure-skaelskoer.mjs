/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== Skælskør Vinhandel · alle åbne ordrer med linje-detaljer ===");
  const rows = await runSql(`
    SELECT
      o.ordre_nr, o.linje_nr, o.produktnr, o.antal, o.reserveret_mod_lager,
      o.ej_faktureret, o.lagerstatus, o.levering, o.status, o.mav
    FROM public.open_orders_lago o
    JOIN public.companies_lago cl ON cl.visma_customer_no = o.visma_customer_no
    JOIN public.companies c ON c.id = cl.company_id
    WHERE c.name ILIKE '%Skælskør%Vinhandel%'
    ORDER BY o.ordre_nr, o.linje_nr::int
  `);
  console.log(JSON.stringify(rows, null, 2));

  console.log("\n=== Skælskør · pr. ordre-aggregeret status ===");
  const agg = await runSql(`
    WITH s AS (
      SELECT o.*
      FROM public.open_orders_lago o
      JOIN public.companies_lago cl ON cl.visma_customer_no = o.visma_customer_no
      JOIN public.companies c ON c.id = cl.company_id
      WHERE c.name ILIKE '%Skælskør%Vinhandel%'
    )
    SELECT
      ordre_nr,
      COUNT(*) AS linjer,
      MIN(levering) AS min_lev, MAX(levering) AS max_lev,
      MIN(status) AS min_status, MAX(status) AS max_status,
      BOOL_AND(lagerstatus='klar') AS all_klar,
      BOOL_AND(levering='0') AS alle_lev_0,
      BOOL_AND(levering='1') AS alle_lev_1,
      BOOL_AND(levering='5') AS alle_lev_5,
      BOOL_AND(COALESCE(mav,false)) AS alle_mav,
      SUM(ej_faktureret)::numeric(14,2) AS ordre_belob
    FROM s
    GROUP BY ordre_nr
    ORDER BY ordre_nr
  `);
  console.log(JSON.stringify(agg, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
