// GDPR-conscious backup of the LAGO customer tables before we mutate
// them. Dumps public.companies and public.companies_lago as JSON to
// backups/companies-<ISO>.json — keep the file locally, do not commit it
// (backups/ is gitignored).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSql } from "./supabaseAdmin.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKUP_DIR = resolve(__dirname, "..", "..", "backups");

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  console.log("Fetching public.companies …");
  const companies = await runSql(
    "SELECT * FROM public.companies ORDER BY id",
  );

  console.log("Fetching public.companies_lago …");
  const lago = await runSql(
    "SELECT * FROM public.companies_lago ORDER BY company_id",
  );

  console.log("Fetching public.sales …");
  const sales = await runSql(
    "SELECT id, first_name, last_name, email, administrator, disabled, user_id FROM public.sales ORDER BY id",
  );

  const payload = {
    taken_at: new Date().toISOString(),
    project_ref: "jayufvgsgiuuzpaptjlh",
    companies,
    companies_lago: lago,
    sales,
  };
  const outPath = resolve(BACKUP_DIR, `companies-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(payload, null, 2));

  const nCompanies = Array.isArray(companies) ? companies.length : "?";
  const nLago = Array.isArray(lago) ? lago.length : "?";
  const nSales = Array.isArray(sales) ? sales.length : "?";
  console.log(`Backup written: ${outPath}`);
  console.log(
    `Rows: companies=${nCompanies}, companies_lago=${nLago}, sales=${nSales}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
