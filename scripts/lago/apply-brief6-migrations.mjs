// Apply the two LAGO Domain-brief 6 migrations
// (visma_aktoer_nr on companies_lago + contacts_lago sidecar) to the
// cloud database, then record them in supabase_migrations.schema_migrations.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATIONS = [
  "20260710130000_lago_companies_aktoer_nr",
  "20260710140000_lago_contacts_sidecar",
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

  console.log("\ncompanies_lago columns:");
  console.log(
    await runSql(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='companies_lago'
          AND column_name IN ('visma_customer_no','visma_aktoer_nr')
        ORDER BY column_name;`,
    ),
  );
  console.log("\ncontacts_lago exists:");
  console.log(
    await runSql(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='contacts_lago'
        ORDER BY ordinal_position;`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
