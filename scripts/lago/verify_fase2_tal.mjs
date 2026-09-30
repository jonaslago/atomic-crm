// Brief 64 fase 2 trin 5 · dry-run verifikation
//
// Regel (Jonas): "Jeg taeller aldrig direkte paa viewet uden begge flag."
// Alle counts joiner companies_lago paa (is_visible_to_sales=true AND
// is_active=true) — den samme synligheds-baseline sælgerskærme ser.
// Uden det ville 260-tallet lydloest blive 674 (X-kunder + inaktive).

import { runSql } from "./supabaseAdmin.mjs";

const BASELINE = `
  FROM public.customers_with_priority_lago vp
  JOIN public.companies_lago cl ON cl.company_id = vp.company_id
  WHERE cl.is_visible_to_sales = true
    AND cl.is_active = true
`;

async function count(label, extraWhere) {
  const sql = `SELECT count(*)::int AS n ${BASELINE} ${extraWhere ? "AND " + extraWhere : ""};`;
  const rows = await runSql(sql);
  const n = Array.isArray(rows) ? rows[0]?.n : rows?.[0]?.n;
  console.log(label.padEnd(48), n);
  return n;
}

console.log("--- Fase 2 tal (saelger-baseline: synlig+aktiv) ---");
const total = await count("Grundmaengde (baseline synlig+aktiv):");
const overdue = await count("Overdue:", `vp.status = 'overdue'`);
const neverVisited = await count("Never_visited:", `vp.status = 'never_visited'`);
const soon = await count("Soon:", `vp.status = 'soon'`);
const onPlan = await count("On_plan:", `vp.status = 'on_plan'`);
const noUrgency = await count("No_urgency (X/L):", `vp.status = 'no_urgency'`);

console.log("\n--- Ringelistens ekstra filtre (overdue + planlagt tom + >= 5 dage) ---");
const ring = await count(
  "Ringeliste kandidater:",
  `vp.status = 'overdue' AND cl.next_visit_planned IS NULL AND vp.days_overdue >= 5`,
);

console.log("\n--- RPC direkte (dashboard_ringeliste_lago) ---");
const rpc = await runSql(
  `SELECT (public.dashboard_ringeliste_lago(20)->>'total')::int AS total;`,
);
const rpcTotal = Array.isArray(rpc) ? rpc[0]?.total : rpc?.[0]?.total;
console.log("RPC total:".padEnd(48), rpcTotal);

console.log("\n--- Sum-check (skal give grundmaengden) ---");
console.log(
  "sum(alle status):".padEnd(48),
  (overdue ?? 0) + (neverVisited ?? 0) + (soon ?? 0) + (onPlan ?? 0) + (noUrgency ?? 0),
  " vs baseline:",
  total,
);
