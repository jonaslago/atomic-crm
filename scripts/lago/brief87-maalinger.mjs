// Brief 87 §2 (28. sep 2026): to målinger + kolonne-tælling. Afgør om
// §3 overhovedet kan vises — og hvor tæt på i dag ugetallet kan komme.
import { runSql } from "./supabaseAdmin.mjs";

async function q(label, sql) {
  console.log(`\n--- ${label} ---`);
  console.log(`SQL: ${sql}`);
  try {
    const r = await runSql(sql);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.log(`FEJL: ${e?.message ?? e}`);
  }
}

await q(
  "1a · Seneste importerede måned i sales_monthly_lago",
  "SELECT MAX(make_date(aar, maaned, 1)) AS seneste_maaned FROM public.sales_monthly_lago",
);

await q(
  "1b · Antal rækker + første/sidste år-måned",
  "SELECT COUNT(*)::int AS raekker, MIN(make_date(aar, maaned, 1)) AS foerste, MAX(make_date(aar, maaned, 1)) AS seneste FROM public.sales_monthly_lago",
);

await q(
  "2 · Kolonner i sales_monthly_lago (findes Forbrugt?)",
  "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='sales_monthly_lago' ORDER BY ordinal_position",
);

await q(
  "3 · ÅTD 2026 jan-aug (skal give 16.745.076 kr.)",
  "SELECT SUM(belob)::numeric(14,2) AS aatd_2026 FROM public.sales_monthly_lago WHERE aar=2026 AND maaned BETWEEN 1 AND 8",
);
