// Hastesag 28. sep 2026: rollback af task 23 (Ring til Paw / Rombo.dk),
// som Jonas ved et uheld sendte til kontoret via ny ikonknap. Jonas har
// bekræftet id=23. To skridt: (1) sales_id tilbage til Peter (5) og
// marker-tekst fjernet, (2) task_events_lago-række der noterer det.

import { runSql } from "./supabaseAdmin.mjs";

async function q(label, sql) {
  console.log(`\n--- ${label} ---`);
  try {
    const r = await runSql(sql);
    console.log(JSON.stringify(r, null, 2));
    return r;
  } catch (e) {
    console.log(`FEJL: ${e?.message ?? e}`);
    throw e;
  }
}

// Kortlægning før skrivning — vi skal vide hvad event_type-CHECK'en
// tillader, og hvad kolonnenavne præcis hedder.
await q(
  "task_events_lago kolonner",
  `SELECT column_name, data_type, is_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='task_events_lago'
   ORDER BY ordinal_position`,
);

await q(
  "CHECK-constraints på task_events_lago",
  `SELECT conname, pg_get_constraintdef(oid) AS def
   FROM pg_constraint
   WHERE conrelid='public.task_events_lago'::regclass
     AND contype='c'`,
);

await q(
  "Jonas' auth.uid (til event_af)",
  `SELECT au.id::text AS auth_uid, au.email, s.first_name, s.last_name
   FROM auth.users au
   JOIN public.sales s ON s.email = au.email
   WHERE s.first_name = 'Jonas' AND s.last_name = 'Arild'`,
);

await q(
  "Før-tilstand for task 23",
  `SELECT id, text, sales_id FROM public.tasks WHERE id = 23`,
);
