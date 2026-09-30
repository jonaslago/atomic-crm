/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const monthly = await runSql(`SELECT COUNT(*) AS n, MAX(aar||'-'||LPAD(maaned::text,2,'0')) AS max_maaned FROM public.sales_monthly_lago`);
  console.log("sales_monthly_lago:", monthly);
  const dist = await runSql(`SELECT distrikt, kundetype, grouping_id, aatd, aatd_sidste_aar, aatd_vaekst_kr, aatd_vaekst_pct FROM public.v_sales_district_periods ORDER BY grouping_id DESC, distrikt NULLS LAST, kundetype NULLS LAST`);
  console.log("\nv_sales_district_periods:");
  console.log(JSON.stringify(dist, null, 2));
  const status = await runSql(`SELECT COUNT(*) FILTER (WHERE inaktiv) AS inaktive, COUNT(*) FILTER (WHERE ny_i_aar) AS ny FROM public.v_customer_activity_status`);
  console.log("\nv_customer_activity_status counts:", status);
  const growth = await runSql(`SELECT
    COUNT(*) FILTER (WHERE aatd_vaekst_pct >= 20) AS vokser_20p,
    COUNT(*) FILTER (WHERE aatd_vaekst_pct <= -20) AS falder_20p,
    COUNT(*) FILTER (WHERE aatd_vaekst_pct >= 10 AND aatd_vaekst_pct < 20) AS vokser_10_20,
    COUNT(*) FILTER (WHERE aatd_vaekst_pct <= -10 AND aatd_vaekst_pct > -20) AS falder_10_20,
    COUNT(*) FILTER (WHERE aatd_vaekst_pct BETWEEN -10 AND 10) AS stabil,
    COUNT(*) AS total_med_pct
    FROM public.v_sales_customer_periods WHERE aatd_vaekst_pct IS NOT NULL`);
  console.log("\nvaekst-fordeling:", growth);
}
main().catch(e => { console.error(e); process.exit(1); });
