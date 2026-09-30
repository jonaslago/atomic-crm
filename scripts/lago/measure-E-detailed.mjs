/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("E.3 · 714.885 kr = hele ordrer med mindst én undtages-linje (ekskl. EP + lev=0)");
  const undt = await runSql(`
    WITH ord AS (
      SELECT o.ordre_nr,
             BOOL_OR(o.undtages_lagerhaandtering = true) AS har_undt,
             BOOL_AND(o.levering = '0') AS alle_lev0,
             BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep,
             SUM(o.ej_faktureret)::numeric(14,2) AS beloeb,
             ARRAY_AGG(DISTINCT o.produktnr) AS produkter,
             ARRAY_AGG(DISTINCT o.salgstype) AS salgstyper
      FROM public.open_orders_lago o
      GROUP BY o.ordre_nr
    )
    SELECT
      COUNT(*) FILTER (WHERE har_undt AND alle_lev0 AND ikke_ep) AS antal_ordrer,
      SUM(beloeb) FILTER (WHERE har_undt AND alle_lev0 AND ikke_ep)::numeric(14,2) AS beloeb
    FROM ord
  `);
  console.log(JSON.stringify(undt, null, 2));

  console.log("\nE.4 · Del ordrerne op på pakke-produktnr (91801-Jul, 91814-BY, 91814-BYMAG) vs andre");
  const opdelt = await runSql(`
    WITH ord AS (
      SELECT o.ordre_nr,
             BOOL_AND(o.levering = '0') AS alle_lev0,
             BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep,
             BOOL_OR(o.undtages_lagerhaandtering = true) AS har_undt,
             SUM(o.ej_faktureret)::numeric(14,2) AS beloeb,
             STRING_AGG(DISTINCT
               CASE WHEN o.undtages_lagerhaandtering = true THEN o.produktnr END,
               ', ') AS undt_produkter
      FROM public.open_orders_lago o
      GROUP BY o.ordre_nr
    )
    SELECT
      undt_produkter,
      COUNT(*) AS ordrer,
      SUM(beloeb)::numeric(14,2) AS beloeb
    FROM ord
    WHERE har_undt AND alle_lev0 AND ikke_ep
    GROUP BY undt_produkter
    ORDER BY beloeb DESC
  `);
  console.log(JSON.stringify(opdelt, null, 2));

  console.log("\nE.5 · Ordrer med undtages-linjer der ellers ville være 'hele klar' (potentielt tabte 'kan sendes')");
  const tabte = await runSql(`
    WITH ord AS (
      SELECT o.ordre_nr,
             BOOL_OR(o.undtages_lagerhaandtering = true) AS har_undt,
             BOOL_AND(o.lagerstatus = 'klar') AS alle_klar,
             BOOL_AND(o.levering = '0') AS alle_lev0,
             BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep,
             SUM(o.ej_faktureret)::numeric(14,2) AS beloeb
      FROM public.open_orders_lago o
      GROUP BY o.ordre_nr
    )
    SELECT
      COUNT(*) FILTER (WHERE har_undt AND alle_klar AND alle_lev0 AND ikke_ep) AS ordrer_ville_vaere_klar,
      SUM(beloeb) FILTER (WHERE har_undt AND alle_klar AND alle_lev0 AND ikke_ep)::numeric(14,2) AS beloeb_ville_vaere_klar
    FROM ord
  `);
  console.log(JSON.stringify(tabte, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
