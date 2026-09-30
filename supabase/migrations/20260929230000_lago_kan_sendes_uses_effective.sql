-- §11 opfølgning (29. sep 2026): Kan sendes læser open_orders_effective_lago,
-- så par-detektionen tælles med (fx #34868's 91814-BY-pakke). Ordre-
-- niveau-tjek på lagerstatus_effective — komponent-linjer (er_par_komponent)
-- ignoreres, deres reservation er allerede overtaget af salgsvaren.
--
-- Ændringer fra 20260929020000-versionen:
--   - FROM open_orders_lago  →  FROM open_orders_effective_lago
--   - BOOL_AND(lagerstatus='klar')  →  BOOL_AND(lagerstatus_effective='klar')
--   - WHERE er_par_komponent = false (skip komponenter fra tælling)
-- Alt andet uændret.
--
-- Forventet effekt: 10 flere ordrer med (jf. §1E-måling), heraf 5 rene
-- pakker (34412, 34550, 34728, 34868, 35043). Skælskør skifter fra 2
-- ordrer / 58.861 kr til 3 / 78.279 kr.

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
        BOOL_AND(o.lagerstatus_effective = 'klar') AS all_klar,
        BOOL_AND(COALESCE(o.antal_faerdigmeldt, 0) = 0) AS ingen_faerdigmeldt,
        BOOL_AND(o.levering = '0') AS levering_nul,
        BOOL_AND(COALESCE(o.mav, false) = false) AS ikke_mav,
        BOOL_AND(o.status IS NULL OR o.status NOT LIKE '21%') AS ikke_ep,
        MIN(o.ordre_dato) AS aeldste_ordredato,
        SUM(COALESCE(o.ej_faktureret, 0)) AS ordre_belob
      FROM public.open_orders_effective_lago o
      WHERE o.er_par_komponent = false
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
      'total_ordrer', v_total_ordrer,
      'total_beloeb', v_total_beloeb
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_kan_sendes_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_kan_sendes_lago(int) TO authenticated;
