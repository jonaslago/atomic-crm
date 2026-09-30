// Hastesag 28. sep 2026: Jonas har ved et uheld sendt en af Peters
// opgaver til kontoret via de nye ikonknapper. Finder den — sales_id
// NULL, marker med Jonas' navn og dagens dato i text. RULLER IKKE.
import { runSql } from "./supabaseAdmin.mjs";

async function q(label, sql) {
  console.log(`\n--- ${label} ---`);
  try {
    const r = await runSql(sql);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.log(`FEJL: ${e?.message ?? e}`);
  }
}

await q(
  "Handoff-tasks med Jonas Arild i marker-teksten (uden dato-filter)",
  `SELECT
     t.id,
     t.text,
     t.contact_id,
     t.due_date,
     t.type,
     co.name AS kunde_navn,
     co.id AS company_id,
     co.sales_id AS company_sales_id,
     cs.first_name || ' ' || cs.last_name AS kundes_saelger
   FROM public.tasks t
   LEFT JOIN public.contacts c ON c.id = t.contact_id
   LEFT JOIN public.companies co ON co.id = c.company_id
   LEFT JOIN public.sales cs ON cs.id = co.sales_id
   WHERE t.sales_id IS NULL
     AND t.text ILIKE '%— Sendt til kontoret%Jonas Arild%'
     AND t.done_date IS NULL
   ORDER BY t.id DESC
   LIMIT 20`,
);

await q(
  "task_events_lago — seneste handoff-events i dag (via event_type hvis muligt)",
  `SELECT event_type, task_id, event_af, created_at, LEFT(event_note, 200) AS note
   FROM public.task_events_lago
   WHERE created_at > CURRENT_DATE
   ORDER BY created_at DESC
   LIMIT 20`,
);
