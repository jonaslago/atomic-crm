// Brief 87 tillæg (28. sep 2026): er beloeb linjens fulde værdi eller
// det der udestår? Findes der åbne linjer med antal_faerdigmeldt > 0?
// Forskel = det der allerede er faktureret, som ikke bør tælles med
// på "Åbne ordrer".
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
  "1 · v_open_orders_categorised: total sum vs delvist-fakturerede linjer",
  `SELECT
     COUNT(*)::int AS linjer,
     COUNT(*) FILTER (WHERE antal_faerdigmeldt > 0)::int AS delvist_fakturerede,
     SUM(beloeb)::numeric(14,2) AS sum_beloeb,
     SUM(beloeb) FILTER (WHERE antal_faerdigmeldt > 0)::numeric(14,2) AS sum_beloeb_delvist
   FROM public.v_open_orders_categorised`,
);

await q(
  "2 · Underliggende open_orders_lago (raw): beloeb-kolonner",
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='open_orders_lago'
     AND (column_name ILIKE '%bel%' OR column_name ILIKE '%rest%' OR column_name ILIKE '%fakt%')`,
);

await q(
  "3 · open_orders_lago: sammenlign beloeb, rest, i_rest, ej_faktureret",
  `SELECT
     COUNT(*)::int AS linjer,
     COUNT(*) FILTER (WHERE antal_faerdigmeldt > 0)::int AS delvist,
     COUNT(*) FILTER (WHERE rest IS NOT NULL AND rest <> antal)::int AS rest_diff_antal,
     COUNT(*) FILTER (WHERE ej_faktureret > 0)::int AS med_ej_faktureret,
     SUM(beloeb)::numeric(14,2) AS sum_beloeb,
     SUM(rest * (beloeb / NULLIF(antal, 0)))::numeric(14,2) AS sum_rest_belob_beregnet,
     SUM(ej_faktureret)::numeric(14,2) AS sum_ej_faktureret
   FROM public.open_orders_lago
   WHERE undtages_lagerhaandtering IS NOT TRUE`,
);

await q(
  "4 · Eksempel: første 3 delvist-fakturerede linjer",
  `SELECT
     ordre_nr, linje_nr, antal, antal_faerdigmeldt, rest, beloeb, ej_faktureret
   FROM public.v_open_orders_categorised
   WHERE antal_faerdigmeldt > 0
   ORDER BY antal_faerdigmeldt DESC
   LIMIT 3`,
);

await q(
  "5 · Peter Ærensgaard's tal i den nye visning",
  `SELECT
     COUNT(DISTINCT ordre_nr)::int AS ordrer,
     COUNT(*)::int AS linjer,
     SUM(beloeb)::numeric(14,2) AS sum_beloeb_faerd_med,
     SUM(CASE WHEN antal_faerdigmeldt = 0 THEN beloeb ELSE ej_faktureret END)::numeric(14,2) AS sum_udestaaende
   FROM public.v_open_orders_categorised v
   JOIN public.companies c ON c.id = v.company_id
   JOIN public.sales s ON s.id = c.sales_id
   WHERE s.first_name = 'Peter'`,
);
