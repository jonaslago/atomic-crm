/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const distinctLev = await runSql(`SELECT DISTINCT levering FROM public.open_orders_lago ORDER BY levering`);
  console.log("distinct levering:", distinctLev);

  const distinctOrdreart = await runSql(`SELECT DISTINCT ordreart FROM public.open_orders_lago ORDER BY ordreart`);
  console.log("\ndistinct ordreart:", distinctOrdreart);

  const distinctStatus = await runSql(`SELECT DISTINCT status FROM public.open_orders_lago ORDER BY status`);
  console.log("\ndistinct status:", distinctStatus);

  const distinctLagerstatus = await runSql(`SELECT DISTINCT lagerstatus FROM public.open_orders_lago ORDER BY lagerstatus`);
  console.log("\ndistinct lagerstatus:", distinctLagerstatus);

  // Kan sendes-definition:
  //   - undtages_lagerhaandtering IS NOT TRUE (dvs false eller null)
  //   - hver linje: lagerstatus = 'klar' AND (antal_faerdigmeldt IS NULL OR antal_faerdigmeldt = 0)
  //   - Levering = '0' (almindelig)
  //   - En Primeur (status='21') og MAV (ordreart='2') udelukkes
  // Aggregér op til ordre-niveau: alle linjer i ordren skal opfylde krav.
  const kanSendes = await runSql(`
    WITH ordre_flag AS (
      SELECT
        o.ordre_nr,
        o.visma_customer_no,
        BOOL_AND(o.lagerstatus = 'klar') AS all_klar,
        BOOL_AND(o.antal_faerdigmeldt IS NULL OR o.antal_faerdigmeldt = 0) AS ingen_faerdigmeldt,
        BOOL_AND(o.undtages_lagerhaandtering IS NOT TRUE) AS ingen_undtages,
        BOOL_AND(o.levering = '0') AS levering_nul,
        BOOL_AND(o.ordreart IS NULL OR o.ordreart NOT LIKE '2%%') AS ikke_mav,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep,
        MIN(o.ordre_dato) AS aeldste_ordredato,
        SUM(COALESCE(o.ej_faktureret, 0)) AS belob
      FROM public.open_orders_lago o
      WHERE o.er_testdata = false
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
  console.log("\nKan sendes (aggregeret):", kanSendes);
}
main().catch(e => { console.error(e); process.exit(1); });
