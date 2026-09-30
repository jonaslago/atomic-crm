// Apply LAGO Domain-brief 19 trin 1 — salgsdata-fundament
// (sales_monthly_lago, open_orders_lago, sync_runs_lago +
//  companies_lago.kundetype). Records the migration in
//  supabase_migrations.schema_migrations so `supabase db push` won't
//  try to re-run it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql, requireConfirm } from "./supabaseAdmin.mjs";

const MIGRATIONS = [
  "20260902130000_lago_sales_foundation",
  "20260902140000_lago_sales_views",
  "20260902150000_lago_open_orders_categories",
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

  console.log("\nsales_monthly_lago columns:");
  console.log(
    await runSql(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='sales_monthly_lago'
        ORDER BY ordinal_position;`,
    ),
  );

  console.log("\nopen_orders_lago columns:");
  console.log(
    await runSql(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='open_orders_lago'
        ORDER BY ordinal_position;`,
    ),
  );

  console.log("\nsync_runs_lago columns:");
  console.log(
    await runSql(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='sync_runs_lago'
        ORDER BY ordinal_position;`,
    ),
  );

  console.log("\ncompanies_lago.kundetype present?");
  console.log(
    await runSql(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='companies_lago'
          AND column_name='kundetype';`,
    ),
  );

  console.log("\nRow counts (skal alle være 0):");
  console.log(
    await runSql(
      `SELECT
         (SELECT COUNT(*) FROM public.sales_monthly_lago) AS sales_monthly,
         (SELECT COUNT(*) FROM public.open_orders_lago)   AS open_orders,
         (SELECT COUNT(*) FROM public.sync_runs_lago)     AS sync_runs;`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
