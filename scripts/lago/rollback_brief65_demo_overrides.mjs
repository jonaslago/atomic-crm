// Ryd demo-overrides indsat under brief 65-toerloeb.
// Jonas' UPDATE, koert som skrevet.
import { runSql } from "./supabaseAdmin.mjs";
const res = await runSql(`
  UPDATE public.companies_lago
     SET besoegsfrekvens_dage = NULL, besoegsfrekvens_note = NULL,
         besoegsfrekvens_sat_af = NULL, besoegsfrekvens_sat = NULL
   WHERE besoegsfrekvens_note IS NOT NULL
  RETURNING company_id, (SELECT name FROM public.companies WHERE id = company_id) AS name;
`);
console.log('rows nulstillet:', JSON.stringify(res));

const ring = await runSql(
  `SELECT (public.dashboard_ringeliste_lago(20)->>'total')::int AS total;`,
);
console.log('ringeliste total:', JSON.stringify(ring));

const rest = await runSql(
  `SELECT count(*)::int AS n FROM public.companies_lago
   WHERE besoegsfrekvens_dage IS NOT NULL
      OR besoegsfrekvens_note IS NOT NULL
      OR besoegsfrekvens_sat_af IS NOT NULL
      OR besoegsfrekvens_sat IS NOT NULL;`,
);
console.log('resterende override-raekker (skal vaere 0):', JSON.stringify(rest));
