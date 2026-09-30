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
  "Beloeb-fordeling på v_open_orders_categorised",
  `SELECT
     COUNT(*)::int AS raekker,
     COUNT(*) FILTER (WHERE beloeb IS NOT NULL AND beloeb <> 0)::int AS med_beloeb,
     SUM(beloeb)::numeric(14,2) AS sum_beloeb
   FROM public.v_open_orders_categorised`,
);

await q(
  "Sample-kunde: Peter Ærensgaards kunder — hvor mange, hvor mange ordre-linjer",
  `SELECT
     COUNT(DISTINCT c.id)::int AS kunder,
     COUNT(*)::int AS ordre_linjer,
     SUM(v.beloeb)::numeric(14,2) AS ordre_beloeb
   FROM public.v_open_orders_categorised v
   JOIN public.companies c ON c.id = v.company_id
   JOIN public.sales s ON s.id = c.sales_id
   WHERE s.first_name = 'Peter'`,
);

await q(
  "Peter Ærensgaards salg september 2026",
  `SELECT
     COUNT(DISTINCT sm.visma_customer_no)::int AS kunder,
     SUM(sm.belob)::numeric(14,2) AS beloeb
   FROM public.sales_monthly_lago sm
   JOIN public.companies_lago cl ON cl.visma_customer_no = sm.visma_customer_no
   JOIN public.companies c ON c.id = cl.company_id
   JOIN public.sales s ON s.id = c.sales_id
   WHERE s.first_name = 'Peter' AND sm.aar = 2026 AND sm.maaned = 9`,
);
