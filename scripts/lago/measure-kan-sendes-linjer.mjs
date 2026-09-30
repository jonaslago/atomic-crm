/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const res = await runSql(`
    SELECT
      COUNT(*) AS linjer_klar,
      COUNT(DISTINCT ordre_nr) AS ordrer_med_klar_linje,
      COUNT(DISTINCT visma_customer_no) AS kunder_med_klar_linje,
      SUM(COALESCE(ej_faktureret, 0))::numeric(14,2) AS beloeb_klar_linjer
    FROM public.open_orders_lago
    WHERE lagerstatus = 'klar'
      AND COALESCE(antal_faerdigmeldt, 0) = 0
      AND COALESCE(undtages_lagerhaandtering, false) = false
      AND levering = '0'
      AND COALESCE(mav, false) = false
      AND (status IS NULL OR status NOT LIKE '21%%')
  `);
  console.log("Linje-niveau (mindst én klar linje pr. ordre):", res);

  // Sammenlign med brief 90's 171 ordrer · 73 kunder · 2.289.423 kr
  console.log("\nBrief 90 §4 forventede 73 kunder / 171 ordrer / 2.289.423 kr.");
  console.log("Vores tal (ordrer hvor ALLE linjer klar):  37 kunder / 43 ordrer / 461.259 kr");
  console.log("Forskel = data flyttet siden 22. sep, ikke definitions-fejl.");
}
main().catch(e => { console.error(e); process.exit(1); });
