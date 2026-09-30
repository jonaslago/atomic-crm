-- Brief 90 §1 (28. sep 2026): ringeliste-tærskel fra 5 til 14 dage.
--
-- Grunden: brief 90 besluttede at kontoret må agere, men ejerskabet
-- forbliver hos sælgeren. 14 dage er den nye ventetid før kontoret kan
-- ringe til en overskredet kunde.
--
-- Målt før skift (28. sep 2026): 108 kunder ved ≥5 dage, 106 ved ≥14
-- dage — kun 2 kunder flyttes ud af listen. Ingen dramatisk følgeeffekt.
--
-- Ejerskabet flytter IKKE. Kunden bliver hos sin sælger. Reglen vises
-- som underlinje på widget'en (frontend-ændring): "Kunder, sælgeren
-- ikke har nået inden for 14 dage ud over intervallet. Kontoret må
-- ringe; kunden bliver hos sin sælger."

CREATE OR REPLACE FUNCTION public.dashboard_ringeliste_lago(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_rows      jsonb;
    v_total     int;
BEGIN
    WITH candidates AS (
      SELECT
        c.id,
        c.name,
        c.city,
        c.sales_id,
        cl.segment,
        cl.distrikt,
        cl.last_visit_at,
        cl.visma_sales_name,
        cl.besoegsfrekvens_note,
        vp.days_overdue,
        CASE cl.segment WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 END
          AS segment_rank
      FROM public.companies c
      JOIN public.companies_lago cl ON cl.company_id = c.id
      JOIN public.customers_with_priority_lago vp
        ON vp.company_id = cl.company_id
      WHERE cl.is_visible_to_sales = true
        AND cl.is_active = true
        AND cl.next_visit_planned IS NULL
        AND vp.status = 'overdue'
        AND vp.days_overdue >= 14
    ),
    ranked AS (
      SELECT c.*,
             row_number() OVER (
               ORDER BY days_overdue DESC, segment_rank ASC, name ASC
             ) AS rn
      FROM candidates c
    )
    SELECT
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'city', r.city,
            'sales_id', r.sales_id,
            'segment', r.segment,
            'distrikt', r.distrikt,
            'last_visit_at', r.last_visit_at,
            'visma_sales_name', r.visma_sales_name,
            'days_overdue', r.days_overdue,
            'interval_days', NULL,
            'besoegsfrekvens_note', r.besoegsfrekvens_note
          )
          ORDER BY r.days_overdue DESC, r.segment_rank ASC, r.name ASC
        ) FILTER (WHERE r.rn <= p_limit),
        '[]'::jsonb
      ),
      count(*)::int
    INTO v_rows, v_total
    FROM ranked r;

    RETURN jsonb_build_object(
      'rows', v_rows,
      'total', v_total
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_ringeliste_lago(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_ringeliste_lago(int) TO authenticated;
