/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const settings = await runSql(`SELECT key, value FROM public.lago_settings ORDER BY key`);
  console.log("lago_settings:");
  console.log(JSON.stringify(settings, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
