// Brief 87 audit-svar (28. sep 2026): mål om blød sletning af aktivitet/
// note logges nogen steder. RET INGENTING — kun rapport.
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
  "1a · Findes en log-tabel for aktiviteter?",
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public'
     AND (table_name ILIKE '%activity%event%'
       OR table_name ILIKE '%activity%log%'
       OR table_name ILIKE '%activity%history%'
       OR table_name ILIKE '%activity_events%')
   ORDER BY table_name`,
);

await q(
  "1b · Findes en log-tabel for noter?",
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public'
     AND (table_name ILIKE '%note%event%'
       OR table_name ILIKE '%note%log%'
       OR table_name ILIKE '%note%history%')
   ORDER BY table_name`,
);

await q(
  "1c · Triggers på customer_activities_lago (skriver de nogen log-tabel?)",
  `SELECT trigger_name, event_manipulation, action_statement
   FROM information_schema.triggers
   WHERE event_object_schema='public' AND event_object_table='customer_activities_lago'
   ORDER BY trigger_name`,
);

await q(
  "1d · Triggers på contactNotes",
  `SELECT trigger_name, event_manipulation, action_statement
   FROM information_schema.triggers
   WHERE event_object_schema='public'
     AND event_object_table IN ('contactNotes', 'contact_notes', 'notes')
   ORDER BY trigger_name`,
);

await q(
  "1e · Alle log-lignende tabeller i public",
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public'
     AND (table_name ILIKE '%_log%' OR table_name ILIKE '%_events%' OR table_name ILIKE '%_history%')
   ORDER BY table_name`,
);

await q(
  "2 · Antal deleted_at IS NOT NULL i customer_activities_lago (spor af blød sletning)",
  `SELECT COUNT(*)::int AS slettede,
          MAX(updated_at) AS seneste_sletning
     FROM public.customer_activities_lago
    WHERE deleted_at IS NOT NULL`,
);

await q(
  "3 · Findes soft_delete_customer_activity RPC-body — hvad skriver den?",
  `SELECT pg_get_functiondef(oid)
   FROM pg_proc WHERE proname='soft_delete_customer_activity'`,
);
