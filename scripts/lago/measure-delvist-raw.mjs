// Verificerer antal_faerdigmeldt > 0 mod RÅ open_orders_lago (uden
// view-filter), for at bekræfte at 2.794.470 kr. er sande for Peter.
import { runSql } from "./supabaseAdmin.mjs";

async function q(label, sql) {
  console.log(`\n--- ${label} ---`);
  try {
    const r = await runSql(sql);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.log(`FEJL: ${e?.message ?? e}`);
  }
}

await q(
  "1 · Rå open_orders_lago: linjer med antal_faerdigmeldt > 0",
  `SELECT
     COUNT(*)::int AS linjer_i_alt,
     COUNT(*) FILTER (WHERE antal_faerdigmeldt > 0)::int AS delvist,
     COUNT(*) FILTER (WHERE antal_faerdigmeldt IS NULL)::int AS antal_faerdigmeldt_null,
     COUNT(*) FILTER (WHERE undtages_lagerhaandtering IS TRUE)::int AS undtaget
   FROM public.open_orders_lago`,
);

await q(
  "2 · Nulstillet indhold: mindst én række med delvis levering nogen steder?",
  `SELECT ordre_nr, linje_nr, antal, antal_faerdigmeldt, rest, ej_faktureret
   FROM public.open_orders_lago
   WHERE antal_faerdigmeldt > 0
   LIMIT 5`,
);

await q(
  "3 · Peters åbne ordrer: beloeb (ej_faktureret) totalt + evt. delvist",
  `SELECT
     COUNT(DISTINCT oo.ordre_nr)::int AS ordrer,
     COUNT(*)::int AS linjer,
     COUNT(*) FILTER (WHERE oo.antal_faerdigmeldt > 0)::int AS delvist,
     SUM(oo.ej_faktureret)::numeric(14,2) AS sum_ej_faktureret
   FROM public.open_orders_lago oo
   JOIN public.companies_lago cl ON cl.visma_customer_no = oo.visma_customer_no
   JOIN public.companies c ON c.id = cl.company_id
   JOIN public.sales s ON s.id = c.sales_id
   WHERE s.first_name = 'Peter'
     AND oo.undtages_lagerhaandtering IS NOT TRUE`,
);
