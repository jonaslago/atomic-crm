// Brief 65 · applyer migrationerne via Management API og opdaterer
// supabase_migrations.schema_migrations saa `supabase db push` ikke
// tror de mangler naeste gang. Samme moenster som apply-brief11.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

requireConfirm();

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = resolve(__dirname, "..", "..", "supabase", "migrations");

const files = [
  "20260922030000_lago_65_besoegsfrekvens_override.sql",
  "20260922040000_lago_65_view_with_override.sql",
  "20260922050000_lago_65_ringeliste_med_note.sql",
];

for (const f of files) {
  const version = f.slice(0, 14);
  const name = f.slice(15, -4);
  const sql = readFileSync(resolve(MIG_DIR, f), "utf8");
  console.log(`\n--- ${f}`);
  await runSql(sql);
  await runSql(
    `INSERT INTO supabase_migrations.schema_migrations (version, name)
     VALUES ('${version}', '${name}')
     ON CONFLICT (version) DO NOTHING;`,
  );
  console.log(`  applied + tracked`);
}

console.log("\nAll brief 65 migrations applied.");
