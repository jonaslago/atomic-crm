/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const totals = await runSql(`
    SELECT
      COUNT(*) AS linjer,
      COUNT(*) FILTER (WHERE er_testdata = false) AS linjer_prod,
      COUNT(DISTINCT ordre_nr) AS ordrer,
      COUNT(DISTINCT ordre_nr) FILTER (WHERE er_testdata = false) AS ordrer_prod,
      COUNT(DISTINCT visma_customer_no) AS kunder,
      COUNT(DISTINCT visma_customer_no) FILTER (WHERE er_testdata = false) AS kunder_prod
    FROM public.open_orders_lago
  `);
  console.log("Totals:", totals);

  // Kan sendes med mav-kolonnen (brief 25 tillæg B) i stedet for ordreart-parsing.
  const kanSendes = await runSql(`
    WITH ordre_flag AS (
      SELECT
        o.ordre_nr,
        o.visma_customer_no,
        BOOL_AND(o.lagerstatus = 'klar') AS all_klar,
        BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_faerdigmeldt,
        BOOL_AND(COALESCE(o.undtages_lagerhaandtering, false) = false) AS ingen_undtages,
        BOOL_AND(o.levering = '0') AS levering_nul,
        BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep,
        MIN(o.ordre_dato) AS aeldste_ordredato,
        SUM(COALESCE(o.ej_faktureret, 0)) AS belob
      FROM public.open_orders_lago o
      GROUP BY o.ordre_nr, o.visma_customer_no
    )
    SELECT
      COUNT(DISTINCT visma_customer_no) AS kunder,
      COUNT(*) AS ordrer,
      SUM(belob)::numeric(14,2) AS beloeb_sum
    FROM ordre_flag
    WHERE all_klar AND ingen_faerdigmeldt AND ingen_undtages
      AND levering_nul AND ikke_mav AND ikke_ep
  `);
  console.log("\nKan sendes (uden testdata-filter):", kanSendes);

  // Kortlægning af hver check enkeltvis for at forstå hvor tallet falder.
  const stepwise = await runSql(`
    WITH ordre_flag AS (
      SELECT
        o.ordre_nr,
        BOOL_AND(o.lagerstatus = 'klar') AS all_klar,
        BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_faerdigmeldt,
        BOOL_AND(COALESCE(o.undtages_lagerhaandtering, false) = false) AS ingen_undtages,
        BOOL_AND(o.levering = '0') AS levering_nul,
        BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep
      FROM public.open_orders_lago o
      GROUP BY o.ordre_nr
    )
    SELECT
      COUNT(*) AS alle_ordrer,
      COUNT(*) FILTER (WHERE ingen_undtages) AS efter_undtages,
      COUNT(*) FILTER (WHERE ingen_undtages AND levering_nul) AS efter_levering,
      COUNT(*) FILTER (WHERE ingen_undtages AND levering_nul AND ikke_mav) AS efter_mav,
      COUNT(*) FILTER (WHERE ingen_undtages AND levering_nul AND ikke_mav AND ikke_ep) AS efter_ep,
      COUNT(*) FILTER (WHERE ingen_undtages AND levering_nul AND ikke_mav AND ikke_ep AND ingen_faerdigmeldt) AS efter_faerdig,
      COUNT(*) FILTER (WHERE ingen_undtages AND levering_nul AND ikke_mav AND ikke_ep AND ingen_faerdigmeldt AND all_klar) AS kan_sendes
    FROM ordre_flag
  `);
  console.log("\nStepwise (ordre-antal):", stepwise);
}
main().catch(e => { console.error(e); process.exit(1); });
