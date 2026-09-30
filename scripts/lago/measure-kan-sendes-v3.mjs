/* eslint-disable no-console */
import { runSql } from "./supabaseAdmin.mjs";
async function main() {
  // Test flere tolkninger for at ramme brief 90's 171/73/2289k.
  const tests = [
    { navn: "kun all_klar (uden alle andre filtre)", where: "all_klar" },
    { navn: "all_klar + ikke_mav (loose)", where: "all_klar AND ikke_mav" },
    { navn: "all_klar + levering=0", where: "all_klar AND levering_nul" },
    { navn: "brief 90 præcis", where: "all_klar AND ingen_faerdigmeldt AND ingen_undtages AND levering_nul AND ikke_mav AND ikke_ep" },
    { navn: "brief 90 uden undtages", where: "all_klar AND ingen_faerdigmeldt AND levering_nul AND ikke_mav AND ikke_ep" },
    { navn: "brief 90 uden ep-filter", where: "all_klar AND ingen_faerdigmeldt AND ingen_undtages AND levering_nul AND ikke_mav" },
    { navn: "before 2026-09-22 + brief 90 præcis", where: "all_klar AND ingen_faerdigmeldt AND ingen_undtages AND levering_nul AND ikke_mav AND ikke_ep AND aeldste_ordredato <= '2026-09-22'" },
  ];
  for (const t of tests) {
    const res = await runSql(`
      WITH ordre_flag AS (
        SELECT
          o.ordre_nr,
          o.visma_customer_no,
          BOOL_AND(o.lagerstatus = 'klar') AS all_klar,
          BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_faerdigmeldt,
          BOOL_AND(COALESCE(o.undtages_lagerhaandtering, false) = false) AS ingen_undtages,
          BOOL_AND(o.levering = '0') AS levering_nul,
          BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
          BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%%') AS ikke_ep,
          MIN(o.ordre_dato) AS aeldste_ordredato,
          SUM(COALESCE(o.ej_faktureret, 0)) AS belob
        FROM public.open_orders_lago o
        GROUP BY o.ordre_nr, o.visma_customer_no
      )
      SELECT COUNT(DISTINCT visma_customer_no) AS kunder, COUNT(*) AS ordrer, SUM(belob)::numeric(14,2) AS beloeb
      FROM ordre_flag WHERE ${t.where}
    `);
    console.log(`${t.navn}: ${JSON.stringify(res[0])}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
