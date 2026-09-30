/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const rows = await runSql(`SELECT kunde, sidste_aar, i_aar, belob_i_vindue, t12m FROM public.v_customer_activity_status WHERE inaktiv=true AND kunde ILIKE '%nakskov%'`);
  console.log("Nakskov:");
  console.log(JSON.stringify(rows, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
