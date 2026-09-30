/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const rows = await runSql(`SELECT kunde, sidste_aar, i_aar, belob_i_vindue FROM public.v_customer_activity_status WHERE inaktiv=true ORDER BY sidste_aar DESC NULLS LAST LIMIT 8`);
  console.log("Inaktive, top 8 på sidste_aar:");
  console.log(JSON.stringify(rows, null, 2));
  const nulSidste = await runSql(`SELECT COUNT(*) AS n FROM public.v_customer_activity_status WHERE inaktiv=true AND (sidste_aar IS NULL OR sidste_aar = 0)`);
  console.log("\nInaktive med 0 kr sidste år:", nulSidste);
}
main().catch(e => { console.error(e); process.exit(1); });
