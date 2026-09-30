/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=========== A · §2a-afvigelse (kilder til +140k) ===========\n");

  console.log("A.1 · Hvordan ekskluderer vi 'En Primeur'?");
  console.log("Vores regel: status LIKE '21%%'. Rapporten kan bruge anden kilde.");
  const ep = await runSql(`
    SELECT
      COUNT(DISTINCT ordre_nr) AS ep_ordrer_via_status_21,
      SUM(ej_faktureret) FILTER (WHERE status = '21' OR status LIKE '21 [%')::numeric(14,2) AS ep_beloeb_via_status,
      COUNT(*) FILTER (WHERE ej_faktureret = 0)::int AS nul_kroner_linjer,
      SUM(ej_faktureret) FILTER (WHERE ej_faktureret = 0)::numeric(14,2) AS nul_kroner_belob
    FROM public.open_orders_lago
  `);
  console.log(JSON.stringify(ep, null, 2));

  console.log("\nA.2 · 0-kr-linjer pr. salgstype (gaver, prøver, komponenter, kampagner)");
  const nulKr = await runSql(`
    SELECT salgstype, kampagne IS NOT NULL AS har_kampagne,
           COUNT(*)::int AS linjer,
           BOOL_OR(undtages_lagerhaandtering) AS nogen_undtages,
           SUM(reserveret_mod_lager)::numeric(14,2) AS sum_reserveret
    FROM public.open_orders_lago
    WHERE ej_faktureret = 0
    GROUP BY salgstype, har_kampagne
    ORDER BY linjer DESC
  `);
  console.log(JSON.stringify(nulKr, null, 2));

  console.log("\nA.3 · Ordrer med kun ordrelinjer under bekraeftet_lev_dato senere end ordre_dato?");
  const levDato = await runSql(`
    SELECT
      COUNT(*) FILTER (WHERE bekraeftet_lev_dato IS NOT NULL)::int AS med_bekraeftet_lev,
      COUNT(*) FILTER (WHERE oensket_leveringsdato IS NOT NULL)::int AS med_oensket_lev,
      COUNT(*) AS linjer_i_alt
    FROM public.open_orders_lago
  `);
  console.log(JSON.stringify(levDato, null, 2));

  console.log("\nA.4 · HQ-distrikt-omfang");
  const hq = await runSql(`
    SELECT c.name, cl.visma_customer_no, cl.kundetype,
           COUNT(DISTINCT o.ordre_nr) AS ordrer,
           SUM(o.ej_faktureret)::numeric(14,2) AS beloeb
    FROM public.open_orders_lago o
    JOIN public.companies_lago cl ON cl.visma_customer_no = o.visma_customer_no
    JOIN public.companies c ON c.id = cl.company_id
    WHERE cl.distrikt = 'HQ'
    GROUP BY c.name, cl.visma_customer_no, cl.kundetype
    ORDER BY beloeb DESC
  `);
  console.log(JSON.stringify(hq, null, 2));

  console.log("\n=========== B · Widget vs forespørgsel-uenighed ===========\n");
  console.log("B.1 · Ringelisten — hvad viser RingelisteWidget vs kundelistens ringeliste-radio?");
  const ring = await runSql(`
    SELECT (public.dashboard_ringeliste_lago(500))->>'total' AS rpc_total
  `);
  console.log("RPC total (dashboard_ringeliste_lago, filter >=14 dage):", ring[0].rpc_total);
  const ringClient = await runSql(`
    SELECT COUNT(*)::int AS client_regel
    FROM public.companies_lago cl
    JOIN public.companies c ON c.id = cl.company_id
    JOIN public.customers_with_priority_lago vp ON vp.company_id = cl.company_id
    LEFT JOIN public.v_active_ringeliste_lukninger_lago rl ON rl.company_id = cl.company_id
    WHERE cl.is_active = true AND cl.is_visible_to_sales = true
      AND cl.next_visit_planned IS NULL
      AND (vp.status = 'never_visited' OR (vp.status = 'overdue' AND vp.days_overdue >= 5))
      AND rl.id IS NULL
  `);
  console.log("Kundeliste-radio-regel (>=5 dage, incl. never_visited):", ringClient[0].client_regel);
  const ringNoLuk = await runSql(`
    SELECT COUNT(*)::int AS uden_luk_filter
    FROM public.companies_lago cl
    JOIN public.companies c ON c.id = cl.company_id
    JOIN public.customers_with_priority_lago vp ON vp.company_id = cl.company_id
    WHERE cl.is_active = true AND cl.is_visible_to_sales = true
      AND cl.next_visit_planned IS NULL
      AND (vp.status = 'never_visited' OR (vp.status = 'overdue' AND vp.days_overdue >= 5))
  `);
  console.log("Kundeliste-radio uden lukninger-check (aktuel prod):", ringNoLuk[0].uden_luk_filter);

  console.log("\nB.2 · Kan sendes — RPC total_beloeb vs frontend");
  const kanSendes = await runSql(`
    SELECT
      (public.dashboard_kan_sendes_lago(500))->>'total' AS kunder,
      (public.dashboard_kan_sendes_lago(500))->>'total_ordrer' AS ordrer,
      (public.dashboard_kan_sendes_lago(500))->>'total_beloeb' AS beloeb
  `);
  console.log("RPC-tal:", kanSendes);

  console.log("\n=========== E · Undtages 714.885 kr fordelt ===========\n");
  const undtages = await runSql(`
    SELECT salgstype, produktgruppe,
           COUNT(*)::int AS linjer,
           SUM(ej_faktureret)::numeric(14,2) AS beloeb
    FROM public.open_orders_lago
    WHERE undtages_lagerhaandtering = true
    GROUP BY salgstype, produktgruppe
    ORDER BY beloeb DESC
  `);
  console.log(JSON.stringify(undtages, null, 2));

  console.log("\nE.2 · Undtages efter produktnr-suffix (-Jul, -SM, -pkg lignende)");
  const undtagesProd = await runSql(`
    SELECT
      COUNT(*) FILTER (WHERE produktnr LIKE '%-%')::int AS med_bindestreg,
      COUNT(*) FILTER (WHERE produktnr NOT LIKE '%-%')::int AS uden_bindestreg,
      COUNT(*) FILTER (WHERE produktnr LIKE '%Jul%' OR produktnr LIKE '%SM%' OR produktnr LIKE '%pkg%' OR produktnr LIKE '%kasse%')::int AS pakkeord,
      SUM(ej_faktureret) FILTER (WHERE produktnr LIKE '%-%')::numeric(14,2) AS med_bindestreg_belob,
      SUM(ej_faktureret) FILTER (WHERE produktnr NOT LIKE '%-%')::numeric(14,2) AS uden_bindestreg_belob
    FROM public.open_orders_lago
    WHERE undtages_lagerhaandtering = true
  `);
  console.log(JSON.stringify(undtagesProd, null, 2));

  console.log("\nE.3 · Undtages linjer TOP 10 pr. beløb");
  const top10 = await runSql(`
    SELECT o.ordre_nr, o.linje_nr, o.produktnr, o.antal, o.reserveret_mod_lager,
           o.ej_faktureret, o.salgstype, o.beskrivelse
    FROM public.open_orders_lago o
    WHERE o.undtages_lagerhaandtering = true
    ORDER BY ej_faktureret DESC LIMIT 10
  `);
  console.log(JSON.stringify(top10, null, 2));

  console.log("\n=========== G · Segment X pr. distrikt ===========\n");
  const segX = await runSql(`
    SELECT distrikt, COUNT(*)::int AS x_kunder
    FROM public.companies_lago
    WHERE is_active = true AND is_visible_to_sales = true
      AND segment = 'X'
    GROUP BY distrikt ORDER BY distrikt NULLS LAST
  `);
  console.log("X-kunder pr distrikt:", segX);

  const alleAktive = await runSql(`
    SELECT distrikt, segment, COUNT(*)::int AS n
    FROM public.companies_lago
    WHERE is_active = true AND is_visible_to_sales = true
      AND (segment IS NULL OR segment <> 'L')
    GROUP BY distrikt, segment
    ORDER BY distrikt NULLS LAST, segment NULLS LAST
  `);
  console.log("\nAlle aktive kunder pr distrikt × segment:", alleAktive);
}
main().catch(e => { console.error(e); process.exit(1); });
