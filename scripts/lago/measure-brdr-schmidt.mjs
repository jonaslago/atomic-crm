/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== Brdr. Schmidt Vinhandel — kunde-metadata ===");
  const kunde = await runSql(`
    SELECT c.id, c.name, c.sales_id AS kunde_sales_id,
           s.first_name || ' ' || s.last_name AS kunde_saelger
    FROM public.companies c
    LEFT JOIN public.sales s ON s.id = c.sales_id
    WHERE c.name ILIKE '%Brdr%Schmidt%Vinhandel%'
  `);
  console.log(JSON.stringify(kunde, null, 2));

  console.log("\n=== Åbne opgaver på Brdr. Schmidt (via contact) ===");
  const opgaver = await runSql(`
    SELECT t.id, t.text, t.type, t.due_date, t.done_date,
           t.sales_id AS opgave_sales_id,
           s.first_name || ' ' || s.last_name AS opgave_ejer,
           t.contact_id, t.origin,
           ct.first_name || ' ' || COALESCE(ct.last_name, '') AS kontakt,
           t.created_at
    FROM public.tasks t
    JOIN public.contacts ct ON ct.id = t.contact_id
    JOIN public.companies c ON c.id = ct.company_id
    LEFT JOIN public.sales s ON s.id = t.sales_id
    WHERE c.name ILIKE '%Brdr%Schmidt%Vinhandel%'
      AND t.done_date IS NULL
    ORDER BY t.due_date NULLS LAST
  `);
  console.log(JSON.stringify(opgaver, null, 2));

  console.log("\n=== Alle åbne opgaver hvor Peter er ejer (opgave.sales_id) ===");
  const peterOpgaver = await runSql(`
    SELECT t.id, t.text, t.due_date, t.contact_id,
           c.name AS kunde, c.sales_id AS kunde_sales_id
    FROM public.tasks t
    JOIN public.contacts ct ON ct.id = t.contact_id
    JOIN public.companies c ON c.id = ct.company_id
    LEFT JOIN public.sales s ON s.id = c.sales_id
    WHERE t.done_date IS NULL
      AND t.sales_id = 5
    ORDER BY t.due_date NULLS LAST
  `);
  console.log(JSON.stringify(peterOpgaver, null, 2));

  console.log("\n=== Widget-simulering: opgaver hvor sales_id=5, due_date < i dag + 8 ===");
  const widgetSim = await runSql(`
    SELECT t.id, t.text, t.due_date,
           CASE WHEN t.due_date < CURRENT_DATE THEN 'OVERSKREDET'
                WHEN t.due_date >= CURRENT_DATE AND t.due_date < CURRENT_DATE + INTERVAL '8 days' THEN 'i vinduet'
                ELSE 'senere' END AS periode,
           c.name AS kunde
    FROM public.tasks t
    JOIN public.contacts ct ON ct.id = t.contact_id
    JOIN public.companies c ON c.id = ct.company_id
    WHERE t.done_date IS NULL
      AND t.sales_id = 5
      AND t.due_date < CURRENT_DATE + INTERVAL '8 days'
    ORDER BY t.due_date NULLS LAST
  `);
  console.log(JSON.stringify(widgetSim, null, 2));

  console.log("\n=== Aktivitetsside-simulering: opgaver hvor sales_id=5, due_date i denne uge (mandag-søndag) ===");
  const aktSim = await runSql(`
    SELECT t.id, t.text, t.due_date, c.name AS kunde
    FROM public.tasks t
    JOIN public.contacts ct ON ct.id = t.contact_id
    JOIN public.companies c ON c.id = ct.company_id
    WHERE t.done_date IS NULL
      AND t.sales_id = 5
      AND t.due_date >= date_trunc('week', CURRENT_DATE)
      AND t.due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
    ORDER BY t.due_date NULLS LAST
  `);
  console.log(JSON.stringify(aktSim, null, 2));

  console.log("\nJonas har sales.id = ?");
  const jonasId = await runSql(`SELECT id, first_name, last_name FROM public.sales WHERE first_name ILIKE 'jonas%'`);
  console.log(JSON.stringify(jonasId, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
