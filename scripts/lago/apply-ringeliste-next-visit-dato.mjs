/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929280000_lago_ringeliste_next_visit_dato";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const path = resolve(__dirname, "..", "..", "supabase", "migrations", `${MIGRATION_NAME}.sql`);

async function main() {
  requireConfirm();
  const sql = readFileSync(path, "utf8");
  console.log("Applying " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(`INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('${MIGRATION_NAME.slice(0,14)}') ON CONFLICT DO NOTHING;`);

  console.log("\nEfter oprydning — hvor mange kunder har next_visit_planned nu?");
  const efter = await runSql(`
    SELECT
      COUNT(*) FILTER (WHERE next_visit_planned IS NOT NULL) AS med_planlagt,
      COUNT(*) FILTER (WHERE next_visit_planned::date < current_date) AS fortid,
      COUNT(*) FILTER (WHERE next_visit_planned::date = current_date) AS i_dag,
      COUNT(*) FILTER (WHERE next_visit_planned::date > current_date) AS fremtid
    FROM public.companies_lago
    WHERE is_visible_to_sales = true AND is_active = true;
  `);
  console.log(JSON.stringify(efter, null, 2));

  console.log("\nNyt ringeliste-total (forventet 142 = 104 overskredet + 38 aldrig besøgt):");
  const r = await runSql(`
    SELECT (public.dashboard_ringeliste_lago(500))->>'total' AS total,
           (public.dashboard_ringeliste_lago(500))->>'total_overdue' AS overdue,
           (public.dashboard_ringeliste_lago(500))->>'total_never_visited' AS never_visited;
  `);
  console.log(JSON.stringify(r, null, 2));

  console.log("\nReesesFlasker + Kokkens Vinhus efter oprydning:");
  const de2 = await runSql(`
    SELECT c.name, cl.visma_customer_no, cl.next_visit_planned, cl.last_visit_at
    FROM public.companies_lago cl
    JOIN public.companies c ON c.id = cl.company_id
    WHERE cl.visma_customer_no IN ('22948660','44970230');
  `);
  console.log(JSON.stringify(de2, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
