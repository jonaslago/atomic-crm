/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== #34868 · linje for linje (autoritativt) ===");
  const rows = await runSql(`
    SELECT linje_nr, produktnr, salgstype, antal, reserveret_mod_lager,
           ej_faktureret, lagerstatus, levering, status,
           undtages_lagerhaandtering, mav
    FROM public.open_orders_lago
    WHERE ordre_nr = '34868'
    ORDER BY linje_nr::int
  `);
  console.log(JSON.stringify(rows, null, 2));

  console.log("\n=== §2a · EP-andel af 5.255.109 ===");
  console.log("Vi filtrerer EP via status LIKE '21%%'. Vores EP-linjer har ej_faktureret=0.");
  console.log("Men rapporten ekskluderer EP anderledes. Måle andele:");
  const ep = await runSql(`
    WITH ord AS (
      SELECT ordre_nr,
             BOOL_OR(status LIKE '21%%') AS har_ep_linje,
             SUM(ej_faktureret)::numeric(14,2) AS beloeb
      FROM public.open_orders_lago
      GROUP BY ordre_nr
    )
    SELECT
      COUNT(*) FILTER (WHERE har_ep_linje) AS ep_ordrer,
      SUM(beloeb) FILTER (WHERE har_ep_linje)::numeric(14,2) AS ep_belob_hele_ordrer,
      SUM(beloeb) FILTER (WHERE NOT har_ep_linje)::numeric(14,2) AS ikke_ep_belob,
      SUM(beloeb)::numeric(14,2) AS total
    FROM ord
  `);
  console.log(JSON.stringify(ep, null, 2));

  console.log("\nEP-linjer isoleret (ej_faktureret pr linje):");
  const epLinjer = await runSql(`
    SELECT ordre_nr, linje_nr, produktnr, antal, ej_faktureret, status
    FROM public.open_orders_lago
    WHERE status LIKE '21%%'
    ORDER BY ordre_nr, linje_nr::int
  `);
  console.log(JSON.stringify(epLinjer, null, 2));

  console.log("\n=== §1E-2 · Undtages fordelt: pakkeprodukter vs servicevarer ===");
  const undtagesFordelt = await runSql(`
    WITH klass AS (
      SELECT o.ordre_nr, o.linje_nr, o.produktnr, o.ej_faktureret, o.reserveret_mod_lager, o.antal,
             CASE
               WHEN o.produktnr IN ('Vej','Energi','emb-afg') THEN 'service_afgift'
               WHEN o.produktnr LIKE '%-Jul' OR o.produktnr LIKE '%-BY%' OR o.produktnr LIKE '%-SM%' THEN 'pakke_kendt'
               ELSE 'andet'
             END AS klasse
      FROM public.open_orders_lago o
      WHERE o.undtages_lagerhaandtering = true
    )
    SELECT klasse,
           COUNT(*) AS linjer,
           SUM(ej_faktureret)::numeric(14,2) AS linje_belob,
           SUM(CASE WHEN reserveret_mod_lager >= antal THEN ej_faktureret ELSE 0 END)::numeric(14,2) AS klar_belob,
           SUM(CASE WHEN reserveret_mod_lager < antal THEN ej_faktureret ELSE 0 END)::numeric(14,2) AS rest_belob
    FROM klass
    GROUP BY klasse
    ORDER BY linje_belob DESC
  `);
  console.log(JSON.stringify(undtagesFordelt, null, 2));

  console.log("\n=== Kritisk: undtages-linjer der er 'sendbare' hvis vi ignorerede dem ===");
  console.log("Ordrer hvor UNDTAGES-linjen er restordre, men alle NON-undtages-linjer er klar");
  const potentialSendable = await runSql(`
    WITH ord AS (
      SELECT o.ordre_nr,
             BOOL_OR(o.undtages_lagerhaandtering = true) AS har_undt,
             BOOL_AND(o.lagerstatus = 'klar') AS alle_klar,
             BOOL_AND(o.lagerstatus = 'klar') FILTER (WHERE COALESCE(o.undtages_lagerhaandtering, false) = false) AS non_undt_alle_klar,
             BOOL_AND(o.levering = '0') AS lev_0,
             BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep,
             SUM(o.ej_faktureret)::numeric(14,2) AS belob,
             SUM(o.ej_faktureret) FILTER (WHERE COALESCE(o.undtages_lagerhaandtering, false) = false)::numeric(14,2) AS non_undt_belob
      FROM public.open_orders_lago o
      GROUP BY o.ordre_nr
    )
    SELECT ordre_nr, non_undt_belob, belob
    FROM ord
    WHERE har_undt AND non_undt_alle_klar = true AND lev_0 AND ikke_ep AND NOT alle_klar
    ORDER BY non_undt_belob DESC
  `);
  console.log(JSON.stringify(potentialSendable, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
