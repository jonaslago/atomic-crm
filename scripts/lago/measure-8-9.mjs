/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== §8a · aktive kunder pr. distrikt vs rapport (221) ===");
  const s8a = await runSql(`
    SELECT
      CASE WHEN distrikt IN ('Øst','Vest','HQ') THEN distrikt ELSE 'Andet' END AS distrikt_bucket,
      COUNT(*)::int AS kunder
    FROM public.companies_lago
    WHERE is_active = true AND is_visible_to_sales = true
      AND (segment IS NULL OR segment <> 'L')
    GROUP BY distrikt_bucket
    ORDER BY distrikt_bucket
  `);
  console.log(JSON.stringify(s8a, null, 2));
  const s8aTotal = await runSql(`
    SELECT COUNT(*)::int AS kunder
    FROM public.companies_lago
    WHERE is_active = true AND is_visible_to_sales = true
      AND (segment IS NULL OR segment <> 'L')
  `);
  console.log("Total:", s8aTotal);
  console.log("Rapport: 221 (Øst 99 · Vest 101 · HQ 20 · Andet 1)");
  console.log("Vores: 260 aktive — hvor kommer 39 fra?");
  const s8aNoDist = await runSql(`
    SELECT COUNT(*)::int AS uden_distrikt
    FROM public.companies_lago
    WHERE is_active = true AND is_visible_to_sales = true
      AND (segment IS NULL OR segment <> 'L')
      AND (distrikt IS NULL OR distrikt NOT IN ('Øst','Vest','HQ'))
  `);
  console.log("Uden Øst/Vest/HQ-distrikt:", s8aNoDist);
  const s8aSegm = await runSql(`
    SELECT segment, COUNT(*)::int
    FROM public.companies_lago
    WHERE is_active = true AND is_visible_to_sales = true
      AND (segment IS NULL OR segment <> 'L')
    GROUP BY segment ORDER BY segment NULLS LAST
  `);
  console.log("Fordelt på segment:", s8aSegm);

  console.log("\n=== §8b · ringeliste vs 'Tabt' (rapport: 55 uden omsætning i år, 28 Tabt) ===");
  const s8bRing = await runSql(`
    WITH kandidater AS (
      SELECT c.id, c.name, vp.status, vp.days_overdue,
             cas.i_aar, cas.sidste_aar, cas.inaktiv
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      JOIN public.customers_with_priority_lago vp ON vp.company_id = c.id
      LEFT JOIN public.v_customer_activity_status cas ON cas.company_id = c.id
     WHERE cl.is_visible_to_sales = true
       AND cl.is_active = true
       AND cl.next_visit_planned IS NULL
       AND ((vp.status = 'overdue' AND vp.days_overdue >= 14)
            OR vp.status = 'never_visited')
    )
    SELECT
      COUNT(*) AS ringeliste_i_alt,
      COUNT(*) FILTER (WHERE COALESCE(i_aar, 0) = 0) AS ingen_i_aar,
      COUNT(*) FILTER (WHERE inaktiv = true) AS er_inaktiv
    FROM kandidater
  `);
  console.log(JSON.stringify(s8bRing, null, 2));

  console.log("\n=== §9e · Salg og ordrer widget-afgrænsning ===");
  console.log("Widget kaldes med mySalesId (view = sælgerens portefølje).");
  console.log("Åbne ordre-tal beregnes via aggregation på ALL åbne ordrer for de kunder sælgeren ejer.");
  console.log("Widget viser MÅNEDEN mod sidste år (fra sales_monthly_lago), IKKE aldersbuckets.");
  console.log("Ingen aktiv ekskludering af En Primeur i den nuværende widget-kode.");
}
main().catch(e => { console.error(e); process.exit(1); });
