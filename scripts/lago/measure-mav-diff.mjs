// Finder årsagen til MAV-diff'en (Jonas 26/65/230k vs min DB 40/144/379k).
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
  "Seneste import af åbne ordrer (synced_at)",
  `SELECT MAX(synced_at) AS seneste_import,
          COUNT(*)::int AS linjer_i_tabellen
   FROM public.open_orders_lago`,
);

await q(
  "mav-definition i view'et (SQL-udtryk)",
  `SELECT pg_get_viewdef('public.v_open_orders_categorised'::regclass, true) AS def`,
);

await q(
  "Hvordan mav ser ud raw: mav-værdier fordelt",
  `SELECT mav, COUNT(*)::int AS linjer
   FROM public.open_orders_lago
   GROUP BY mav
   ORDER BY mav NULLS LAST`,
);

await q(
  "MAV split på kategori (finder mav-linjer i ikke-normal kategori)",
  `SELECT kategori, COUNT(*)::int AS linjer,
          COUNT(DISTINCT company_id)::int AS kunder,
          SUM(beloeb)::numeric(14,2) AS beloeb
   FROM public.v_open_orders_categorised
   WHERE mav IS TRUE
   GROUP BY kategori
   ORDER BY linjer DESC`,
);

await q(
  "MAV split på lagerstatus (Jonas: alle linjer klar; check)",
  `SELECT lagerstatus, COUNT(*)::int AS linjer,
          COUNT(DISTINCT company_id)::int AS kunder,
          SUM(beloeb)::numeric(14,2) AS beloeb
   FROM public.v_open_orders_categorised
   WHERE mav IS TRUE
   GROUP BY lagerstatus
   ORDER BY linjer DESC`,
);

await q(
  "MAV + lagerstatus=klar + kategori=normal (Jonas' definition kandidat)",
  `SELECT COUNT(DISTINCT company_id)::int AS kunder,
          COUNT(*)::int AS linjer,
          SUM(beloeb)::numeric(14,2) AS beloeb
   FROM public.v_open_orders_categorised
   WHERE mav IS TRUE
     AND lagerstatus = 'klar'
     AND kategori = 'normal'`,
);
