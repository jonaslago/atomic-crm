// Order-level MAV: hele ordren har mindst én mav-linje, OG alle linjer
// på ordren er lagerstatus=klar. Matcher Jonas' formulering.
import { runSql } from "./supabaseAdmin.mjs";

async function q(label, sql) {
  console.log(`\n--- ${label} ---`);
  try {
    const r = await runSql(sql);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.log(`FEJL: ${e?.message ?? e}`);
  }
}

// Ordre-level: kun ordrer hvor mindst én linje er mav OG alle linjer er klar
await q(
  "MAV-ordrer på ordre-niveau (alle linjer klar, mindst én mav)",
  `WITH orders AS (
     SELECT ordre_nr,
            company_id,
            BOOL_AND(lagerstatus = 'klar') AS alle_klar,
            BOOL_OR(mav) AS har_mav,
            SUM(beloeb) AS ordre_beloeb
     FROM public.v_open_orders_categorised
     WHERE kategori <> 'reservation'
     GROUP BY ordre_nr, company_id
   )
   SELECT
     COUNT(DISTINCT company_id)::int AS kunder,
     COUNT(*)::int AS ordrer,
     SUM(ordre_beloeb)::numeric(14,2) AS beloeb
   FROM orders
   WHERE alle_klar AND har_mav`,
);

await q(
  "Samme men på linje-niveau (nuværende widget-kandidat)",
  `SELECT
     COUNT(DISTINCT company_id)::int AS kunder,
     COUNT(DISTINCT ordre_nr)::int AS ordrer,
     COUNT(*)::int AS linjer,
     SUM(beloeb)::numeric(14,2) AS beloeb
   FROM public.v_open_orders_categorised
   WHERE mav IS TRUE
     AND lagerstatus = 'klar'
     AND kategori <> 'reservation'`,
);

await q(
  "Peters MAV order-level",
  `WITH orders AS (
     SELECT v.ordre_nr,
            v.company_id,
            BOOL_AND(v.lagerstatus = 'klar') AS alle_klar,
            BOOL_OR(v.mav) AS har_mav,
            SUM(v.beloeb) AS ordre_beloeb
     FROM public.v_open_orders_categorised v
     JOIN public.companies c ON c.id = v.company_id
     JOIN public.sales s ON s.id = c.sales_id
     WHERE v.kategori <> 'reservation' AND s.first_name = 'Peter'
     GROUP BY v.ordre_nr, v.company_id
   )
   SELECT
     COUNT(DISTINCT company_id)::int AS kunder,
     COUNT(*)::int AS ordrer,
     SUM(ordre_beloeb)::numeric(14,2) AS beloeb
   FROM orders
   WHERE alle_klar AND har_mav`,
);

await q(
  "Diff: filens 1.915 (efter Undtages) vs DB'ens 1.789 — hvad filtreres?",
  `SELECT
     COUNT(*)::int AS raw_linjer,
     COUNT(*) FILTER (WHERE undtages_lagerhaandtering IS NOT TRUE)::int AS efter_undtages,
     COUNT(*) FILTER (WHERE undtages_lagerhaandtering IS TRUE)::int AS undtaget,
     MAX(synced_at) AS seneste_import
   FROM public.open_orders_lago`,
);
