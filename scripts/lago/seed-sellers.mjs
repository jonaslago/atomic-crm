// LAGO Domain-brief 11 · Sektion 2 — seed the kanoniske sælger-liste
// from sælgere.xlsx and reconcile with public.sales via e-mail.
//
// Idempotent: match on visma_sales_code (unique key). Existing rows are
// refreshed with the XLS-latest values; sales_id is only bumped when we
// find a matching sales-row on e-mail. Rows already linked stay linked.
//
// Usage:
//   node scripts/lago/seed-sellers.mjs <path-to.xlsx> confirm=YES
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { requireConfirm, runSql } from "./supabaseAdmin.mjs";

const COL = {
  ansatnr: 0,
  navn: 1,
  brugernavn: 2,
  onsight: 3,
  initialer: 4,
  titel: 5,
  email: 9,
};

function nonEmpty(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "0") return null;
  return s;
}

function labelOf(v) {
  const s = nonEmpty(v);
  if (!s) return null;
  const m = s.match(/\[(.+?)\]$/);
  return (m ? m[1] : s).trim() || null;
}

function parse(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: null,
    raw: false,
  });
  const dataRows = grid.slice(2);
  const rows = [];
  for (const r of dataRows) {
    if (!r) continue;
    const code = nonEmpty(r[COL.ansatnr]);
    const navn = nonEmpty(r[COL.navn]);
    if (!code || !navn) continue;
    rows.push({
      visma_sales_code: code,
      full_name: navn,
      email: nonEmpty(r[COL.email])?.toLowerCase() ?? null,
      initials: nonEmpty(r[COL.initialer]),
      title: nonEmpty(r[COL.titel]),
      active: labelOf(r[COL.onsight]) === "Aktiv",
    });
  }
  return rows;
}

function sqlLit(v) {
  if (v == null) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildSql(rows) {
  const values = rows
    .map(
      (r) =>
        `(${[
          sqlLit(r.visma_sales_code),
          sqlLit(r.full_name),
          sqlLit(r.email),
          sqlLit(r.initials),
          sqlLit(r.title),
          sqlLit(r.active),
        ].join(", ")})`,
    )
    .join(",\n  ");

  return `
CREATE TEMP TABLE _lago_sellers_in (
  visma_sales_code text PRIMARY KEY,
  full_name text NOT NULL,
  email text,
  initials text,
  title text,
  active boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO _lago_sellers_in
  (visma_sales_code, full_name, email, initials, title, active)
VALUES
  ${values};

-- Upsert kanonisk record by visma_sales_code. Refresh all fields except
-- sales_id (that column is managed separately by the mapping step).
INSERT INTO public.lago_sellers
  (visma_sales_code, full_name, email, initials, title, active)
SELECT visma_sales_code, full_name, email, initials, title, active
  FROM _lago_sellers_in
ON CONFLICT (visma_sales_code) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email     = EXCLUDED.email,
  initials  = EXCLUDED.initials,
  title     = EXCLUDED.title,
  active    = EXCLUDED.active,
  updated_at = now();

-- Match sales_id where e-mail overlaps with public.sales.email
-- (case-insensitive via extensions.citext on both sides).
UPDATE public.lago_sellers ls
   SET sales_id = s.id,
       updated_at = now()
  FROM public.sales s
 WHERE ls.email IS NOT NULL
   AND s.email = ls.email
   AND (ls.sales_id IS NULL OR ls.sales_id <> s.id);
`;
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error(
      "Usage: node scripts/lago/seed-sellers.mjs <path-to-sælgere.xlsx> confirm=YES",
    );
    process.exit(1);
  }
  requireConfirm();

  const rows = parse(path);
  console.log(`Parsed ${rows.length} sellers from ${path}`);

  await runSql(buildSql(rows));

  console.log("\nDone. Sample:");
  console.log(
    await runSql(
      `SELECT ls.visma_sales_code, ls.full_name, ls.email, ls.initials,
              ls.active, ls.sales_id, s.email AS sales_email
         FROM public.lago_sellers ls
         LEFT JOIN public.sales s ON s.id = ls.sales_id
        ORDER BY ls.full_name;`,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
