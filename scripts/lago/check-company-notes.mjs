/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const cols = await runSql(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_notes_lago'
    ORDER BY ordinal_position
  `);
  console.log("company_notes_lago columns:");
  console.log(JSON.stringify(cols, null, 2));

  const counts = await runSql(`
    SELECT
      COUNT(*) AS i_alt,
      COUNT(*) FILTER (WHERE sales_id IS NOT NULL) AS med_sales_id,
      COUNT(*) FILTER (WHERE created_at > now() - interval '30 days') AS seneste_30_dage
    FROM public.company_notes_lago
  `);
  console.log("\nCounts:", counts);
}
main().catch(e => { console.error(e); process.exit(1); });
