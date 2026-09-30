-- Brief 90 §4 (28. sep 2026): Kunder med ordrer der kan sendes.
--
-- Definition (fra brief 90):
--   - hele ordren klar: BOOL_AND(lagerstatus = 'klar') pr. ordre_nr
--   - antal_faerdigmeldt = 0 på alle linjer
--   - undtages_lagerhaandtering ikke true på nogen linje
--   - Levering = 0 (almindelig levering) — reservation (5) og MAV (mav=true)
--     hører ikke her; de venter med vilje
--   - En Primeur (status LIKE '21%%') er også ude
--
-- Kreditspærrede mærkes IKKE i selve tællingen — varen er klar; den må
-- bare ikke af sted. Widget'en resolverer kreditspaerre-flag pr. kunde
-- så det kan vises som en chip på rækken.
--
-- Målt 29. sep 2026:
--   37 kunder · 43 ordrer · 461.260 kr (hele-ordren-klar definition)
--   57 kunder · 155 ordrer · 2.255.021 kr (mindst én klar linje)
-- Brief 90 §4 nævnte 73/171/2.289.423 — sandsynligvis fra 22. sep-fil
-- inden data har flyttet sig; hele-ordren-definitionen fastholdes.

CREATE OR REPLACE FUNCTION public.dashboard_kan_sendes_lago(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows          jsonb;
    v_total         int;
    v_total_ordrer  int;
    v_total_beloeb  numeric;
BEGIN
    WITH ordre_flag AS (
      SELECT
        o.ordre_nr,
        o.visma_customer_no,
        BOOL_AND(o.lagerstatus = 'klar') AS all_klar,
        BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_faerdigmeldt,
        BOOL_AND(COALESCE(o.undtages_lagerhaandtering, false) = false) AS ingen_undtages,
        BOOL_AND(o.levering = '0') AS levering_nul,
        BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%') AS ikke_ep,
        MIN(o.ordre_dato) AS aeldste_ordredato,
        SUM(COALESCE(o.ej_faktureret, 0)) AS ordre_belob
      FROM public.open_orders_lago o
      GROUP BY o.ordre_nr, o.visma_customer_no
    ),
    kunde_agg AS (
      SELECT
        of.visma_customer_no,
        COUNT(*)::int              AS antal_ordrer,
        SUM(of.ordre_belob)        AS beloeb,
        MIN(of.aeldste_ordredato)  AS aeldste_ordredato,
        ARRAY_AGG(of.ordre_nr ORDER BY of.aeldste_ordredato ASC) AS ordre_numre
      FROM ordre_flag of
      WHERE of.all_klar
        AND of.ingen_faerdigmeldt
        AND of.ingen_undtages
        AND of.levering_nul
        AND of.ikke_mav
        AND of.ikke_ep
      GROUP BY of.visma_customer_no
    ),
    joined AS (
      SELECT
        c.id                      AS company_id,
        c.name                    AS kunde,
        c.sales_id,
        cl.visma_customer_no,
        cl.segment,
        cl.distrikt,
        cl.visma_sales_name,
        cl.kreditspaerre,
        k.antal_ordrer,
        k.beloeb,
        k.aeldste_ordredato,
        k.ordre_numre,
        row_number() OVER (ORDER BY k.beloeb DESC, k.aeldste_ordredato ASC, c.name ASC) AS rn
      FROM kunde_agg k
      JOIN public.companies_lago cl ON cl.visma_customer_no = k.visma_customer_no
      JOIN public.companies c ON c.id = cl.company_id
    )
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'company_id',        j.company_id,
            'kunde',             j.kunde,
            'sales_id',          j.sales_id,
            'visma_customer_no', j.visma_customer_no,
            'segment',           j.segment,
            'distrikt',          j.distrikt,
            'visma_sales_name',  j.visma_sales_name,
            'kreditspaerre',     j.kreditspaerre,
            'antal_ordrer',      j.antal_ordrer,
            'beloeb',            j.beloeb,
            'aeldste_ordredato', j.aeldste_ordredato,
            'ordre_numre',       to_jsonb(j.ordre_numre)
          )
          ORDER BY j.beloeb DESC, j.aeldste_ordredato ASC, j.kunde ASC
        ) FILTER (WHERE j.rn <= p_limit),
        '[]'::jsonb
      ),
      count(*)::int,
      COALESCE(SUM(j.antal_ordrer), 0)::int,
      COALESCE(SUM(j.beloeb), 0)
    INTO v_rows, v_total, v_total_ordrer, v_total_beloeb
    FROM joined j;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total', v_total,
      -- Brief 90 opfølgning (29. sep 2026): grand-totals over ALLE
      -- kunder, ikke kun de p_limit synlige. Bundlinjen "37 kunder ·
      -- 25 ordrer" var umulig — 25 var summen af top 5's ordrer, mens
      -- 37 var alle kunder. Nu er begge tal fra samme univers.
      'total_ordrer', v_total_ordrer,
      'total_beloeb', v_total_beloeb
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_kan_sendes_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_kan_sendes_lago(int) TO authenticated;
