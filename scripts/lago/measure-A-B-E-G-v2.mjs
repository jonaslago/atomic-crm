/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=========== A · §2a-afvigelse ===========\n");

  console.log("A.1 · EP (status=21) — antal ordrer/linjer og beløb");
  const ep = await runSql(`
    SELECT
      COUNT(DISTINCT ordre_nr) FILTER (WHERE status = '21') AS ep_ordrer,
      COUNT(*) FILTER (WHERE status = '21') AS ep_linjer,
      SUM(ej_faktureret) FILTER (WHERE status = '21')::numeric(14,2) AS ep_beloeb,
      COUNT(DISTINCT ordre_nr) AS alle_ordrer,
      SUM(ej_faktureret)::numeric(14,2) AS alle_beloeb,
      COUNT(*) FILTER (WHERE ej_faktureret = 0) AS nul_kr_linjer
    FROM public.open_orders_lago
  `);
  console.log(JSON.stringify(ep, null, 2));

  console.log("\nA.2 · EP-ordrer med beløb > 0 (måske rapporten inkluderer disse men vi ekskluderer)");
  const epMedBelob = await runSql(`
    SELECT ordre_nr, SUM(ej_faktureret)::numeric(14,2) AS beloeb, MIN(ordre_dato) AS dato, MAX(oensket_leveringsdato) AS oensket_lev
    FROM public.open_orders_lago
    WHERE status = '21'
    GROUP BY ordre_nr
    HAVING SUM(ej_faktureret) > 0
    ORDER BY beloeb DESC LIMIT 10
  `);
  console.log(JSON.stringify(epMedBelob, null, 2));

  console.log("\nA.3 · Alle ordrer summer + antal med kun 0-kr");
  const nul = await runSql(`
    WITH ordre_agg AS (
      SELECT ordre_nr, SUM(ej_faktureret) AS belob
      FROM public.open_orders_lago
      GROUP BY ordre_nr
    )
    SELECT COUNT(*) AS ordrer_i_alt,
           COUNT(*) FILTER (WHERE belob = 0) AS ordrer_kun_0kr,
           COUNT(*) FILTER (WHERE belob > 0) AS ordrer_med_belob
    FROM ordre_agg
  `);
  console.log(JSON.stringify(nul, null, 2));

  console.log("\nA.4 · HQ-kunder");
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

  console.log("\nA.5 · Alder-beregning tjek — bruges ordre_dato eller andet i vores?");
  console.log("Vores: CURRENT_DATE - ordre_dato på ORDRE-min-dato");
  console.log("Rapport måske: MAX(oensket_leveringsdato) eller lignende");
  const alderJustering = await runSql(`
    WITH ord AS (
      SELECT ordre_nr, MIN(ordre_dato) AS min_ord, MIN(oensket_leveringsdato) AS min_oensket,
             SUM(ej_faktureret) AS belob,
             BOOL_AND(status IS NULL OR status NOT LIKE '21%%') AS ikke_ep
      FROM public.open_orders_lago
      GROUP BY ordre_nr
    )
    SELECT
      SUM(belob) FILTER (WHERE ikke_ep AND min_oensket IS NULL)::numeric(14,2) AS uden_oensket,
      SUM(belob) FILTER (WHERE ikke_ep AND min_oensket > CURRENT_DATE)::numeric(14,2) AS oensket_i_fremtid,
      SUM(belob) FILTER (WHERE ikke_ep AND min_oensket <= CURRENT_DATE)::numeric(14,2) AS oensket_forfaldt
    FROM ord
  `);
  console.log(JSON.stringify(alderJustering, null, 2));

  console.log("\n=========== B · Widget vs forespørgsel ===========\n");
  console.log("B.1 · Ringelisten");
  const ring = await runSql(`
    SELECT
      ((public.dashboard_ringeliste_lago(500))->>'total')::int AS rpc_forsidewidget
  `);
  console.log("Forside-widget (>=14 dg, ekskl. lukninger):", ring[0].rpc_forsidewidget);
  const kundelisteReg = await runSql(`
    SELECT COUNT(*) AS n
    FROM public.companies_lago cl
    JOIN public.companies c ON c.id = cl.company_id
    JOIN public.customers_with_priority_lago vp ON vp.company_id = cl.company_id
    WHERE cl.is_active = true AND cl.is_visible_to_sales = true
      AND cl.next_visit_planned IS NULL
      AND (vp.status = 'never_visited' OR (vp.status = 'overdue' AND vp.days_overdue >= 5))
  `);
  console.log("Kundeliste-radio (client, >=5 dg, INCL never_visited, UDEN lukninger-filter):", kundelisteReg[0].n);

  console.log("\nB.2 · Kan sendes RPC-tal");
  const kan = await runSql(`
    SELECT
      ((public.dashboard_kan_sendes_lago(500))->>'total')::int AS kunder,
      ((public.dashboard_kan_sendes_lago(500))->>'total_ordrer')::int AS ordrer,
      ((public.dashboard_kan_sendes_lago(500))->>'total_beloeb') AS beloeb
  `);
  console.log(kan);

  console.log("\n=========== E · Undtages 714.885 fordelt ===========\n");
  console.log("E.1 · Undtages linjer efter salgstype");
  const undtagesType = await runSql(`
    SELECT
      salgstype,
      COUNT(*) AS linjer,
      SUM(ej_faktureret)::numeric(14,2) AS beloeb
    FROM public.open_orders_lago
    WHERE undtages_lagerhaandtering = true
    GROUP BY salgstype
    ORDER BY beloeb DESC NULLS LAST
  `);
  console.log(JSON.stringify(undtagesType, null, 2));

  console.log("\nE.2 · Undtages TOP 15 pr. beløb");
  const top = await runSql(`
    SELECT o.ordre_nr, o.linje_nr, o.produktnr, o.antal,
           o.reserveret_mod_lager, o.ej_faktureret, o.salgstype
    FROM public.open_orders_lago o
    WHERE o.undtages_lagerhaandtering = true
    ORDER BY ej_faktureret DESC LIMIT 15
  `);
  console.log(JSON.stringify(top, null, 2));

  console.log("\n=========== G · Segment X pr distrikt ===========\n");
  const x = await runSql(`
    SELECT distrikt, COUNT(*)::int AS x_kunder
    FROM public.companies_lago
    WHERE is_active = true AND is_visible_to_sales = true AND segment = 'X'
    GROUP BY distrikt ORDER BY distrikt
  `);
  console.log("X pr distrikt:", x);

  const total = await runSql(`
    SELECT distrikt, segment, COUNT(*)::int AS n
    FROM public.companies_lago
    WHERE is_active = true AND is_visible_to_sales = true AND segment <> 'L'
    GROUP BY distrikt, segment ORDER BY distrikt, segment
  `);
  console.log("\nAlle aktive pr distrikt × segment:", total);
}
main().catch(e => { console.error(e); process.exit(1); });
