// UDFØRELSE (efter Jonas' "ja" 28. sep 2026): rul task 23 tilbage.
// - sales_id: NULL → 5 (Peter Ærensgaard)
// - text: fjern marker-linjen, behold "Ring til Paw"
// - task_events_lago-række med event_type='genaabnet' og note om rollback
import { runSql } from "./supabaseAdmin.mjs";

const TASK_ID = 23;
const PETER_SALES_ID = 5;
const JONAS_AUTH_UID = "dea91388-8130-4bf3-87ec-0c74bdd3492d";
const ORIGINAL_TEXT = "Ring til Paw";

async function q(label, sql) {
  console.log(`\n--- ${label} ---`);
  const r = await runSql(sql);
  console.log(JSON.stringify(r, null, 2));
  return r;
}

// 1) Ret tasks
await q(
  "1a · UPDATE tasks (sales_id + text)",
  `UPDATE public.tasks
   SET sales_id = ${PETER_SALES_ID},
       text = ${JSON.stringify(ORIGINAL_TEXT).replace(/^"/, "'").replace(/"$/, "'")}
   WHERE id = ${TASK_ID}
   RETURNING id, sales_id, text`,
);

// 2) Log-event
await q(
  "1b · INSERT task_events_lago (genaabnet · rollback)",
  `INSERT INTO public.task_events_lago (task_id, event_type, event_af, note)
   VALUES (
     ${TASK_ID},
     'genaabnet',
     '${JONAS_AUTH_UID}'::uuid,
     'Rollback af utilsigtet handoff via ny ikonknap 28. sep 2026. sales_id nulstillet fra NULL til ${PETER_SALES_ID} (Peter Ærensgaard); marker-teksten "— Sendt til kontoret 28. sep. 2026 af Jonas Arild" fjernet fra tasks.text. Fejlen: Send videre-knappen fyrede uden bekræftelse; friktion tilføjes i næste deploy.'
   )
   RETURNING id, task_id, event_type, event_at`,
);

// 3) Efter-tilstand
await q(
  "1c · Efter-tilstand task 23",
  `SELECT id, text, sales_id FROM public.tasks WHERE id = ${TASK_ID}`,
);

await q(
  "1d · Seneste 3 task_events_lago-rækker for task 23",
  `SELECT event_type, event_at, event_af, LEFT(note, 200) AS note
   FROM public.task_events_lago
   WHERE task_id = ${TASK_ID}
   ORDER BY event_at DESC
   LIMIT 3`,
);
