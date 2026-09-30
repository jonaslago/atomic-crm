// Brief 85 tillæg (28. sep 2026): tæller planlagte besøg i basen — vi har
// målt 1 og læst det som "ingen planlægger", men kunne lige så vel være
// "man knap nok kunne". Tallet er svaret på hvor akut planlæg-hullet er.
import { runSql } from "./supabaseAdmin.mjs";

const total = await runSql(
  "SELECT COUNT(*)::int AS n FROM public.companies_lago WHERE next_visit_planned IS NOT NULL",
);
const future = await runSql(
  "SELECT COUNT(*)::int AS n FROM public.companies_lago WHERE next_visit_planned IS NOT NULL AND next_visit_planned >= now()",
);

console.log("Planlagte i alt:", total?.[0]?.n ?? total);
console.log("Planlagte i fremtiden:", future?.[0]?.n ?? future);
