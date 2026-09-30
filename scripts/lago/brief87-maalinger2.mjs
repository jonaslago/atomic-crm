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
  "PK på sales_monthly_lago",
  `SELECT a.attname AS kolonne
   FROM pg_index i
   JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
   WHERE i.indrelid = 'public.sales_monthly_lago'::regclass AND i.indisprimary
   ORDER BY array_position(i.indkey, a.attnum)`,
);

await q(
  "Er der flere rækker end (kunde,aar,maaned)?",
  `SELECT
     COUNT(*)::int AS raekker,
     COUNT(DISTINCT (visma_customer_no,aar,maaned))::int AS unikke_kunde_maaned,
     COUNT(DISTINCT produktnr)::int AS unikke_produkter
   FROM public.sales_monthly_lago`,
);

await q(
  "Forbrugt: har den værdier eller lutter NULL?",
  `SELECT
     COUNT(*)::int AS total,
     COUNT(forbrugt)::int AS med_vaerdi,
     SUM(forbrugt)::numeric(14,2) AS sum
   FROM public.sales_monthly_lago`,
);

await q(
  "v_open_orders_categorised kolonner",
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='v_open_orders_categorised'
   ORDER BY ordinal_position`,
);

await q(
  "Distinkte kategorier + antal linjer i v_open_orders_categorised",
  `SELECT kategori, COUNT(*)::int AS linjer
   FROM public.v_open_orders_categorised
   GROUP BY kategori
   ORDER BY linjer DESC`,
);

await q(
  "September 2026 tal — kan 'denne måned' bygges?",
  `SELECT
     COUNT(DISTINCT visma_customer_no)::int AS kunder,
     SUM(belob)::numeric(14,2) AS omsat
   FROM public.sales_monthly_lago
   WHERE aar=2026 AND maaned=9`,
);

await q(
  "September 2025 til sammenligning",
  `SELECT
     COUNT(DISTINCT visma_customer_no)::int AS kunder,
     SUM(belob)::numeric(14,2) AS omsat
   FROM public.sales_monthly_lago
   WHERE aar=2025 AND maaned=9`,
);
