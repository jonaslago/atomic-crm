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

await q(
  "open_orders_lago kolonner (kildetabel bag view'et)",
  `SELECT column_name, data_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='open_orders_lago'
   ORDER BY ordinal_position`,
);

await q(
  "har_oensket_dato: hvad betyder booleanen?",
  `SELECT
     COUNT(*)::int AS total,
     SUM(CASE WHEN har_oensket_dato THEN 1 ELSE 0 END)::int AS med_oensket,
     SUM(CASE WHEN NOT har_oensket_dato THEN 1 ELSE 0 END)::int AS uden_oensket
   FROM public.v_open_orders_categorised`,
);

await q(
  "Antal linjer med lagerstatus=klar + uden bekraeftet_lev_dato (aktuelt scope)",
  `SELECT
     COUNT(*) FILTER (WHERE lagerstatus='klar')::int AS klar_i_alt,
     COUNT(*) FILTER (WHERE lagerstatus='klar' AND NOT har_oensket_dato)::int AS klar_uden_oensket
   FROM public.v_open_orders_categorised`,
);
