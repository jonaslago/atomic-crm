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
  "Fuld kolonneliste for open_orders_lago (finder belob-felt)",
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='open_orders_lago'
   ORDER BY ordinal_position`,
);

await q(
  "Fuld kolonneliste for v_open_orders_categorised",
  `SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='v_open_orders_categorised'
   ORDER BY ordinal_position`,
);

await q(
  "Sample-række fra v_open_orders_categorised (én linje, alle kolonner)",
  `SELECT * FROM public.v_open_orders_categorised LIMIT 1`,
);

await q(
  "Bekraeftet_lev_dato — findes den anywhere?",
  `SELECT table_schema, table_name, column_name
   FROM information_schema.columns
   WHERE column_name ILIKE '%bekraeft%' OR column_name ILIKE '%bekræft%'
   ORDER BY table_schema, table_name`,
);
