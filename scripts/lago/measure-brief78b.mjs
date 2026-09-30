/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== AEvin ordre 34696 · alle linjer i basen ===");
  const aevin = await runSql(`
    SELECT linje_nr, produktnr, antal, reserveret_mod_lager, ej_faktureret,
           lagerstatus, levering, undtages_lagerhaandtering
      FROM public.open_orders_lago
     WHERE ordre_nr = '34696'
     ORDER BY linje_nr::int
  `);
  console.log(JSON.stringify(aevin, null, 2));
  const aevinSum = await runSql(`
    SELECT
      COUNT(*) AS linjer,
      COUNT(*) FILTER (WHERE undtages_lagerhaandtering = true) AS undtages_linjer,
      SUM(ej_faktureret)::numeric(14,2) AS ordre_belob
    FROM public.open_orders_lago WHERE ordre_nr='34696'
  `);
  console.log("\nAEvin 34696 sum:", aevinSum);

  console.log("\n=== Vej/Energi/emb-afg-linjer i basen ===");
  const tillaeg = await runSql(`
    SELECT produktnr, COUNT(*) AS linjer, SUM(ej_faktureret)::numeric(14,2) AS beloeb
      FROM public.open_orders_lago
     WHERE produktnr IN ('Vej','Energi','emb-afg')
     GROUP BY produktnr
     ORDER BY produktnr
  `);
  console.log(JSON.stringify(tillaeg, null, 2));

  console.log("\n=== Sum af beløb på alle åbne ordrer i basen ===");
  const totalSum = await runSql(`
    SELECT
      COUNT(*) AS linjer,
      SUM(ej_faktureret)::numeric(14,2) AS beloeb_i_alt,
      COUNT(*) FILTER (WHERE undtages_lagerhaandtering = true) AS undtages_linjer,
      SUM(ej_faktureret) FILTER (WHERE undtages_lagerhaandtering = true)::numeric(14,2) AS undtages_beloeb
    FROM public.open_orders_lago
  `);
  console.log(JSON.stringify(totalSum, null, 2));

  console.log("\n=== Sammenlign med brief 78 tillæg B (22. sep 2026): ===");
  console.log("Brief-tal: 5.970.832 kr total (før fix), 303.670 kr tabt på 45 ordrer");
  console.log("Bemærk: 22. sep-tal er efter 6 dages ordrer/leverancer siden");
}
main().catch(e => { console.error(e); process.exit(1); });
