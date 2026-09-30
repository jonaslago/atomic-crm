/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  const rows = await runSql(`
    WITH s AS (
      SELECT o.ordre_nr, o.linje_nr, o.produktnr, o.antal,
             o.reserveret_mod_lager, o.antal_faerdigmeldt, o.ej_faktureret,
             o.lagerstatus, o.levering, o.status, o.mav, o.note,
             o.undtages_lagerhaandtering
      FROM public.open_orders_lago o
      WHERE o.ordre_nr IN ('34980','34881','34868','34644','33900')
    )
    SELECT ordre_nr,
           STRING_AGG(DISTINCT levering, ',') AS lev,
           STRING_AGG(DISTINCT status, ',') AS status,
           BOOL_AND(lagerstatus='klar') AS alle_klar,
           BOOL_OR(lagerstatus <> 'klar') AS nogen_ikke_klar,
           BOOL_AND(COALESCE(antal_faerdigmeldt,0)=0) AS ingen_fmt,
           BOOL_AND(COALESCE(undtages_lagerhaandtering,false)=false) AS ingen_undt,
           BOOL_OR(COALESCE(mav,false)) AS har_mav,
           MAX(NULLIF(TRIM(COALESCE(note,'')),'')) AS note,
           COUNT(*) AS linjer,
           SUM(ej_faktureret)::numeric(14,2) AS beloeb
      FROM s GROUP BY ordre_nr ORDER BY ordre_nr
  `);
  console.log("Ordre-aggregeret:");
  console.log(JSON.stringify(rows, null, 2));

  console.log("\nLinjeniveau-detalje for alle 5:");
  const detail = await runSql(`
    SELECT ordre_nr, linje_nr, produktnr, antal, reserveret_mod_lager,
           antal_faerdigmeldt, ej_faktureret, lagerstatus, levering, status,
           mav, note
    FROM public.open_orders_lago
    WHERE ordre_nr IN ('34980','34881','34868','34644','33900')
    ORDER BY ordre_nr, linje_nr::int
  `);
  console.log(JSON.stringify(detail, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
