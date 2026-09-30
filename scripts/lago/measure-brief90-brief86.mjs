/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== Ringeliste: kunder ved forskellige tærskler ===");
  const rings = await runSql(`
    WITH candidates AS (
      SELECT vp.days_overdue
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      JOIN public.customers_with_priority_lago vp ON vp.company_id = cl.company_id
      WHERE cl.is_visible_to_sales = true
        AND cl.is_active = true
        AND cl.next_visit_planned IS NULL
        AND vp.status = 'overdue'
    )
    SELECT
      COUNT(*) FILTER (WHERE days_overdue >= 5)  AS ring_5,
      COUNT(*) FILTER (WHERE days_overdue >= 7)  AS ring_7,
      COUNT(*) FILTER (WHERE days_overdue >= 10) AS ring_10,
      COUNT(*) FILTER (WHERE days_overdue >= 14) AS ring_14,
      COUNT(*) FILTER (WHERE days_overdue >= 21) AS ring_21,
      COUNT(*) FILTER (WHERE days_overdue >= 30) AS ring_30,
      COUNT(*) AS overskredne_i_alt
    FROM candidates
  `);
  console.log(JSON.stringify(rings, null, 2));

  console.log("\n=== Datakvalitet: sum vs distinkte kunder ===");
  const dh = await runSql(`SELECT counts, jsonb_array_length(rows) AS sample_rows FROM (SELECT (public.dashboard_datahuller_lago())->'counts' AS counts, (public.dashboard_datahuller_lago())->'rows' AS rows) t`);
  console.log("RPC counts:", JSON.stringify(dh, null, 2));

  const distinctHuller = await runSql(`
    WITH huller AS (
      SELECT c.id AS company_id, 'uden_ejer' AS t
        FROM public.companies c
        JOIN public.companies_lago cl ON cl.company_id = c.id
       WHERE cl.is_active = true AND cl.is_visible_to_sales = true
         AND c.sales_id IS NULL
      UNION
      SELECT c.id, 'uden_kontakt'
        FROM public.companies c
        JOIN public.companies_lago cl ON cl.company_id = c.id
        LEFT JOIN public.contacts co ON co.company_id = c.id
       WHERE cl.is_active = true AND cl.is_visible_to_sales = true
       GROUP BY c.id HAVING COUNT(co.id) = 0
      UNION
      SELECT c.id, 'uden_adresse'
        FROM public.companies c
        JOIN public.companies_lago cl ON cl.company_id = c.id
       WHERE cl.is_active = true AND cl.is_visible_to_sales = true
         AND (c.address IS NULL OR c.address = '')
      UNION
      SELECT c.id, 'uden_segment'
        FROM public.companies c
        JOIN public.companies_lago cl ON cl.company_id = c.id
       WHERE cl.is_active = true AND cl.is_visible_to_sales = true
         AND cl.segment = 'X'
    )
    SELECT
      (SELECT COUNT(*) FROM huller) AS sum_med_dubletter,
      (SELECT COUNT(DISTINCT company_id) FROM huller) AS distinkte_kunder
  `);
  console.log("\nManuel gentælling:", JSON.stringify(distinctHuller, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
