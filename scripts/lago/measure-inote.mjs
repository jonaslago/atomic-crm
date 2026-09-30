/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  console.log("=== Ordre 32470 · alle linjer i basen ===");
  const linjer = await runSql(`
    SELECT linje_nr, produktnr, antal, reserveret_mod_lager, ej_faktureret,
           lagerstatus, levering, status, note, undtages_lagerhaandtering
      FROM public.open_orders_lago WHERE ordre_nr = '32470'
      ORDER BY linje_nr
  `);
  console.log(JSON.stringify(linjer, null, 2));

  console.log("\n=== inote/enote-forekomst i alle åbne ordrer ===");
  const forekomst = await runSql(`
    SELECT
      COUNT(*) FILTER (WHERE produktnr IN ('inote','enote')) AS note_linjer_total,
      COUNT(DISTINCT ordre_nr) FILTER (WHERE produktnr IN ('inote','enote')) AS ordrer_med_note_linjer,
      COUNT(DISTINCT visma_customer_no) FILTER (WHERE produktnr IN ('inote','enote')) AS kunder_med_note_linjer,
      COUNT(*) FILTER (WHERE produktnr = 'inote') AS inote_linjer,
      COUNT(*) FILTER (WHERE produktnr = 'enote') AS enote_linjer,
      COUNT(*) FILTER (WHERE produktnr IN ('inote','enote') AND TRIM(COALESCE(note,'')) <> '') AS note_med_tekst
    FROM public.open_orders_lago
  `);
  console.log(JSON.stringify(forekomst, null, 2));

  console.log("\n=== Hvor mange af de 37 Kan sendes-kunder har inote/enote-linjer? ===");
  const overlap = await runSql(`
    WITH kan_sendes AS (
      SELECT rows.value ->> 'visma_customer_no' AS visma_customer_no
      FROM jsonb_array_elements((public.dashboard_kan_sendes_lago(500)) -> 'rows') AS rows(value)
    )
    SELECT
      (SELECT COUNT(*) FROM kan_sendes) AS kan_sendes_kunder,
      (SELECT COUNT(*) FROM kan_sendes ks WHERE EXISTS (
        SELECT 1 FROM public.open_orders_lago o
        WHERE o.visma_customer_no = ks.visma_customer_no
          AND o.produktnr IN ('inote','enote')
      )) AS kan_sendes_med_note_linje
  `);
  console.log(JSON.stringify(overlap, null, 2));

  console.log("\n=== inote-linjer der ligger på Kan sendes-ordrer specifikt ===");
  const paaOrdren = await runSql(`
    WITH ordre_flag AS (
      SELECT
        o.ordre_nr,
        o.visma_customer_no,
        BOOL_AND(o.lagerstatus = 'klar') AS all_klar,
        BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_faerdigmeldt,
        BOOL_AND(COALESCE(o.undtages_lagerhaandtering, false) = false) AS ingen_undtages,
        BOOL_AND(o.levering = '0') AS levering_nul,
        BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep
      FROM public.open_orders_lago o
      WHERE o.produktnr NOT IN ('inote','enote')
      GROUP BY o.ordre_nr, o.visma_customer_no
    )
    SELECT
      COUNT(*) AS kan_sendes_ordrer,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.open_orders_lago n
        WHERE n.ordre_nr = of.ordre_nr AND n.produktnr IN ('inote','enote')
      )) AS kan_sendes_ordrer_med_note_linje
    FROM ordre_flag of
    WHERE all_klar AND ingen_faerdigmeldt AND ingen_undtages AND levering_nul AND ikke_mav AND ikke_ep
  `);
  console.log(JSON.stringify(paaOrdren, null, 2));

  console.log("\n=== inote-tekster hos Kan sendes-kunder (indhold der findes) ===");
  const eksempler = await runSql(`
    SELECT o.ordre_nr, o.produktnr, o.note
    FROM public.open_orders_lago o
    WHERE o.produktnr IN ('inote','enote')
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements((public.dashboard_kan_sendes_lago(500)) -> 'rows') r
        WHERE r.value ->> 'visma_customer_no' = o.visma_customer_no
      )
    LIMIT 20
  `);
  console.log(JSON.stringify(eksempler, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
