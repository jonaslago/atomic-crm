/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== §2a · aldersbuckets · pr. distrikt ekskl. EP ===");
  const combined = await runSql(`
    WITH ord AS (
      SELECT
        o.ordre_nr,
        CASE WHEN cl.distrikt IN ('Øst','Vest','HQ') THEN cl.distrikt ELSE 'Andet' END AS distrikt_bucket,
        SUM(o.ej_faktureret)::numeric AS beloeb,
        MIN(o.ordre_dato) AS aeldste,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep
      FROM public.open_orders_lago o
      LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = o.visma_customer_no
      GROUP BY o.ordre_nr, cl.distrikt
    )
    SELECT
      SUM(beloeb) FILTER (WHERE (CURRENT_DATE - aeldste) BETWEEN 0 AND 7)::numeric(14,2)   AS dg_0_7,
      SUM(beloeb) FILTER (WHERE (CURRENT_DATE - aeldste) BETWEEN 8 AND 14)::numeric(14,2)  AS dg_8_14,
      SUM(beloeb) FILTER (WHERE (CURRENT_DATE - aeldste) BETWEEN 15 AND 30)::numeric(14,2) AS dg_15_30,
      SUM(beloeb) FILTER (WHERE (CURRENT_DATE - aeldste) BETWEEN 31 AND 60)::numeric(14,2) AS dg_31_60,
      SUM(beloeb) FILTER (WHERE (CURRENT_DATE - aeldste) > 60)::numeric(14,2)              AS dg_60_plus,
      SUM(beloeb)::numeric(14,2) AS i_alt,
      COUNT(*) AS ordrer
    FROM ord WHERE ikke_ep
  `);
  console.log("Aldersbuckets:", combined);

  const distrikt = await runSql(`
    WITH ord AS (
      SELECT o.ordre_nr,
             CASE WHEN cl.distrikt IN ('Øst','Vest','HQ') THEN cl.distrikt ELSE 'Andet' END AS distrikt_bucket,
             SUM(o.ej_faktureret)::numeric AS beloeb,
             BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep
      FROM public.open_orders_lago o
      LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = o.visma_customer_no
      GROUP BY o.ordre_nr, cl.distrikt
    )
    SELECT distrikt_bucket AS distrikt, SUM(beloeb)::numeric(14,2) AS beloeb, COUNT(*) AS ordrer
      FROM ord WHERE ikke_ep
     GROUP BY distrikt_bucket ORDER BY distrikt_bucket
  `);
  console.log("\nPr. distrikt (ekskl. EP):", distrikt);

  console.log("\n=== §2b · nedbrydning fra vores total til 'Kan sendes' ===");
  const nedbryd = await runSql(`
    WITH ord AS (
      SELECT o.ordre_nr,
             BOOL_AND(o.lagerstatus = 'klar') AS alle_klar,
             BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_fmt,
             BOOL_AND(COALESCE(o.undtages_lagerhaandtering, false) = false) AS ingen_undt,
             BOOL_AND(o.levering = '0') AS lev_nul,
             BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
             BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep,
             cl.kreditspaerre,
             SUM(o.ej_faktureret)::numeric AS beloeb
      FROM public.open_orders_lago o
      LEFT JOIN public.companies_lago cl ON cl.visma_customer_no = o.visma_customer_no
      GROUP BY o.ordre_nr, cl.kreditspaerre
    )
    SELECT
      SUM(beloeb)::numeric(14,2) AS start_alle,
      SUM(beloeb) FILTER (WHERE ikke_ep)::numeric(14,2) AS efter_ep,
      SUM(beloeb) FILTER (WHERE ikke_ep AND lev_nul)::numeric(14,2) AS efter_lev0,
      SUM(beloeb) FILTER (WHERE ikke_ep AND lev_nul AND ikke_mav)::numeric(14,2) AS efter_mav,
      SUM(beloeb) FILTER (WHERE ikke_ep AND lev_nul AND ikke_mav AND ingen_undt)::numeric(14,2) AS efter_undtages,
      SUM(beloeb) FILTER (WHERE ikke_ep AND lev_nul AND ikke_mav AND ingen_undt AND ingen_fmt)::numeric(14,2) AS efter_fmt,
      SUM(beloeb) FILTER (WHERE ikke_ep AND lev_nul AND ikke_mav AND ingen_undt AND ingen_fmt AND alle_klar)::numeric(14,2) AS efter_klar,
      SUM(beloeb) FILTER (WHERE ikke_ep AND lev_nul AND ikke_mav AND ingen_undt AND ingen_fmt AND alle_klar AND kreditspaerre IS NOT TRUE)::numeric(14,2) AS efter_kredit
    FROM ord
  `);
  console.log("Nedbrydning:", nedbryd);
}
main().catch(e => { console.error(e); process.exit(1); });
