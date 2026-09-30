// Apply the two LAGO Domain-brief 11 migrations (lago_settings +
// lago_sellers) to the cloud database and record them in
// supabase_migrations.schema_migrations.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATIONS = [
  "20260714120000_lago_settings",
  "20260714130000_lago_sellers",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  requireConfirm();
  for (const name of MIGRATIONS) {
    const p = resolve(
      __dirname,
      "..",
      "..",
      "supabase",
      "migrations",
      `${name}.sql`,
    );
    console.log(`Applying ${name} …`);
    await runSql(readFileSync(p, "utf8"));
    await runSql(
      `INSERT INTO supabase_migrations.schema_migrations(version)
       VALUES ('${name.slice(0, 14)}')
       ON CONFLICT (version) DO NOTHING;`,
    );
  }
  console.log("\nlago_settings columns:");
  console.log(
    await runSql(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='lago_settings'
        ORDER BY ordinal_position;`,
    ),
  );
  console.log("\nlago_sellers columns:");
  console.log(
    await runSql(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='lago_sellers'
        ORDER BY ordinal_position;`,
    ),
  );
  console.log("\nDefault visit_intervals:");
  console.log(
    await runSql(
      `SELECT value FROM public.lago_settings WHERE key='visit_intervals';`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
