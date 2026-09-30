/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const cap = await runSql(`SELECT value FROM public.lago_settings WHERE key='visit_capacity'`);
  const iv  = await runSql(`SELECT value FROM public.lago_settings WHERE key='visit_intervals'`);
  console.log("capacity:", cap[0]?.value);
  console.log("intervals:", iv[0]?.value);
  const kunder = await runSql(`SELECT segment, COUNT(*) AS n FROM public.companies_lago WHERE is_active=true AND is_visible_to_sales=true AND segment IN ('A','B','C') GROUP BY segment ORDER BY segment`);
  console.log("\nkunder A/B/C:", kunder);
  const c = cap[0]?.value ?? {};
  const kapacitet = (c.saelgere||0)*(c.feltdage_per_uge||0)*(c.besoeg_per_dag||0)*(c.uger_per_aar||0)*(1-(c.reserve_pct||0)/100);
  console.log("\nkapacitet/aar =", kapacitet);
  let behov = 0;
  const intervals = iv[0]?.value ?? {};
  for (const r of kunder) {
    const days = intervals[r.segment];
    if (days) behov += (Number(r.n) * 365) / days;
  }
  console.log("behov/aar    =", Math.round(behov));
  console.log("balance      =", Math.round(behov - kapacitet), "(negativ = overskud)");
  const vokser = await runSql(`SELECT kunde, aatd_vaekst_kr FROM public.v_sales_customer_periods WHERE aatd_vaekst_kr > 0 ORDER BY aatd_vaekst_kr DESC LIMIT 5`);
  const falder = await runSql(`SELECT kunde, aatd_vaekst_kr FROM public.v_sales_customer_periods WHERE aatd_vaekst_kr < 0 ORDER BY aatd_vaekst_kr ASC LIMIT 5`);
  const holdt = await runSql(`SELECT kunde, belob_i_vindue FROM public.v_customer_activity_status WHERE inaktiv=true ORDER BY belob_i_vindue DESC LIMIT 5`);
  console.log("\nvokser top-5:", vokser);
  console.log("\nfalder top-5:", falder);
  console.log("\nholdt op top-5:", holdt);
}
main().catch(e => { console.error(e); process.exit(1); });
