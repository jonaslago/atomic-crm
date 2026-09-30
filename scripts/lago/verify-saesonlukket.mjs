/* eslint-disable no-console */
// Brief 90 §8 verifikation: sæt sæsonlukket-periode på en overdue-kunde,
// bekræft at (1) hun forsvinder fra ringelisten, (2) status skifter til
// 'saesonlukket', (3) days_overdue-værdien er intakt når vinduet slutter.
// Nulstiller kolonnerne bagefter så vi ikke lader test-data ligge.
import { runSql } from "./supabaseAdmin.mjs";

async function main() {
  // Find en overdue-kunde med days_overdue > 14 (matcher ringeliste-14-filter).
  const target = await runSql(`
    SELECT c.id, c.name, vp.days_overdue, vp.status, cl.last_visit_at
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      JOIN public.customers_with_priority_lago vp ON vp.company_id = c.id
     WHERE vp.status = 'overdue' AND vp.days_overdue >= 14
       AND cl.is_visible_to_sales = true AND cl.is_active = true
       AND cl.next_visit_planned IS NULL
       AND cl.saesonlukket_fra IS NULL
     ORDER BY vp.days_overdue ASC
     LIMIT 1
  `);
  if (!target.length) {
    console.log("Ingen egnet test-kunde fundet — afbryder.");
    return;
  }
  const kunde = target[0];
  console.log(`Test-kunde: ${kunde.name} (id=${kunde.id})`);
  console.log(`  Før: status=${kunde.status}, days_overdue=${kunde.days_overdue}, last_visit_at=${kunde.last_visit_at}`);

  const ringFør = await runSql(`SELECT (public.dashboard_ringeliste_lago(500))->>'total' AS total`);
  console.log(`  Ringeliste total FØR: ${ringFør[0].total}`);

  // Sæt periode der slutter i morgen.
  await runSql(
    `UPDATE public.companies_lago
        SET saesonlukket_fra = CURRENT_DATE,
            saesonlukket_til = CURRENT_DATE + 1
      WHERE company_id = ${kunde.id}`,
  );
  const efterSaet = await runSql(
    `SELECT status, days_overdue FROM public.customers_with_priority_lago WHERE company_id = ${kunde.id}`,
  );
  console.log(`\nEfter SET saesonlukket i vinduet:`);
  console.log(`  status=${efterSaet[0].status}, days_overdue=${efterSaet[0].days_overdue}`);
  const ringI = await runSql(`SELECT (public.dashboard_ringeliste_lago(500))->>'total' AS total`);
  console.log(`  Ringeliste total: ${ringI[0].total} (skal være ${ringFør[0].total - 1})`);

  // Sæt vinduet til at være FÆRDIGT (uden at slippe uret).
  await runSql(
    `UPDATE public.companies_lago
        SET saesonlukket_fra = CURRENT_DATE - 10,
            saesonlukket_til = CURRENT_DATE - 1
      WHERE company_id = ${kunde.id}`,
  );
  const efterUdløb = await runSql(
    `SELECT status, days_overdue FROM public.customers_with_priority_lago WHERE company_id = ${kunde.id}`,
  );
  console.log(`\nEfter UDLØB (til = i går):`);
  console.log(`  status=${efterUdløb[0].status}, days_overdue=${efterUdløb[0].days_overdue}`);
  console.log(`  KRAV: status skal være tilbage til '${kunde.status}', days_overdue = ${kunde.days_overdue}`);
  const uretIntakt =
    efterUdløb[0].status === kunde.status &&
    efterUdløb[0].days_overdue === kunde.days_overdue;
  console.log(`  Uret intakt: ${uretIntakt ? "JA ✓" : "NEJ ✗"}`);

  // Ryd op — nulstil kolonnerne.
  await runSql(
    `UPDATE public.companies_lago
        SET saesonlukket_fra = NULL, saesonlukket_til = NULL
      WHERE company_id = ${kunde.id}`,
  );
  console.log(`\nRyd op: kolonnerne nulstillet for kunde ${kunde.id}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
