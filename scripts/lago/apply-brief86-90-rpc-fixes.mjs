/* eslint-disable no-console */
// Brief 86 §8-korrektur + brief 90 §1 (28. sep 2026): to RPC-migrationer.
//   1. dashboard_datahuller_lago udvidet med `distinkte_kunder`
//   2. dashboard_ringeliste_lago tærskel fra 5 til 14 dage
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATIONS = [
  "20260929002000_lago_86_datahuller_distinct",
  "20260929003000_lago_90_ringeliste_14_dage",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function apply(name) {
  const migrationPath = resolve(
    __dirname,
    "..",
    "..",
    "supabase",
    "migrations",
    `${name}.sql`,
  );
  const sql = readFileSync(migrationPath, "utf8");
  console.log("Applying " + name + " …");
  await runSql(sql);
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations(version)
     VALUES ('${name.slice(0, 14)}')
     ON CONFLICT (version) DO NOTHING;`,
  );
}

async function main() {
  requireConfirm();
  for (const name of MIGRATIONS) {
    await apply(name);
  }

  console.log("\ndashboard_datahuller_lago output:");
  const dh = await runSql(`SELECT public.dashboard_datahuller_lago() AS payload`);
  console.log(JSON.stringify(dh[0]?.payload?.counts, null, 2));
  console.log("distinkte_kunder =", dh[0]?.payload?.distinkte_kunder);

  console.log("\ndashboard_ringeliste_lago total (efter 14-dage-skift):");
  const rl = await runSql(`SELECT (public.dashboard_ringeliste_lago(200))->>'total' AS total`);
  console.log("total =", rl[0]?.total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
