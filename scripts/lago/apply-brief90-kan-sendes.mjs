/* eslint-disable no-console */
// Brief 90 §4: Kan sendes-RPC.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATION_NAME = "20260929020000_lago_90_kan_sendes_rpc";

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
  const sql = readFileSync(migrationPath, "utf8");
  console.log("Applying migration " + MIGRATION_NAME + " …");
  await runSql(sql);
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${MIGRATION_NAME.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );

  const total = await runSql(
    `SELECT (public.dashboard_kan_sendes_lago(500))->>'total' AS total`,
  );
  console.log("\nKan-sendes total (kunder):", total[0].total);

  const rows = await runSql(
    `SELECT jsonb_pretty(public.dashboard_kan_sendes_lago(5)) AS out`,
  );
  console.log("\nTop 5:\n" + rows[0].out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
