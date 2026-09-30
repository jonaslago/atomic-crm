// Verificerer MAV-tallene mod basen. Sammenhold med Jonas' måling
// fra kildefilen: 26 kunder, 65 linjer, 230.703 kr.
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
  "MAV i hele basen (skal give 26 kunder / 65 linjer / 230.703 kr)",
  `SELECT
     COUNT(DISTINCT company_id)::int AS kunder,
     COUNT(*)::int AS linjer,
     SUM(beloeb)::numeric(14,2) AS beloeb
   FROM public.v_open_orders_categorised
   WHERE mav IS TRUE`,
);

await q(
  "MAV pr. sælger (top 5) — hvad ser de faktisk?",
  `SELECT
     s.first_name || ' ' || s.last_name AS saelger,
     COUNT(DISTINCT c.id)::int AS kunder,
     COUNT(*)::int AS linjer,
     SUM(v.beloeb)::numeric(14,2) AS beloeb
   FROM public.v_open_orders_categorised v
   JOIN public.companies c ON c.id = v.company_id
   LEFT JOIN public.sales s ON s.id = c.sales_id
   WHERE v.mav IS TRUE
   GROUP BY s.first_name, s.last_name
   ORDER BY beloeb DESC NULLS LAST
   LIMIT 8`,
);

await q(
  "Peters MAV specifikt (test-scope for widget)",
  `SELECT
     COUNT(DISTINCT c.id)::int AS kunder,
     COUNT(*)::int AS linjer,
     SUM(v.beloeb)::numeric(14,2) AS beloeb
   FROM public.v_open_orders_categorised v
   JOIN public.companies c ON c.id = v.company_id
   JOIN public.sales s ON s.id = c.sales_id
   WHERE v.mav IS TRUE
     AND s.first_name = 'Peter'`,
);

await q(
  "Til kontor-briefen: almindelig klar = 171 / 73 / 2.289.423 kr — verificér",
  `SELECT
     COUNT(DISTINCT ordre_nr)::int AS ordrer,
     COUNT(DISTINCT company_id)::int AS kunder,
     SUM(beloeb)::numeric(14,2) AS beloeb
   FROM public.v_open_orders_categorised
   WHERE lagerstatus = 'klar'
     AND kategori = 'normal'`,
);
