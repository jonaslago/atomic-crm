/* eslint-disable no-console */
// Brief 80: revoke anon EXECUTE on all public functions + fix search_path
// on sync_lago_role_to_administrator. Jonas godkendte eksplicit 23. sep.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260923150000_lago_80_revoke_anon_execute";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationPath = resolve(
  __dirname,
  "..",
  "..",
  "supabase",
  "migrations",
  `${MIGRATION_NAME}.sql`,
);

async function main() {
  requireConfirm();

  console.log("BEFORE — funktioner hvor anon har EXECUTE:");
  const before = await runSql(
    `SELECT COUNT(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE');`,
  );
  console.log("  count:", JSON.stringify(before));

  const sql = readFileSync(migrationPath, "utf8");
  console.log("\nApplying migration " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );

  console.log("\nAFTER — funktioner hvor anon har EXECUTE:");
  const after = await runSql(
    `SELECT COUNT(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE');`,
  );
  console.log("  count:", JSON.stringify(after));

  console.log("\nAFTER — sync_lago_role_to_administrator proconfig:");
  const sp = await runSql(
    `SELECT p.proname, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname='sync_lago_role_to_administrator';`,
  );
  console.log("  ", JSON.stringify(sp));

  console.log("\nAFTER — authenticated har stadig EXECUTE på (stikprøve):");
  const auth = await runSql(
    `SELECT proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ok FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.proname IN ('derive_sales_id_from_visma', 'update_activity', 'soft_delete_customer_activity', 'mark_activity_done', 'end_impersonation', 'close_matched_change_suggestions', 'record_ai_suggestion_outcomes', 'map_branche_kode', 'dashboard_ringeliste_lago') ORDER BY proname;`,
  );
  for (const r of auth)
    console.log("  " + (r.ok ? "✓" : "✗") + " " + r.proname);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
